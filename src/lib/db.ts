import { Pool } from "pg";
import { getConfig } from "./config";

// One pool per server process. DATABASE_URL is supplied by the platform
// (Secret dashr-nova-db, synced from OpenBao).
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.pgPool) {
    const config = getConfig();
    globalForPg.pgPool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });
  }
  return globalForPg.pgPool;
}
