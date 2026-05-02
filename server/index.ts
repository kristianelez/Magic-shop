import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import { Pool } from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed";
import { neonPool } from "./storage";

const app = express();

// gzip/deflate sve odgovore (HTML, JS, CSS, JSON). Najveći dobitak je na
// /api/sales i /api/customers koji znaju biti par stotina KB JSON-a — sa
// gzipom se to spušta na ~10-20% originalne veličine i prijenos je puno brži.
app.use(compression());

// Replit always serves the dev preview and the published app through an HTTPS
// reverse proxy, and the workspace embeds the preview in a cross-origin iframe.
// We treat any Replit-hosted environment as "behind a proxy" and use cross-site
// cookies so the session works inside the workspace iframe as well.
const isReplitHosted =
  process.env.REPLIT_DEPLOYMENT === "1" ||
  process.env.NODE_ENV === "production" ||
  !!process.env.REPL_ID;

if (isReplitHosted) {
  app.set('trust proxy', 1);
}

const PgSession = connectPgSimple(session);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for secure session management");
}

const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Eksplicitno garantira da "session" tablica postoji prije nego što server
// počne primati zahtjeve. Iako je u PgSession setup-u već postavljen
// `createTableIfMissing: true`, taj mehanizam se zna ne pokrenuti (npr.
// kad korisnik baze nema CREATE pravo u trenutnom search_path-u, ili kad
// post-merge `db:push` u međuvremenu obriše tablicu). Ovaj idempotentni
// CREATE TABLE IF NOT EXISTS nas štiti u svim tim scenarijima.
async function ensureSessionTable() {
  try {
    await sessionPool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);
    await sessionPool.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`,
    );
    log("session table ensured");
  } catch (err) {
    console.error("FATAL: failed to ensure session table:", err);
    throw err;
  }
}

app.use(
  session({
    store: new PgSession({
      pool: sessionPool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // On Replit (dev preview iframe + published HTTPS app) the cookie must be
      // SameSite=None + Secure so the browser allows it inside the workspace
      // iframe and over the HTTPS reverse proxy.
      secure: isReplitHosted,
      httpOnly: true,
      sameSite: isReplitHosted ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Mora se izvršiti prije nego server.listen() počne primati zahtjeve.
  // Session middleware je već registrovan na top-level, ali on će tablicu
  // dirnuti tek kad stigne prvi HTTP request, a do tada mi smo CREATE već
  // pustili.
  await ensureSessionTable();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Run seed and DB warm-up in background after server is ready
    seedDatabase().catch(err => console.error("Seed error:", err));

    // Warm up Neon WebSocket connection with a lightweight ping
    neonPool.query("SELECT 1").catch(() => {});
  });
})();
