/**
 * This app's projection of the SHARED sample-status list.
 *
 * `core/sample-statuses.json` is a byte-identical, vendored copy of the single
 * source of truth in the tiktok-sample-tracker repo
 * (`src/lib/sample-statuses.json`). Refresh it with `deno task sync:statuses`;
 * `deno task sync:statuses --check` fails if it (or Entities/Sample.json's
 * enum) drifts from canonical. Edit statuses ONLY in the canonical file.
 *
 * The status LIST (which values exist, labels, badge-vs-status, order) is
 * single-sourced here. Per-status *styling* stays local to the UI components
 * (e.g. Components/ui/multi-select.tsx), which is intentional — the two apps
 * may render the same status with different colors, but never a different list.
 */
import shared from "./sample-statuses.json" with { type: "json" };

export type StatusKind = "status" | "badge";

export interface SharedStatusEntry {
  value: string;
  label: string;
  kind: StatusKind;
  exclusive: boolean;
  appliesTo: ("tiktok" | "datapimp")[];
  icon: string | null;
  palette: string;
  order: number;
}

/** A status option ready for this app's UI, with its i18n key resolved. */
export interface StatusOptionSource {
  value: string;
  kind: StatusKind;
  /** Default label from the shared file (used as an i18n fallback). */
  defaultLabel: string;
  /** This app's translation key: `status.<value>` for statuses, `filters.<camel>` for badges. */
  i18nKey: string;
  /** lucide icon token, or null. */
  icon: string | null;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const DATAPIMP_ENTRIES: SharedStatusEntry[] = (shared as SharedStatusEntry[])
  .filter((s) => s.appliesTo.includes("datapimp"))
  .sort((a, b) => a.order - b.order);

function toOption(s: SharedStatusEntry): StatusOptionSource {
  return {
    value: s.value,
    kind: s.kind,
    defaultLabel: s.label,
    i18nKey: s.kind === "badge" ? `filters.${camel(s.value)}` : `status.${s.value}`,
    icon: s.icon,
  };
}

/** Exclusive statuses (one-per-sample) this app surfaces, in order. */
export const STATUS_OPTIONS: StatusOptionSource[] = DATAPIMP_ENTRIES
  .filter((s) => s.kind === "status")
  .map(toOption);

/** Non-exclusive badge overlays (fire sale, lowest price), in order. */
export const BADGE_OPTIONS: StatusOptionSource[] = DATAPIMP_ENTRIES
  .filter((s) => s.kind === "badge")
  .map(toOption);

/** All filter options (statuses first, then badges) for the Samples filter. */
export const FILTER_OPTIONS: StatusOptionSource[] = [...STATUS_OPTIONS, ...BADGE_OPTIONS];

/** The exclusive-status values — mirrors Entities/Sample.json's `status` enum. */
export const STATUS_VALUES: string[] = STATUS_OPTIONS.map((o) => o.value);

/** The badge values handled specially by the Samples filter logic. */
export const BADGE_VALUES: string[] = BADGE_OPTIONS.map((o) => o.value);
