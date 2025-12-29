// db.ts - npm:pg version (Deno Deploy friendly)
// Fixes: created_date missing -> safe fallback, validates order_by + filters.

import { Pool } from "npm:pg";

const pool = new Pool({
  connectionString: Deno.env.get("DATABASE_URL"),
  max: 1,
});

// Cache table columns so we can validate filters + order_by
const columnCache = new Map<string, Set<string>>();

async function getColumns(table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;

  const client = await pool.connect();
  try {
    const r = await client.query(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = $1
       order by ordinal_position`,
      [table],
    );
    const cols = new Set<string>(r.rows.map((row: any) => row.column_name));
    columnCache.set(table, cols);
    return cols;
  } finally {
    client.release();
  }
}

function safeIdent(col: string): string {
  return `"${col.replace(/"/g, '""')}"`;
}

function pickFallbackColumn(cols: Set<string>): string {
  if (cols.has("created_at")) return "created_at";
  if (cols.has("created_on")) return "created_on";
  if (cols.has("created")) return "created";
  if (cols.has("id")) return "id";
  return Array.from(cols)[0] || "id";
}

function parseOrderBy(orderBy: string | null | undefined, cols: Set<string>): string {
  const raw = (orderBy || "").trim();
  if (!raw) {
    const fb = pickFallbackColumn(cols);
    return `${safeIdent(fb)} DESC`;
  }

  const desc = raw.startsWith("-");
  const requested = (desc ? raw.slice(1) : raw).trim();

  // legacy alias: created_date -> created_at (if present)
  let col = requested;
  if (col === "created_date" && !cols.has("created_date") && cols.has("created_at")) {
    col = "created_at";
  }

  if (!cols.has(col)) col = pickFallbackColumn(cols);
  return `${safeIdent(col)} ${desc ? "DESC" : "ASC"}`;
}

function buildWhere(filters: Record<string, unknown> | null | undefined, cols: Set<string>) {
  const values: unknown[] = [];
  const parts: string[] = [];

  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null) continue;
      if (!cols.has(k)) continue; // ignore unknown keys (prevents SQLi)
      values.push(v);
      parts.push(`${safeIdent(k)} = $${values.length}`);
    }
  }

  const clause = parts.length ? `where ${parts.join(" and ")}` : "";
  return { clause, values };
}

function safeLimit(limit?: number) {
  if (limit === undefined) return undefined;
  if (!Number.isFinite(limit)) return undefined;
  const n = Math.max(1, Math.min(500, Math.trunc(limit)));
  return n;
}

async function run<T = any>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  await Promise.all([
    getColumns("samples"),
    getColumns("bundles"),
    getColumns("inventory_transactions"),
  ]).catch((e) => console.error("initializeDatabase warmup failed:", e));
}

async function listTable(table: string, orderBy?: string) {
  const cols = await getColumns(table);
  const orderSql = parseOrderBy(orderBy || null, cols);

  return await run(async (client) => {
    const r = await client.query(`select * from public.${table} order by ${orderSql}`);
    return r.rows;
  });
}

async function filterTable(
  table: string,
  filters: Record<string, unknown>,
  orderBy?: string,
  limit?: number,
) {
  const cols = await getColumns(table);
  const orderSql = parseOrderBy(orderBy || null, cols);
  const { clause, values } = buildWhere(filters, cols);
  const lim = safeLimit(limit);

  return await run(async (client) => {
    const sql =
      `select * from public.${table} ${clause} order by ${orderSql}` +
      (lim ? ` limit ${lim}` : "");
    const r = await client.query(sql, values);
    return r.rows;
  });
}

async function insertRow(table: string, data: Record<string, unknown>) {
  const cols = await getColumns(table);

  const keys = Object.keys(data).filter((k) => cols.has(k) && k !== "id");
  if (keys.length === 0) throw new Error(`No insertable fields for ${table}`);

  const values = keys.map((k) => data[k]);
  const colSql = keys.map(safeIdent).join(", ");
  const valSql = keys.map((_, i) => `$${i + 1}`).join(", ");

  return await run(async (client) => {
    const r = await client.query(
      `insert into public.${table} (${colSql}) values (${valSql}) returning *`,
      values,
    );
    return r.rows[0];
  });
}

async function updateRow(table: string, id: string, data: Record<string, unknown>) {
  const cols = await getColumns(table);

  const keys = Object.keys(data).filter((k) => cols.has(k) && k !== "id");
  if (keys.length === 0) throw new Error(`No updatable fields for ${table}`);

  const values = keys.map((k) => data[k]);
  values.push(id);

  const setSql = keys.map((k, i) => `${safeIdent(k)} = $${i + 1}`).join(", ");

  return await run(async (client) => {
    const r = await client.query(
      `update public.${table} set ${setSql} where ${safeIdent("id")} = $${values.length} returning *`,
      values,
    );
    return r.rows[0];
  });
}

async function deleteRow(table: string, id: string) {
  return await run(async (client) => {
    await client.query(`delete from public.${table} where ${safeIdent("id")} = $1`, [id]);
  });
}

export const Samples = {
  list: (orderBy?: string) => listTable("samples", orderBy),
  filter: (filters: Record<string, unknown>, orderBy?: string, limit?: number) =>
    filterTable("samples", filters, orderBy, limit),
  create: (data: Record<string, unknown>) => insertRow("samples", data),
  update: (id: string, data: Record<string, unknown>) => updateRow("samples", id, data),
  delete: (id: string) => deleteRow("samples", id),
};

export const Bundles = {
  list: (orderBy?: string) => listTable("bundles", orderBy),
  filter: (filters: Record<string, unknown>, orderBy?: string, limit?: number) =>
    filterTable("bundles", filters, orderBy, limit),
  create: (data: Record<string, unknown>) => insertRow("bundles", data),
  update: (id: string, data: Record<string, unknown>) => updateRow("bundles", id, data),
  delete: (id: string) => deleteRow("bundles", id),
};

export const InventoryTransactions = {
  filter: (filters: Record<string, unknown>, orderBy?: string, limit?: number) =>
    filterTable("inventory_transactions", filters, orderBy, limit),
  create: (data: Record<string, unknown>) => insertRow("inventory_transactions", data),
};
