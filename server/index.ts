import crypto from "node:crypto";
import { createServer } from "node:http";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import { redactSensitiveData } from "./lib/security.js";
import deployRoutes from "./routes/deploy.js";
import githubRoutes from "./routes/github.js";
import healthRoutes from "./routes/health.js";
import sourcesRoutes from "./routes/sources.js";
import userRoutes from "./routes/user.js";

// Validate required environment variables at startup
function validateEnvironment(): void {
  const required = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "OPENAI_API_KEY"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn("⚠️  Missing environment variables (some features will be unavailable):");
    for (const key of missing) {
      console.warn(`   - ${key}`);
    }
    console.warn("   See .env.example for reference.\n");
  }

  // Validate optional but recommended variables
  const recommended = ["APP_URL", "OPENAI_API_MODEL"];
  const missingRecommended = recommended.filter((key) => !process.env[key]);

  if (missingRecommended.length > 0) {
    console.warn("⚠️  Optional environment variables not set:");
    for (const key of missingRecommended) {
      console.warn(`   - ${key}`);
    }
    console.warn("   Using default values.\n");
  }

  console.log("✅ Environment validation passed\n");
}

// Validate environment before starting server
validateEnvironment();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request ID for tracing
app.use((req, res, next) => {
  // Use existing request ID from header or generate new one
  const requestId =
    (req.headers["x-request-id"] as string) || `req_${Date.now()}_${crypto.randomUUID()}`;

  // Store on request and response
  (req as any).id = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
});

// Add security headers
app.use((_req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy (basic)
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
    );
  }

  // HSTS (only in production)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

// Add CORS headers
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  // Define allowed origins based on environment
  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? [process.env.APP_URL].filter(Boolean)
      : ["http://localhost:5000", "http://localhost:5173"]; // Vite dev server

  // Check if request origin is allowed
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (process.env.NODE_ENV === "development") {
    // In development, echo back the request origin (or allow any)
    // Use the specific origin to remain compatible with credentials
    if (requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  }
  // In production, if origin not allowed, don't set the header (request will be rejected)

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

async function registerRoutes(app: Express) {
  const router = Router();
  router.use(healthRoutes);
  router.use(githubRoutes);
  router.use(deployRoutes);
  router.use(userRoutes);
  router.use("/api/sources", sourcesRoutes);
  app.use(router);
  const httpServer = createServer(app);
  return httpServer;
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = (req as any).id;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = (bodyJson, ...args) => {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `[${requestId}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const redactedResponse = redactSensitiveData(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(redactedResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = `${logLine.slice(0, 79)}…`;
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Configure request timeout to prevent hanging connections
  const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10);
  server.setTimeout(REQUEST_TIMEOUT_MS);

  server.on("timeout", (socket) => {
    console.warn("Request timeout", {
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
      timestamp: new Date().toISOString(),
    });
    socket.destroy();
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId =
      (req as any).id || res.getHeader("X-Request-ID") || req.headers["x-request-id"] || "unknown";

    // Log error with full context for debugging and monitoring
    // In production, consider integrating with error tracking services (e.g., Sentry)
    console.error("Unhandled error:", {
      requestId,
      status,
      message,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers["user-agent"],
      stack: err.stack,
      timestamp: new Date().toISOString(),
      // Include error name and code if available
      errorName: err.name,
      errorCode: err.code,
    });

    // Send sanitized error response to client (don't expose internal details)
    res.status(status).json({
      message: status >= 500 ? "Internal Server Error" : message,
      requestId,
    });
  });

  // In production, serve static files from the dist directory
  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist/public"));
    // Serve index.html for client-side routing
    app.get("/{*path}", (_req, res) => {
      res.sendFile("dist/public/index.html", { root: "." });
    });
  } else {
    // Only import and setup Vite in development
    const { setupVite } = await import("./vite.ts");
    await setupVite(app, server);
  }

  const port = Number(process.env.PORT ?? 5000);
  server.listen(port, "0.0.0.0", () => {
    const address = server.address();
    console.log(`serving on port ${typeof address === "object" ? address?.port : port}`);
  });
})();
