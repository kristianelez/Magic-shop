import { createServer } from "http";
import app, { sessionPool } from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import { seedDatabase } from "./seed";
import { logEmailStatus } from "./email";
import { logPushStatus } from "./push";
import { neonPool } from "./storage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSessionTable() {
  try {
    await sessionPool.query(`
      CREATE TABLE IF NOT EXISTS "public"."session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);
    await sessionPool.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "public"."session" ("expire")`,
    );
    logger.info("session table ensured");
  } catch (err) {
    logger.error({ err }, "FATAL: failed to ensure session table");
    throw err;
  }
}

(async () => {
  await ensureSessionTable();

  logEmailStatus();
  logPushStatus();

  // registerRoutes registers all app routes and returns an http.Server
  const httpServer = await registerRoutes(app);

  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    logger.error({ err }, "Unhandled error");
  });

  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => {
      logger.info({ port }, "Server listening");
      seedDatabase().catch((err) => logger.error({ err }, "Seed error"));
      neonPool.query("SELECT 1").catch(() => {});
    },
  );
})();
