import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Plesk terminates HTTPS in front of the container. Trust its proxy headers so
// Express can correctly determine the original protocol/client connection.
app.set("trust proxy", 1);

// Lightweight liveness endpoint for Docker health checks and reverse-proxy tests.
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(compression());
app.use(express.json({ limit: '100mb' }));
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

  // Track raw (uncompressed) response size so we can warn before hitting
  // the 32 MiB Cloud Run / autoscale gateway limit that silently turns
  // oversized responses into 500s on the client.
  const RESPONSE_SIZE_WARN_BYTES = 8 * 1024 * 1024; // 8 MiB
  const RESPONSE_SIZE_HARD_BYTES = 25 * 1024 * 1024; // 25 MiB
  let rawResponseBytes = 0;
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  res.write = function (chunk: any, ...args: any[]) {
    if (chunk) rawResponseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    return (originalWrite as any)(chunk, ...args);
  };
  res.end = function (chunk: any, ...args: any[]) {
    if (chunk) rawResponseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    return (originalEnd as any)(chunk, ...args);
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

      if (rawResponseBytes >= RESPONSE_SIZE_HARD_BYTES) {
        console.error(
          `[RESPONSE-SIZE] CRITICAL ${req.method} ${path} returned ${(rawResponseBytes / 1024 / 1024).toFixed(1)} MiB ` +
          `— approaching the 32 MiB autoscale gateway limit. Paginate or slim this endpoint immediately.`,
        );
      } else if (rawResponseBytes >= RESPONSE_SIZE_WARN_BYTES) {
        console.warn(
          `[RESPONSE-SIZE] WARN ${req.method} ${path} returned ${(rawResponseBytes / 1024 / 1024).toFixed(1)} MiB ` +
          `(uncompressed). Consider pagination or slimmer payloads.`,
        );
      }
    }
  });

  next();
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

  // The container listens internally on PORT (5000 by default). Docker/Plesk
  // maps that to whichever host port is selected in docker-compose.yml.
  const port = Number.parseInt(process.env.PORT || "5000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
