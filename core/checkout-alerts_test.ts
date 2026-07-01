import { expect } from "@std/expect";
import {
  alertKey,
  buildCheckoutAlertContent,
  type CheckoutRow,
  findStaleCheckouts,
  runCheckoutAlerts,
  type StaleCheckout,
} from "./checkout-alerts.ts";

const NOW = Date.parse("2026-07-01T00:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

Deno.test("findStaleCheckouts flags rows at or past the threshold, oldest first", () => {
  const rows: CheckoutRow[] = [
    { id: 1, name: "A", status: "checked_out", checked_out_at: hoursAgo(100) },
    { id: 2, name: "B", status: "checked_out", checked_out_at: hoursAgo(80) },
    { id: 3, name: "C", status: "checked_out", checked_out_at: hoursAgo(72) },
  ];
  const stale = findStaleCheckouts(rows, { now: NOW, thresholdHours: 72 });
  expect(stale.map((s) => s.sampleId)).toEqual([1, 2, 3]); // oldest → newest
  expect(stale[0].ageHours).toBe(100);
});

Deno.test("findStaleCheckouts ignores fresh checkouts and other statuses", () => {
  const rows: CheckoutRow[] = [
    {
      id: 1,
      name: "fresh",
      status: "checked_out",
      checked_out_at: hoursAgo(10),
    },
    {
      id: 2,
      name: "avail",
      status: "available",
      checked_out_at: hoursAgo(500),
    },
    { id: 3, name: "sold", status: "sold", checked_out_at: hoursAgo(500) },
  ];
  expect(findStaleCheckouts(rows, { now: NOW, thresholdHours: 72 })).toEqual(
    [],
  );
});

Deno.test("threshold boundary is inclusive (>= threshold)", () => {
  const at = [{ id: 1, status: "checked_out", checked_out_at: hoursAgo(72) }];
  const under = [{
    id: 1,
    status: "checked_out",
    checked_out_at: hoursAgo(71),
  }];
  expect(findStaleCheckouts(at, { now: NOW, thresholdHours: 72 })).toHaveLength(
    1,
  );
  expect(findStaleCheckouts(under, { now: NOW, thresholdHours: 72 }))
    .toHaveLength(0);
});

Deno.test("findStaleCheckouts falls back to created_at and marks it approximate", () => {
  const rows: CheckoutRow[] = [
    { id: 1, status: "checked_out", created_at: hoursAgo(200) }, // no checked_out_at
  ];
  const stale = findStaleCheckouts(rows, { now: NOW, thresholdHours: 72 });
  expect(stale).toHaveLength(1);
  expect(stale[0].approximate).toBe(true);
  expect(stale[0].ageHours).toBe(200);
});

Deno.test("findStaleCheckouts skips rows with no parseable timestamp", () => {
  const rows: CheckoutRow[] = [
    { id: 1, status: "checked_out", checked_out_at: null, created_at: "" },
    { id: 2, status: "checked_out", checked_out_at: "not-a-date" },
  ];
  expect(findStaleCheckouts(rows, { now: NOW, thresholdHours: 72 })).toEqual(
    [],
  );
});

Deno.test("findStaleCheckouts accepts Date objects (pg timestamps)", () => {
  const rows: CheckoutRow[] = [
    {
      id: 1,
      status: "checked_out",
      checked_out_at: new Date(NOW - 90 * 3_600_000),
    },
  ];
  const stale = findStaleCheckouts(rows, { now: NOW, thresholdHours: 72 });
  expect(stale).toHaveLength(1);
  expect(stale[0].ageHours).toBe(90);
});

Deno.test("alertKey prefers sample id, then product id, then a synthesized key", () => {
  const base: StaleCheckout = {
    sampleId: 7,
    productId: "p1",
    name: "n",
    checkedOutTo: null,
    since: hoursAgo(80),
    ageHours: 80,
    approximate: false,
  };
  expect(alertKey(base)).toBe("sample:7");
  expect(alertKey({ ...base, sampleId: null })).toBe("product:p1");
  expect(alertKey({ ...base, sampleId: null, productId: null }))
    .toBe(`since:${base.since}:n`);
});

Deno.test("buildCheckoutAlertContent summarizes the batch and names the threshold", () => {
  const stale: StaleCheckout[] = [{
    sampleId: 42,
    productId: "p",
    name: "Cupids Desire Drops",
    checkedOutTo: "@boosteddealsdaily",
    since: hoursAgo(90),
    ageHours: 90,
    approximate: false,
  }];
  const body = buildCheckoutAlertContent(stale, { thresholdHours: 72 });
  expect(body.content).toContain("1 sample");
  expect(body.content).toContain("72h");
  expect(body.embeds?.[0].description).toContain("Cupids Desire Drops");
  expect(body.embeds?.[0].description).toContain("@boosteddealsdaily");
  expect(body.embeds?.[0].description).toContain("#42");
  expect(body.embeds?.[0].description).toContain("3d 18h"); // 90h humanized
});

Deno.test("buildCheckoutAlertContent truncates long batches with an overflow line", () => {
  const many: StaleCheckout[] = Array.from({ length: 30 }, (_, i) => ({
    sampleId: i,
    productId: null,
    name: `S${i}`,
    checkedOutTo: null,
    since: hoursAgo(100),
    ageHours: 100,
    approximate: false,
  }));
  const body = buildCheckoutAlertContent(many, { thresholdHours: 72 });
  expect(body.content).toContain("30 samples");
  expect(body.embeds?.[0].description).toContain("…and 5 more.");
});

Deno.test("runCheckoutAlerts no-ops when the webhook is unset", async () => {
  let listed = false;
  const r = await runCheckoutAlerts({
    webhookUrl: null,
    listCheckedOut: () => {
      listed = true;
      return Promise.resolve([]);
    },
  });
  expect(r.enabled).toBe(false);
  expect(r.alerted).toBe(0);
  expect(listed).toBe(false); // returns before ever touching the DB
});

Deno.test("runCheckoutAlerts alerts fresh stale samples and records them", async () => {
  const remembered = new Set<string>();
  const posted: unknown[] = [];
  const r = await runCheckoutAlerts({
    now: NOW,
    thresholdHours: 72,
    repeatHours: 24,
    webhookUrl: "https://discord.test/webhook",
    listCheckedOut: () =>
      Promise.resolve([
        { id: 1, status: "checked_out", checked_out_at: hoursAgo(100) },
        { id: 2, status: "checked_out", checked_out_at: hoursAgo(10) }, // fresh
      ]),
    wasAlerted: (k) => Promise.resolve(remembered.has(k)),
    markAlerted: (k) => {
      remembered.add(k);
      return Promise.resolve();
    },
    notify: (_url, body) => {
      posted.push(body);
      return Promise.resolve(true);
    },
  });
  expect(r).toEqual({
    enabled: true,
    checked: 2,
    stale: 1,
    alerted: 1,
    skipped: 0,
    ok: true,
  });
  expect(posted).toHaveLength(1);
  expect(remembered.has("sample:1")).toBe(true);
});

Deno.test("runCheckoutAlerts throttles samples already alerted in the window", async () => {
  let posts = 0;
  const r = await runCheckoutAlerts({
    now: NOW,
    thresholdHours: 72,
    webhookUrl: "https://discord.test/webhook",
    listCheckedOut: () =>
      Promise.resolve([{
        id: 1,
        status: "checked_out",
        checked_out_at: hoursAgo(100),
      }]),
    wasAlerted: () => Promise.resolve(true), // already pinged
    markAlerted: () => Promise.resolve(),
    notify: () => {
      posts++;
      return Promise.resolve(true);
    },
  });
  expect(r.stale).toBe(1);
  expect(r.skipped).toBe(1);
  expect(r.alerted).toBe(0);
  expect(posts).toBe(0); // nothing new → no Discord call
});

Deno.test("runCheckoutAlerts does not remember samples when the post fails", async () => {
  const remembered = new Set<string>();
  const r = await runCheckoutAlerts({
    now: NOW,
    thresholdHours: 72,
    webhookUrl: "https://discord.test/webhook",
    listCheckedOut: () =>
      Promise.resolve([{
        id: 1,
        status: "checked_out",
        checked_out_at: hoursAgo(100),
      }]),
    wasAlerted: (k) => Promise.resolve(remembered.has(k)),
    markAlerted: (k) => {
      remembered.add(k);
      return Promise.resolve();
    },
    notify: () => Promise.resolve(false), // delivery failed
  });
  expect(r.ok).toBe(false);
  expect(r.alerted).toBe(0);
  expect(remembered.size).toBe(0); // retried next run
});
