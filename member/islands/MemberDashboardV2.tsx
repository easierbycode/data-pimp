import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  ACCOUNTS,
  ALL_ACCOUNT,
  type Account,
  acctById,
  KPI_ALL,
  KPI_BY_ACCT,
  type KpiBundle,
  MONTH_COMPARE,
  POWER_DEAL,
  PRODUCTS,
  type Product,
  STREAK,
  VIDEOS,
  type Video,
} from "./dashboard-data.ts";
import styles from "./MemberDashboardV2.module.css";
import SvelteCounter from "./SvelteCounter.tsx";

const fmtMoney = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1000) {
    return `$${(n / 1000).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })}k`;
  }
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtMoneyFull = (n: number) => `$${Math.round(n).toLocaleString()}`;

const fmtInt = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
};

const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

function joinCls(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

interface AccountBadgesProps {
  accountIds: string[];
  max?: number;
  size?: number;
  title?: string;
}

function AccountBadges({
  accountIds,
  max = 4,
  size = 24,
  title,
}: AccountBadgesProps) {
  const shown = accountIds.slice(0, max);
  const overflow = accountIds.length - shown.length;
  const names = accountIds
    .map((id) => acctById(id)?.name)
    .filter(Boolean)
    .join(", ");
  return (
    <span class={styles.badges}>
      {shown.map((id) => {
        const a = acctById(id);
        if (!a) return null;
        return (
          <span
            key={id}
            class={styles.badge}
            style={{ background: a.color, width: size, height: size }}
            aria-label={a.name}
          >
            {a.initials}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          class={joinCls(styles.badge, styles.badgeOverflow)}
          style={{ width: size, height: size }}
        >
          +{overflow}
        </span>
      )}
      <span class={styles.badgeTip}>{title || names}</span>
    </span>
  );
}

function Topbar() {
  return (
    <header class={styles.topbar}>
      <div class={styles.topbarMain}>
        <span class={styles.dotBrand} />
        <div>
          <div class={styles.brandText}>
            Tok<span class={styles.brandTextAccent}>Scrape</span>
          </div>
          <h1 class={styles.title}>Dashboard</h1>
        </div>
      </div>
      <div class={styles.actions}>
        <button
          type="button"
          class={joinCls(styles.btn, styles.btnIcon)}
          title="Refresh"
          aria-label="Refresh"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
        <button
          type="button"
          class={joinCls(styles.btn, styles.btnIcon)}
          title="Settings"
          aria-label="Settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
        <button
          type="button"
          class={joinCls(styles.btn, styles.btnIcon)}
          title="Profile"
          aria-label="Profile"
        >
          <span class={styles.avatar}>DN</span>
        </button>
      </div>
    </header>
  );
}

interface AccountSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

function AccountSelector({ selected, onSelect }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const current: Account = selected === "__all"
    ? ALL_ACCOUNT
    : (acctById(selected) ?? ALL_ACCOUNT);

  return (
    <div class={joinCls(styles.acctSelect, open && styles.open)} ref={ref}>
      <button
        type="button"
        class={styles.acctTrigger}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          class={styles.acctDot}
          style={{ background: current.color }}
        />
        <span class={styles.acctTriggerLabel}>
          <span class={styles.acctTriggerK}>Viewing</span>
          <span class={styles.acctTriggerV}>
            {current.name}
            {selected === "__all" && (
              <span
                style={{
                  color: "var(--muted-foreground)",
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                · {ACCOUNTS.length} accounts
              </span>
            )}
          </span>
        </span>
        <span class={styles.acctCaret}>▾</span>
      </button>
      {open && (
        <div
          class={styles.acctPanel}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          role="listbox"
        >
          <h4>Aggregate</h4>
          <button
            type="button"
            class={joinCls(
              styles.acctRow,
              selected === "__all" && styles.acctRowActive,
            )}
            onClick={() => {
              onSelect("__all");
              setOpen(false);
            }}
          >
            <span
              class={styles.acctDot}
              style={{ background: ALL_ACCOUNT.color }}
            />
            <span class={styles.acctRowName}>All Accounts</span>
            <span class={styles.acctRowHandle}>
              {ACCOUNTS.length} creators
            </span>
            <span class={styles.acctCheck}>
              {selected === "__all" ? "✓" : ""}
            </span>
          </button>
          <h4>Accounts</h4>
          {ACCOUNTS.map((a) => (
            <button
              key={a.id}
              type="button"
              class={joinCls(
                styles.acctRow,
                selected === a.id && styles.acctRowActive,
              )}
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
            >
              <span
                class={styles.acctDot}
                style={{ background: a.color }}
              />
              <span class={styles.acctRowName}>{a.name}</span>
              <span class={styles.acctRowHandle}>{a.handle}</span>
              <span class={styles.acctCheck}>
                {selected === a.id ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StreakRow() {
  const up = MONTH_COMPARE.thisMonth > MONTH_COMPARE.prevMonth;
  return (
    <div class={styles.streak}>
      <div class={styles.streakCard}>
        <div class={styles.streakNum}>{STREAK.days}</div>
        <div class={styles.streakMeta}>
          <span class={styles.streakMetaK}>Daily posting streak</span>
          <span class={styles.streakMetaV}>
            {STREAK.days} days · best {STREAK.bestDays}
          </span>
        </div>
        <span class={styles.streakFlame} role="img" aria-label="streak">
          🔥
        </span>
      </div>
      <div
        class={styles.trendCard}
        title="Videos posted this month vs last month"
      >
        <span class={styles.trendNum}>{MONTH_COMPARE.thisMonth}</span>
        <span
          class={joinCls(styles.trendArrow, !up && styles.trendArrowDown)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            {up ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
          </svg>
        </span>
        <span class={styles.trendNum} style={{ opacity: 0.5 }}>
          {MONTH_COMPARE.prevMonth}
        </span>
        <span class={styles.trendLabel}>
          <strong>This month</strong>
          <br />
          vs last month
        </span>
      </div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color?: string;
  gradId: string;
}

function Sparkline(
  { data, color = "var(--primary)", gradId }: SparklineProps,
) {
  const w = 120;
  const h = 34;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const pts = data.map(
    (v, i) =>
      [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)] as [
        number,
        number,
      ],
  );
  const line = pts
    .map(
      ([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${
    pts[pts.length - 1][0].toFixed(1)
  } ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return (
    <svg
      class={styles.spark}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.35" />
          <stop offset="100%" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        stroke-width="1.6"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  );
}

interface KpiTilesProps {
  kpi: KpiBundle;
  scopeColor: string;
}

function KpiTiles({ kpi, scopeColor }: KpiTilesProps) {
  const tiles = [
    {
      key: "gmv",
      label: "GMV",
      icon: "$",
      val: fmtMoneyFull(kpi.gmv.value),
      delta: kpi.gmv.delta,
      spark: kpi.gmv.spark,
    },
    {
      key: "videos",
      label: "# Videos",
      icon: "▶",
      val: fmtInt(kpi.videos.value),
      delta: kpi.videos.delta,
      spark: kpi.videos.spark,
    },
    {
      key: "commission",
      label: "Commission",
      icon: "%",
      val: fmtMoneyFull(kpi.commission.value),
      delta: kpi.commission.delta,
      spark: kpi.commission.spark,
    },
  ];
  return (
    <div class={styles.kpis}>
      {tiles.map((t) => (
        <div class={styles.kpi} key={t.key}>
          <div class={styles.kpiLabel}>
            <span class={styles.kpiLabelIcon}>{t.icon}</span>
            {t.label}
          </div>
          <div class={styles.kpiVal}>{t.val}</div>
          <div class={styles.kpiDelta}>
            <span
              class={joinCls(
                styles.delta,
                t.delta >= 0 ? styles.deltaUp : styles.deltaDown,
              )}
            >
              {pct(t.delta)}
            </span>{" "}
            vs prev period
          </div>
          <div class={styles.kpiSpark}>
            <Sparkline
              data={t.spark}
              color={scopeColor}
              gradId={`spark-${t.key}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ScopePillProps {
  scope: string;
}

function ScopePill({ scope }: ScopePillProps) {
  const s: Account = scope === "__all"
    ? ALL_ACCOUNT
    : (acctById(scope) ?? ALL_ACCOUNT);
  return (
    <span class={styles.scopePill}>
      <span class={styles.acctDot} style={{ background: s.color }} />
      {s.name}
    </span>
  );
}

interface ProductsTableProps {
  products: Product[];
  scope: string;
}

function ProductsTable({ products, scope }: ProductsTableProps) {
  return (
    <section class={styles.section}>
      <div class={styles.sectionHead}>
        <h2 class={styles.sectionTitle}>
          Products <span class={styles.pill}>by brand</span>
        </h2>
        <div class={styles.sectionActions}>
          <ScopePill scope={scope} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table class={styles.tbl}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Brand</th>
              <th style={{ width: 120 }}>Accounts</th>
              <th class={styles.num}>GMV</th>
              <th class={styles.num}># Units</th>
              <th class={styles.num}>Commission</th>
              <th class={styles.num} style={{ width: 70 }}>
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <span
                    class={joinCls(styles.rank, i < 3 && styles.gold)}
                  >
                    {i + 1}
                  </span>
                </td>
                <td>
                  <div class={styles.brand}>{p.brand}</div>
                  <div class={styles.sub}>{p.category}</div>
                </td>
                <td>
                  <AccountBadges accountIds={p.accounts} />
                </td>
                <td class={joinCls(styles.num, styles.money)}>
                  {fmtMoneyFull(p.gmv)}
                </td>
                <td class={styles.num}>{p.units}</td>
                <td class={joinCls(styles.num, styles.money)}>
                  {fmtMoneyFull(p.commission)}
                </td>
                <td class={styles.num}>
                  <span
                    class={p.trend >= 0 ? styles.deltaUp : styles.deltaDown}
                    style={{ fontWeight: 700 }}
                  >
                    {pct(p.trend)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface VideosGridProps {
  videos: Video[];
}

function VideosGrid({ videos }: VideosGridProps) {
  return (
    <section class={styles.section}>
      <div class={styles.sectionHead}>
        <h2 class={styles.sectionTitle}>
          Videos <span class={styles.pill}>top performing</span>
        </h2>
        <div class={styles.sectionActions}>
          <button type="button" class={styles.btn} style={{ fontSize: 12 }}>
            View all →
          </button>
        </div>
      </div>
      <div class={styles.videos}>
        {videos.map((v) => (
          <article class={styles.video} key={v.id}>
            <div class={styles.videoThumb}>
              <div class={styles.videoThumbStripes} />
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <div class={styles.videoBadges}>
                <AccountBadges accountIds={v.accounts} size={20} max={3} />
              </div>
            </div>
            <div class={styles.videoBody}>
              <div class={styles.videoBrand}>
                {v.brand}
                {v.hot && <span class={styles.videoHot}>🔥 HOT</span>}
              </div>
              <div class={styles.videoCaption}>{v.caption}</div>
              <div class={styles.videoStats}>
                <div>
                  <div class={styles.videoStatK}>GMV</div>
                  <div class={styles.videoStatV}>{fmtMoney(v.gmv)}</div>
                </div>
                <div>
                  <div class={styles.videoStatK}>Views</div>
                  <div class={styles.videoStatV}>{fmtInt(v.views)}</div>
                </div>
                <div>
                  <div class={styles.videoStatK}>Com.</div>
                  <div class={styles.videoStatV}>
                    {fmtMoney(v.commission)}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PowerDeal() {
  return (
    <div class={styles.powerDeal}>
      <AccountBadges accountIds={POWER_DEAL.accounts} size={30} />
      <div>
        <div class={styles.powerDealK}>Today's Power Deal</div>
        <div class={styles.powerDealTitle}>{POWER_DEAL.title}</div>
        <div class={styles.powerDealSub}>{POWER_DEAL.sub}</div>
      </div>
      <div class={styles.powerDealBadge}>View →</div>
    </div>
  );
}

type Period = "7d" | "30d" | "90d" | "all";

export default function MemberDashboardV2() {
  const [scope, setScope] = useState<string>("__all");
  const [period, setPeriod] = useState<Period>("7d");

  const { kpi, products, videos, scopeColor } = useMemo(() => {
    if (scope === "__all") {
      return {
        kpi: KPI_ALL,
        products: PRODUCTS,
        videos: VIDEOS,
        scopeColor: "var(--primary)",
      };
    }
    const a = acctById(scope);
    const alloc = KPI_BY_ACCT[scope] ?? { gmv: 0, videos: 0, commission: 0 };
    const gmvW = alloc.gmv / KPI_ALL.gmv.value;
    const vidW = alloc.videos / KPI_ALL.videos.value;
    const comW = alloc.commission / KPI_ALL.commission.value;
    return {
      kpi: {
        gmv: {
          value: alloc.gmv,
          delta: 0.14,
          spark: KPI_ALL.gmv.spark.map(
            (v) => Math.round(v * gmvW * 10) / 10,
          ),
        },
        videos: {
          value: alloc.videos,
          delta: 0.09,
          spark: KPI_ALL.videos.spark.map(
            (v) => Math.round(v * vidW * 10) / 10,
          ),
        },
        commission: {
          value: alloc.commission,
          delta: 0.17,
          spark: KPI_ALL.commission.spark.map(
            (v) => Math.round(v * comW * 10) / 10,
          ),
        },
      } satisfies KpiBundle,
      products: PRODUCTS.filter((p) => p.accounts.includes(scope)),
      videos: VIDEOS.filter((v) => v.accounts.includes(scope)),
      scopeColor: a?.color ?? "var(--primary)",
    };
  }, [scope]);

  const periods: Period[] = ["7d", "30d", "90d", "all"];
  const periodLabels: Record<Period, string> = {
    "7d": "7d",
    "30d": "30d",
    "90d": "90d",
    all: "All",
  };

  return (
    <div class={styles.root}>
      <Topbar />
      <main class={styles.page}>
        <div class={styles.acctBar}>
          <AccountSelector selected={scope} onSelect={setScope} />
          <div class={styles.seg}>
            {periods.map((p) => (
              <button
                type="button"
                key={p}
                class={p === period ? styles.segActive : undefined}
                onClick={() => setPeriod(p)}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        <StreakRow />

        <KpiTiles kpi={kpi} scopeColor={scopeColor} />

        <PowerDeal />

        <ProductsTable products={products} scope={scope} />

        <VideosGrid videos={videos} />

        <section class={styles.section}>
          <div class={styles.sectionHead}>
            <h2 class={styles.sectionTitle}>
              Accounts <span class={styles.pill}>legend</span>
            </h2>
          </div>
          <div class={styles.legend}>
            {ACCOUNTS.map((a) => (
              <span key={a.id} class={styles.acctChip}>
                <span class={styles.acctDot} style={{ background: a.color }} />
                {a.name}
              </span>
            ))}
          </div>
        </section>

        <section class={styles.section}>
          <div class={styles.sectionHead}>
            <h2 class={styles.sectionTitle}>
              Svelte Island{" "}
              <span class={styles.pill}>react + svelte side-by-side</span>
            </h2>
          </div>
          <SvelteCounter initial={5} label="Compiled by Svelte 5" />
        </section>
      </main>
    </div>
  );
}
