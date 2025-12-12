/**
 * Main Cloudflare Worker entry point
 *
 * This worker handles all authentication and authorization requests
 * using the Hono framework for routing.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";

// Import handlers
import { handleRegister } from "./handlers/register";
import { handleLogin } from "./handlers/login";
import { handleRefresh } from "./handlers/refresh";
import { handleLogout } from "./handlers/logout";
import { handleGetMe } from "./handlers/me";
import verifyEmailHandler from "./handlers/verify-email";
import resendVerificationHandler from "./handlers/resend-verification";
import { handleForgotPassword } from "./handlers/forgot-password";
import { handleResetPassword } from "./handlers/reset-password";

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// Global CORS middleware
app.use(
  "/*",
  cors({
    origin: (origin) => {
      // TODO: Implement dynamic CORS based on domain_configs table
      return origin;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    version: "0.3.0", // Phase 3 - Password Reset
  });
});

// API v1 routes
const v1 = new Hono<{ Bindings: Env }>();

// Auth routes (Phase 2 - Core Authentication)
v1.post("/auth/register", handleRegister);
v1.post("/auth/login", handleLogin);
v1.post("/auth/refresh", handleRefresh);
v1.post("/auth/logout", handleLogout);
v1.get("/auth/me", handleGetMe);

// Email verification routes
v1.route("/auth/verify-email", verifyEmailHandler);
v1.route("/auth/resend-verification", resendVerificationHandler);

// Password reset routes (Phase 3)
v1.post("/auth/forgot-password", handleForgotPassword);
v1.post("/auth/reset-password", handleResetPassword);

// Mount v1 routes
app.route("/v1", v1);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "The requested endpoint does not exist",
      path: c.req.path,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

export default app;
