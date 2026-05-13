import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@workspace/db/schema";

neonConfig.webSocketConstructor = ws;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _pool: Pool | null = null;

function initDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  _pool = new Pool({ connectionString: url });
  _db = drizzle(_pool, { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (initDb() as any)[prop];
  },
}) as ReturnType<typeof drizzle<typeof schema>>;

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    if (!_pool) initDb();
    return (_pool as any)[prop];
  },
}) as Pool;
