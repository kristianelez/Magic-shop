import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase, quickBaselineCheck } from "./seed";

const app = express();

// Trust Replit's reverse proxy for secure cookies in published deployments
if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
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
      // Set secure: true for published Replit apps (HTTPS) and production deployments
      secure: process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
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

// Track if baseline data is ready for API traffic
let baselineReady = false;
let seedingState: 'ready' | 'initializing' | 'failed' = 'initializing';

// Health check endpoint - MUST be before registerRoutes() to avoid catch-all route
// Always returns 200 OK if server is listening (deployment health checks pass immediately)
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    ready: baselineReady,
    seeding: seedingState,
    timestamp: new Date().toISOString() 
  });
});

// Gate API traffic until baseline data exists
app.use((req, res, next) => {
  // Always allow health checks
  if (req.path === '/health') {
    return next();
  }
  
  // If baseline ready, allow all traffic
  if (baselineReady) {
    return next();
  }
  
  // Block API traffic until seeding completes
  return res.status(503).json({
    message: 'Application initializing - please wait',
    status: 'initializing'
  });
});

(async () => {
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
  }, async () => {
    log(`serving on port ${port}`);
    
    try {
      // Quick baseline check (< 1s) - verify minimum data exists
      const baseline = await quickBaselineCheck();
      
      if (baseline.exists) {
        // Baseline exists → API traffic allowed immediately
        baselineReady = true;
        seedingState = 'ready';
        log(`✓ Baseline data verified (users: ${baseline.users}, products: ${baseline.products}, customers: ${baseline.customers})`);
        log('✓ Application ready');
        
        // Optional: run background seed for updates/additions
        seedDatabase().catch(err => {
          log('Background seed update failed (non-critical):', err.message);
        });
      } else {
        // Baseline missing → seed in background, block API until ready
        seedingState = 'initializing';
        log(`⚠ Baseline data incomplete (users: ${baseline.users}, products: ${baseline.products}, customers: ${baseline.customers})`);
        log('⏳ Seeding database in background - API traffic blocked until complete...');
        
        seedDatabase()
          .then(async () => {
            // Re-verify baseline after seeding
            const postSeed = await quickBaselineCheck();
            if (postSeed.exists) {
              baselineReady = true;
              seedingState = 'ready';
              log('✓ Database seeded successfully - application ready');
            } else {
              seedingState = 'failed';
              log('❌ Seeding completed but baseline still incomplete - API traffic remains blocked');
            }
          })
          .catch(error => {
            seedingState = 'failed';
            console.error("\n❌ CRITICAL: Database seeding failed");
            console.error("Error details:", error);
            console.error("\nAPI traffic will remain blocked.");
            console.error("You can manually seed the database by running:");
            console.error("  tsx server/import-greentime-products.ts");
            console.error("  tsx server/import-customers.ts\n");
          });
      }
    } catch (error) {
      // Database connection error during baseline check
      seedingState = 'failed';
      console.error("\n❌ CRITICAL: Failed to check baseline data");
      console.error("Error details:", error);
      console.error("\nThis likely indicates a database connection problem.");
      console.error("API traffic will remain blocked until the issue is resolved.\n");
    }
  });
})();
