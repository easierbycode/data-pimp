// Base44 API Client for Deno Deploy
// This is a Deno-compatible implementation of the base44 API client

const API_BASE_URL = Deno.env.get("BASE44_API_URL") || "https://thirsty.store";
const API_KEY = Deno.env.get("BASE44_API_KEY") || "";

interface EntityRecord {
  id: string;
  created_date?: string;
  updated_date?: string;
  [key: string]: unknown;
}

interface FilterOptions {
  [key: string]: unknown;
}

class EntityClient<T extends EntityRecord> {
  constructor(private entityName: string) {}

  private async request(method: string, path: string, body?: unknown): Promise<T | T[]> {
    const url = `${API_BASE_URL}/entities/${this.entityName}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async list(orderBy?: string): Promise<T[]> {
    const query = orderBy ? `?order_by=${encodeURIComponent(orderBy)}` : "";
    return this.request("GET", query) as Promise<T[]>;
  }

  async filter(filters: FilterOptions, orderBy?: string, limit?: number): Promise<T[]> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    if (orderBy) {
      params.append("order_by", orderBy);
    }

    if (limit) {
      params.append("limit", String(limit));
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", query) as Promise<T[]>;
  }

  async get(id: string): Promise<T> {
    return this.request("GET", `/${id}`) as Promise<T>;
  }

  async create(data: Partial<T>): Promise<T> {
    return this.request("POST", "", data) as Promise<T>;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return this.request("PATCH", `/${id}`, data) as Promise<T>;
  }

  async delete(id: string): Promise<void> {
    await this.request("DELETE", `/${id}`);
  }
}

// Integration clients
const CoreIntegration = {
  async UploadFile({ file }: { file: File }): Promise<{ file_url: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_BASE_URL}/integrations/core/upload`;
    const headers: HeadersInit = {};

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};

// Entity type definitions based on Entities/*.json schemas
export interface Sample extends EntityRecord {
  name: string;
  brand: string;
  location?: string;
  qr_code: string;
  picture_url?: string;
  tiktok_affiliate_link?: string;
  fire_sale?: boolean;
  status: "available" | "checked_out" | "reserved" | "discontinued";
  current_price?: number;
  best_price?: number;
  best_price_source?: string;
  last_price_checked_at?: string;
  bundle_id?: string;
  checked_out_at?: string;
  checked_in_at?: string;
  checked_out_to?: string;
  notes?: string;
}

export interface Bundle extends EntityRecord {
  name: string;
  location?: string;
  qr_code: string;
  notes?: string;
}

export interface InventoryTransaction extends EntityRecord {
  action: "checkout" | "checkin" | "reserve" | "unreserve";
  sample_id?: string;
  bundle_id?: string;
  scanned_code: string;
  operator?: string;
  checked_out_to?: string;
  notes?: string;
}

// Main base44 client export
export const base44 = {
  entities: {
    Sample: new EntityClient<Sample>("Sample"),
    Bundle: new EntityClient<Bundle>("Bundle"),
    InventoryTransaction: new EntityClient<InventoryTransaction>("InventoryTransaction"),
  },
  integrations: {
    Core: CoreIntegration,
  },
};

export default base44;
