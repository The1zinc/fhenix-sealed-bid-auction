import { neon } from "@neondatabase/serverless";

/**
 * Returns a Neon SQL tagged-template function bound to the
 * STORAGE_URL (set by the Vercel × Neon integration) or
 * DATABASE_URL as a fallback.
 *
 * Usage in API routes:
 *   const sql = getDb();
 *   const rows = await sql`SELECT * FROM auctions`;
 */
export function getDb() {
  const url =
    process.env.STORAGE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";

  if (!url) {
    throw new Error(
      "No database URL found. Set STORAGE_URL, DATABASE_URL, or POSTGRES_URL in .env.local."
    );
  }

  return neon(url);
}

/** True when any database connection string is configured. */
export const isDbConfigured = Boolean(
  process.env.STORAGE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
);
