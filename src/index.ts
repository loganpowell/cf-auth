/**
 * Main Cloudflare Worker entry point
 *
 * This worker handles all authentication and authorization requests
 * using the Hono framework with OpenAPI for automatic spec generation.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import type { Env } from "./types";

// Import OpenAPI route definitions
import {
  registerRoute,
  loginRoute,
  verifyEmailRoute,
  resendVerificationRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  getMeRoute,
  refreshRoute,
  logoutRoute,
} from "./schemas/auth.schema";

// Import handlers (now simplified - just business logic)
import { handleRegister } from "./handlers/register";
import { handleLogin } from "./handlers/login";
import { handleRefresh } from "./handlers/refresh";
import { handleLogout } from "./handlers/logout";
import { handleGetMe } from "./handlers/me";
import { handleVerifyEmail } from "./handlers/verify-email";
import { handleResendVerification } from "./handlers/resend-verification";
import { handleForgotPassword } from "./handlers/forgot-password";
import { handleResetPassword } from "./handlers/reset-password";

// Create OpenAPIHono app with typed environment
const app = new OpenAPIHono<{ Bindings: Env }>();

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

// Register OpenAPI routes with handlers
// These routes use the schemas from auth.schema.ts for validation and OpenAPI spec generation
app.openapi(registerRoute, handleRegister);
app.openapi(loginRoute, handleLogin);
app.openapi(verifyEmailRoute, handleVerifyEmail);
app.openapi(resendVerificationRoute, handleResendVerification);
app.openapi(forgotPasswordRoute, handleForgotPassword);
app.openapi(resetPasswordRoute, handleResetPassword);
app.openapi(getMeRoute, handleGetMe);
app.openapi(refreshRoute, handleRefresh);
app.openapi(logoutRoute, handleLogout);

// Generate OpenAPI spec endpoint
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "CF-Auth API",
    version: "0.3.0",
    description: "Authentication and authorization API for Cloudflare Workers",
  },
  servers: [
    {
      url: "https://auth-api.yourdomain.com",
      description: "Production",
    },
    {
      url: "http://localhost:8787",
      description: "Development",
    },
  ],
});

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
