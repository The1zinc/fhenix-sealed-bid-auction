// Unified Database Client substituting Supabase with Neon Serverless Postgres
// and providing seamless LocalStorage fallback for zero-config local development.

export type AuctionTypeSlug = "sealed" | "english" | "dutch";

export type AuctionRow = {
  id: string;
  contract_auction_id: number;
  seller_address: string;
  auction_type: AuctionTypeSlug;
  title: string;
  description: string | null;
  image_url: string | null;
  start_price: number | string | null;
  reserve_price: number | string | null;
  token_unit: string;
  end_time: string;
  created_at: string | null;
  updated_at: string | null;
};

export type AuctionInsert = {
  contract_auction_id: number;
  seller_address: string;
  auction_type: AuctionTypeSlug;
  title: string;
  description?: string | null;
  image_url?: string | null;
  start_price?: number;
  reserve_price?: number;
  token_unit?: string;
  end_time: string;
};

export type AuctionUpdate = Partial<
  Pick<AuctionRow, "title" | "description" | "image_url" | "start_price" | "reserve_price" | "updated_at">
>;

export type BidRow = {
  id: string;
  auction_id: string | null;
  bidder_address: string;
  tx_hash: string | null;
  placed_at: string | null;
};

export type BidInsert = {
  auction_id: string;
  bidder_address: string;
  tx_hash?: string | null;
};

// Global reactive fallback state
export let isUsingLocalStorageFallback = true;
export const isSupabaseConfigured = true;

let resolveDbStatus: (value: boolean) => void = () => {};
export const dbStatusPromise = new Promise<boolean>((resolve) => {
  resolveDbStatus = resolve;
});

// 1. LocalStorage Query Builder & Client (original fallback implementation)
class LocalStorageQueryBuilder {
  private table: string;
  private filterCol: string | null = null;
  private filterVal: any = null;
  private orderCol: string | null = null;
  private orderAscending = false;
  private isSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    return this;
  }

  eq(column: string, value: any) {
    this.filterCol = column;
    this.filterVal = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAscending = options?.ascending ?? false;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private getItems(): any[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`sealed_bid_demo_${this.table}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveItems(items: any[]) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`sealed_bid_demo_${this.table}`, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }

  then(onfulfilled: (value: any) => any) {
    let items = this.getItems();

    if (this.filterCol !== null) {
      items = items.filter((item: any) => String(item[this.filterCol!]) === String(this.filterVal));
    }

    if (this.orderCol !== null) {
      items.sort((a: any, b: any) => {
        const valA = a[this.orderCol!];
        const valB = b[this.orderCol!];
        if (valA < valB) return this.orderAscending ? -1 : 1;
        if (valA > valB) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    let data: any = items;
    let error: any = null;

    if (this.isSingle) {
      data = items.length > 0 ? items[0] : null;
      if (!data) {
        error = { message: `Row not found in ${this.table}` };
      }
    }

    return Promise.resolve(onfulfilled({ data, error }));
  }

  insert(data: any) {
    const items = this.getItems();
    const newItems = Array.isArray(data) ? data : [data];

    const prepared = newItems.map(item => {
      const id = item.id || Math.random().toString(36).substring(2, 15);
      return {
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        placed_at: new Date().toISOString(),
        ...item
      };
    });

    this.saveItems([...prepared, ...items]);

    const chainable = {
      select: () => ({
        single: () => Promise.resolve({ data: prepared[0], error: null }),
        then: (onfulfilled: any) => Promise.resolve(onfulfilled({ data: prepared, error: null }))
      }),
      then: (onfulfilled: any) => Promise.resolve(onfulfilled({ data: prepared, error: null }))
    };
    return chainable;
  }
}

// 2. Neon API Query Builder & Client (talking to Next.js API endpoints `/api/auctions` & `/api/bids`)
class ApiQueryBuilder {
  private table: string;
  private filterCol: string | null = null;
  private filterVal: any = null;
  private orderCol: string | null = null;
  private orderAscending = false;
  private isSingle = false;
  private isInsert = false;
  private insertData: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    return this;
  }

  eq(column: string, value: any) {
    this.filterCol = column;
    this.filterVal = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAscending = options?.ascending ?? false;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.insertData = data;
    return this;
  }

  async then(onfulfilled: (value: any) => any) {
    try {
      // If we already know we are using LocalStorage fallback, skip API call
      if (isUsingLocalStorageFallback) {
        throw new Error("Local storage mode active");
      }

      let url = `/api/${this.table}`;
      let method = "GET";
      let body: string | undefined = undefined;

      if (this.isInsert) {
        method = "POST";
        body = JSON.stringify(this.insertData);
      } else {
        const params = new URLSearchParams();
        if (this.table === "auctions" && this.filterCol === "id") {
          params.append("id", String(this.filterVal));
        } else if (this.table === "bids" && this.filterCol === "auction_id") {
          params.append("auction_id", String(this.filterVal));
        }
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const result = await res.json();
      
      // If the backend returns that database is not configured, trigger fallback
      if (result.error?.message?.includes("not configured") || result.error?.message?.includes("No database URL")) {
        throw new Error("Database not configured on server");
      }

      // Success
      return Promise.resolve(onfulfilled(result));
    } catch (err: any) {
      console.log(`API DB query failed/unconfigured, falling back to LocalStorage:`, err?.message);
      
      // Execute the query using LocalStorage fallback
      const fallbackBuilder = new LocalStorageQueryBuilder(this.table);
      if (this.isInsert) {
        return fallbackBuilder.insert(this.insertData).then(onfulfilled);
      } else {
        let b = fallbackBuilder.select();
        if (this.filterCol) b = b.eq(this.filterCol, this.filterVal);
        if (this.orderCol) b = b.order(this.orderCol, { ascending: this.orderAscending });
        if (this.isSingle) b = b.single();
        return b.then(onfulfilled);
      }
    }
  }
}

class DeferredQueryBuilder {
  private table: string;
  private chain: Array<{ method: string; args: any[] }> = [];

  constructor(table: string) {
    this.table = table;
  }

  select(...args: any[]) {
    this.chain.push({ method: "select", args });
    return this;
  }

  eq(...args: any[]) {
    this.chain.push({ method: "eq", args });
    return this;
  }

  order(...args: any[]) {
    this.chain.push({ method: "order", args });
    return this;
  }

  single(...args: any[]) {
    this.chain.push({ method: "single", args });
    return this;
  }

  insert(...args: any[]) {
    this.chain.push({ method: "insert", args });
    return this;
  }

  async then(onfulfilled: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      await dbStatusPromise;
      let builder: any;
      if (typeof window === "undefined" || isUsingLocalStorageFallback) {
        builder = new LocalStorageQueryBuilder(this.table);
      } else {
        builder = new ApiQueryBuilder(this.table);
      }

      for (const call of this.chain) {
        builder = builder[call.method](...call.args);
      }

      const result = await builder;
      return onfulfilled(result);
    } catch (err) {
      if (onrejected) {
        return onrejected(err);
      }
      throw err;
    }
  }
}

class UnifiedDatabaseClient {
  from(table: string) {
    return new DeferredQueryBuilder(table);
  }
}

// Instantiate client
export const supabase: any = new UnifiedDatabaseClient();

// Asynchronously determine database configuration status on startup
if (typeof window !== "undefined") {
  fetch("/api/db-status")
    .then((res) => res.json())
    .then((data) => {
      isUsingLocalStorageFallback = !data.configured;
      console.log(`[Database Client] Mode: ${isUsingLocalStorageFallback ? "LocalStorage (Fallback)" : "Neon Postgres (Connected)"}`);
      resolveDbStatus(isUsingLocalStorageFallback);
    })
    .catch((err) => {
      console.error("[Database Client] Failed to fetch db-status, using LocalStorage fallback:", err);
      isUsingLocalStorageFallback = true;
      resolveDbStatus(true);
    });
} else {
  isUsingLocalStorageFallback = true;
  resolveDbStatus(true);
}
