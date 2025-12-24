// db.ts - PostgreSQL database connection for Deno Deploy
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

// Connection pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = Deno.env.get("DATABASE_URL");
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    pool = new Pool(databaseUrl, 3, true);
  }
  return pool;
}

// Initialize database tables
export async function initializeDatabase() {
  const client = await getPool().connect();

  try {
    // Create samples table
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS samples (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        qr_code TEXT NOT NULL UNIQUE,
        location TEXT,
        picture_url TEXT,
        tiktok_affiliate_link TEXT,
        fire_sale BOOLEAN DEFAULT false,
        current_price NUMERIC(10, 2),
        best_price NUMERIC(10, 2),
        best_price_source TEXT,
        last_price_checked_at TIMESTAMPTZ,
        bundle_id TEXT,
        status TEXT DEFAULT 'available',
        checked_out_at TIMESTAMPTZ,
        checked_in_at TIMESTAMPTZ,
        checked_out_to TEXT,
        notes TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW(),
        updated_date TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create bundles table
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS bundles (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        qr_code TEXT NOT NULL UNIQUE,
        location TEXT,
        notes TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW(),
        updated_date TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create inventory_transactions table
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        action TEXT NOT NULL,
        scanned_code TEXT NOT NULL,
        sample_id TEXT,
        bundle_id TEXT,
        operator TEXT,
        checked_out_to TEXT,
        notes TEXT,
        created_date TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create indexes
    await client.queryObject`CREATE INDEX IF NOT EXISTS idx_samples_qr_code ON samples(qr_code)`;
    await client.queryObject`CREATE INDEX IF NOT EXISTS idx_samples_bundle_id ON samples(bundle_id)`;
    await client.queryObject`CREATE INDEX IF NOT EXISTS idx_bundles_qr_code ON bundles(qr_code)`;
    await client.queryObject`CREATE INDEX IF NOT EXISTS idx_transactions_sample_id ON inventory_transactions(sample_id)`;

    console.log("Database tables initialized successfully");
  } finally {
    client.release();
  }
}

// Helper to convert row to camelCase
function toCamelCase(obj: any): any {
  if (!obj) return obj;
  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// Helper to convert camelCase to snake_case
function toSnakeCase(obj: any): any {
  if (!obj) return obj;
  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}

// Database operations for Samples
export const Samples = {
  async list(orderBy = "-created_date") {
    const client = await getPool().connect();
    try {
      const order = orderBy.startsWith("-") ? "DESC" : "ASC";
      const field = orderBy.replace(/^-/, "");
      const result = await client.queryObject(
        `SELECT * FROM samples ORDER BY ${field} ${order}`
      );
      return result.rows.map(toCamelCase);
    } finally {
      client.release();
    }
  },

  async filter(filters: any, orderBy = "-created_date", limit?: number) {
    const client = await getPool().connect();
    try {
      const where: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(filters)) {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        where.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      const order = orderBy.startsWith("-") ? "DESC" : "ASC";
      const field = orderBy.replace(/^-/, "");

      let query = `SELECT * FROM samples`;
      if (where.length > 0) {
        query += ` WHERE ${where.join(" AND ")}`;
      }
      query += ` ORDER BY ${field} ${order}`;
      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const result = await client.queryObject(query, values);
      return result.rows.map(toCamelCase);
    } finally {
      client.release();
    }
  },

  async create(data: any) {
    const client = await getPool().connect();
    try {
      const snakeData = toSnakeCase(data);
      const keys = Object.keys(snakeData);
      const values = Object.values(snakeData);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

      const result = await client.queryObject(
        `INSERT INTO samples (${keys.join(", ")})
         VALUES (${placeholders})
         RETURNING *`,
        values
      );
      return toCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async update(id: string, data: any) {
    const client = await getPool().connect();
    try {
      const snakeData = toSnakeCase(data);
      const keys = Object.keys(snakeData);
      const values = Object.values(snakeData);
      const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(", ");

      const result = await client.queryObject(
        `UPDATE samples SET ${setClause}, updated_date = NOW() WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return toCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async delete(id: string) {
    const client = await getPool().connect();
    try {
      await client.queryObject(`DELETE FROM samples WHERE id = $1`, [id]);
    } finally {
      client.release();
    }
  },
};

// Database operations for Bundles
export const Bundles = {
  async list(orderBy = "-created_date") {
    const client = await getPool().connect();
    try {
      const order = orderBy.startsWith("-") ? "DESC" : "ASC";
      const field = orderBy.replace(/^-/, "");
      const result = await client.queryObject(
        `SELECT * FROM bundles ORDER BY ${field} ${order}`
      );
      return result.rows.map(toCamelCase);
    } finally {
      client.release();
    }
  },

  async filter(filters: any) {
    const client = await getPool().connect();
    try {
      const where: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(filters)) {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        where.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      let query = `SELECT * FROM bundles`;
      if (where.length > 0) {
        query += ` WHERE ${where.join(" AND ")}`;
      }

      const result = await client.queryObject(query, values);
      return result.rows.map(toCamelCase);
    } finally {
      client.release();
    }
  },

  async create(data: any) {
    const client = await getPool().connect();
    try {
      const snakeData = toSnakeCase(data);
      const keys = Object.keys(snakeData);
      const values = Object.values(snakeData);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

      const result = await client.queryObject(
        `INSERT INTO bundles (${keys.join(", ")})
         VALUES (${placeholders})
         RETURNING *`,
        values
      );
      return toCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async update(id: string, data: any) {
    const client = await getPool().connect();
    try {
      const snakeData = toSnakeCase(data);
      const keys = Object.keys(snakeData);
      const values = Object.values(snakeData);
      const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(", ");

      const result = await client.queryObject(
        `UPDATE bundles SET ${setClause}, updated_date = NOW() WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return toCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async delete(id: string) {
    const client = await getPool().connect();
    try {
      await client.queryObject(`DELETE FROM bundles WHERE id = $1`, [id]);
    } finally {
      client.release();
    }
  },
};

// Database operations for Inventory Transactions
export const InventoryTransactions = {
  async filter(filters: any, orderBy = "-created_date", limit?: number) {
    const client = await getPool().connect();
    try {
      const where: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(filters)) {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        where.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      const order = orderBy.startsWith("-") ? "DESC" : "ASC";
      const field = orderBy.replace(/^-/, "");

      let query = `SELECT * FROM inventory_transactions`;
      if (where.length > 0) {
        query += ` WHERE ${where.join(" AND ")}`;
      }
      query += ` ORDER BY ${field} ${order}`;
      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const result = await client.queryObject(query, values);
      return result.rows.map(toCamelCase);
    } finally {
      client.release();
    }
  },

  async create(data: any) {
    const client = await getPool().connect();
    try {
      const snakeData = toSnakeCase(data);
      const keys = Object.keys(snakeData);
      const values = Object.values(snakeData);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

      const result = await client.queryObject(
        `INSERT INTO inventory_transactions (${keys.join(", ")})
         VALUES (${placeholders})
         RETURNING *`,
        values
      );
      return toCamelCase(result.rows[0]);
    } finally {
      client.release();
    }
  },
};
