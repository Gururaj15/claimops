import { Pool } from "pg";

/**
 * Real hosted Postgres (Supabase or any other Postgres provider), read from
 * DATABASE_URL. This replaced the SQLite version used during local
 * development — SQLite doesn't persist reliably on Vercel because
 * serverless functions get an ephemeral filesystem, so every deployed
 * environment needs a real database server, not a file on disk.
 *
 * Run supabase/schema.sql once against your Postgres instance (Supabase's
 * SQL Editor, or `psql $DATABASE_URL -f supabase/schema.sql`) before
 * starting the app — this file only opens a connection, it does not create
 * tables.
 */
const globalForDb = globalThis as unknown as { __claimops_pool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__claimops_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (local dev) or your hosting provider's environment variables (deployed)."
      );
    }
    globalForDb.__claimops_pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return globalForDb.__claimops_pool;
}
