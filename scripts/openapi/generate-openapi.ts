/**
 * OpenAPI Spec Generator
 *
 * Generates openapi.json specification from Zod schemas
 * Uses @hono/zod-openapi to properly convert Zod schemas to OpenAPI format
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import * as fs from "fs";
import * as path from "path";
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
} from "../../src/schemas/auth.schema";

// Create OpenAPI app
const app = new OpenAPIHono();

// Register all routes (handlers are just stubs for spec generation)
app.openapi(registerRoute, async (c) => {
  return c.json(
    { message: "", user: { id: "", email: "", displayName: "" } },
    201
  );
});

app.openapi(loginRoute, async (c) => {
  return c.json(
    {
      message: "",
      accessToken: "",
      user: { id: "", email: "", displayName: "", emailVerified: false },
    },
    200
  );
});

app.openapi(verifyEmailRoute, async (c) => {
  return c.json({ message: "" }, 200);
});

app.openapi(resendVerificationRoute, async (c) => {
  return c.json({ message: "" }, 200);
});

app.openapi(forgotPasswordRoute, async (c) => {
  return c.json({ message: "" }, 200);
});

app.openapi(resetPasswordRoute, async (c) => {
  return c.json({ message: "" }, 200);
});

app.openapi(getMeRoute, async (c) => {
  return c.json(
    {
      user: {
        id: "",
        email: "",
        displayName: "",
        avatarUrl: null,
        emailVerified: false,
        createdAt: "",
        updatedAt: "",
        lastLoginAt: null,
        status: "active" as const,
        mfaEnabled: false,
      },
    },
    200
  );
});

app.openapi(refreshRoute, async (c) => {
  return c.json({ accessToken: "" }, 200);
});

app.openapi(logoutRoute, async (c) => {
  return c.json({ message: "" }, 200);
});

// Use the built-in method to get the properly formatted OpenAPI spec
// This converts Zod schemas to proper JSON Schema format
const spec = app.getOpenAPIDocument({
  openapi: "3.1.0",
  info: {
    title: "Authentication API",
    version: "0.3.0",
    description:
      "Cloudflare Workers-based authentication service with JWT tokens, email verification, and password reset",
  },
  servers: [
    {
      url: "http://localhost:8787",
      description: "Local development server",
    },
  ],
});

// Add security schemes to components
if (!spec.components) {
  spec.components = {};
}
spec.components.securitySchemes = {
  Bearer: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "JWT access token from /v1/auth/login endpoint",
  } as any,
};

// Write to file
const outputPath = path.join(process.cwd(), "openapi.json");
fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

console.log(`✅ OpenAPI spec generated: ${outputPath}`);
console.log(`📄 Spec version: ${spec.info.version}`);
console.log(`🔗 Endpoints: ${Object.keys(spec.paths || {}).length}`);
