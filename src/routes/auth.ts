/**
 * Authentication Routes for End-User Authentication
 *
 * Provides endpoints for:
 * - User registration
 * - User login
 * - User logout
 * - Session validation
 * - Password reset (future)
 * - Email verification (future)
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateSessionToken,
  isValidEmail,
  isStrongPassword,
} from "../lib/auth";

// Type for the JWT secret from environment
type AuthEnv = Env & {
  JWT_SECRET: string;
};

// ============================================================================
// Schema Definitions
// ============================================================================

const RegisterRequestSchema = z.object({
  email: z.string().email().openapi({ example: "user@example.com" }),
  password: z.string().min(8).openapi({ example: "SecurePass123" }),
  name: z.string().optional().openapi({ example: "John Doe" }),
  username: z.string().optional().openapi({ example: "johndoe" }),
});

const LoginRequestSchema = z.object({
  email: z.string().email().openapi({ example: "user@example.com" }),
  password: z.string().openapi({ example: "SecurePass123" }),
});

const AuthResponseSchema = z.object({
  success: z.boolean(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      username: z.string().nullable(),
      emailVerified: z.boolean(),
    })
    .optional(),
  token: z.string().optional(),
  session: z
    .object({
      id: z.string(),
      expiresAt: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

const ValidateSessionResponseSchema = z.object({
  valid: z.boolean(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      tenantId: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

const LogoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============================================================================
// Routes
// ============================================================================

const app = new OpenAPIHono<{ Bindings: AuthEnv }>();

// ============================================================================
// POST /auth/register - Register a new user
// ============================================================================

const registerRoute = createRoute({
  method: "post",
  path: "/register",
  tags: ["Authentication"],
  summary: "Register a new user",
  description: "Create a new user account for a tenant",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterRequestSchema,
        },
      },
    },
    headers: z.object({
      "x-tenant-id": z.string().openapi({
        description: "Tenant ID for the user",
        example: "tenant_000",
      }),
    }),
  },
  responses: {
    201: {
      description: "User successfully registered",
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
    },
  },
});

app.openapi(registerRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { email, password, name, username } = c.req.valid("json");
  const tenantId = c.req.header("x-tenant-id");

  if (!tenantId) {
    return c.json(
      { success: false, error: "Tenant ID required" } as const,
      400
    );
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return c.json(
      { success: false, error: "Invalid email format" } as const,
      400
    );
  }

  // Validate password strength
  const passwordCheck = isStrongPassword(password);
  if (!passwordCheck.valid) {
    return c.json(
      {
        success: false,
        error: passwordCheck.message || "Password validation failed",
      } as const,
      400
    );
  }

  // Check if tenant exists
  const tenant = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();

  if (!tenant) {
    return c.json({ success: false, error: "Tenant not found" } as const, 400);
  }

  // Check if user already exists
  const existingUser = await db
    .select()
    .from(schema.tenantUsers)
    .where(
      and(
        eq(schema.tenantUsers.tenantId, tenantId),
        eq(schema.tenantUsers.email, email.toLowerCase())
      )
    )
    .get();

  if (existingUser) {
    return c.json(
      { success: false, error: "User already exists" } as const,
      400
    );
  }

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create user ID
  const userId = `user:${tenantId}:${crypto.randomUUID()}`;

  // Insert user
  const now = Date.now();
  await db.insert(schema.tenantUsers).values({
    id: userId,
    tenantId,
    email: email.toLowerCase(),
    username,
    name,
    passwordHash,
    emailVerified: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  // Generate JWT token
  const jwtSecret = c.env.JWT_SECRET || "default-secret-change-in-production";
  const token = await generateToken(userId, tenantId, jwtSecret);

  // Create session
  const sessionId = `session:${crypto.randomUUID()}`;
  const sessionToken = generateSessionToken();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  await db.insert(schema.tenantUserSessions).values({
    id: sessionId,
    sessionToken,
    userId,
    tenantId,
    expiresAt,
    createdAt: now,
    lastActivityAt: now,
  });

  return c.json(
    {
      success: true,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: name || null,
        username: username || null,
        emailVerified: false,
      },
      token,
      session: {
        id: sessionId,
        expiresAt,
      },
    },
    201
  );
});

// ============================================================================
// POST /auth/login - Login with email and password
// ============================================================================

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Authentication"],
  summary: "Login with credentials",
  description: "Authenticate a user and create a session",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
        },
      },
    },
    headers: z.object({
      "x-tenant-id": z.string().openapi({
        description: "Tenant ID for the user",
        example: "tenant_000",
      }),
    }),
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
    },
  },
});

app.openapi(loginRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { email, password } = c.req.valid("json");
  const tenantId = c.req.header("x-tenant-id");

  if (!tenantId) {
    return c.json(
      { success: false, error: "Tenant ID required" } as const,
      401
    );
  }

  // Find user
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(
      and(
        eq(schema.tenantUsers.tenantId, tenantId),
        eq(schema.tenantUsers.email, email.toLowerCase())
      )
    )
    .get();

  if (!user) {
    return c.json(
      { success: false, error: "Invalid credentials" } as const,
      401
    );
  }

  // Check if user is active
  if (user.status !== "active") {
    return c.json(
      { success: false, error: "Account is not active" } as const,
      401
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json(
      { success: false, error: "Invalid credentials" } as const,
      401
    );
  }

  // Update last login
  const now = Date.now();
  await db
    .update(schema.tenantUsers)
    .set({ lastLoginAt: now })
    .where(eq(schema.tenantUsers.id, user.id));

  // Generate JWT token
  const jwtSecret = c.env.JWT_SECRET || "default-secret-change-in-production";
  const token = await generateToken(user.id, tenantId, jwtSecret);

  // Create session
  const sessionId = `session:${crypto.randomUUID()}`;
  const sessionToken = generateSessionToken();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  const ipAddress = c.req.header("cf-connecting-ip") || null;
  const userAgent = c.req.header("user-agent") || null;

  await db.insert(schema.tenantUserSessions).values({
    id: sessionId,
    sessionToken,
    userId: user.id,
    tenantId,
    ipAddress,
    userAgent,
    expiresAt,
    createdAt: now,
    lastActivityAt: now,
  });

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      emailVerified: user.emailVerified,
    },
    token,
    session: {
      id: sessionId,
      expiresAt,
    },
  });
});

// ============================================================================
// POST /auth/logout - Logout and invalidate session
// ============================================================================

const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Authentication"],
  summary: "Logout user",
  description: "Invalidate user session",
  request: {
    headers: z.object({
      authorization: z.string().openapi({
        description: "Bearer JWT token",
        example: "Bearer eyJhbGc...",
      }),
    }),
  },
  responses: {
    200: {
      description: "Logout successful",
      content: {
        "application/json": {
          schema: LogoutResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: LogoutResponseSchema,
        },
      },
    },
  },
});

app.openapi(logoutRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, message: "No token provided" }, 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || "default-secret-change-in-production";
  const decoded = await verifyToken(token, jwtSecret);

  if (!decoded) {
    return c.json({ success: false, message: "Invalid token" }, 401);
  }

  // Delete all sessions for this user
  await db
    .delete(schema.tenantUserSessions)
    .where(eq(schema.tenantUserSessions.userId, decoded.userId));

  return c.json({
    success: true,
    message: "Logged out successfully",
  });
});

// ============================================================================
// GET /auth/validate - Validate session/token
// ============================================================================

const validateRoute = createRoute({
  method: "get",
  path: "/validate",
  tags: ["Authentication"],
  summary: "Validate session",
  description: "Check if a JWT token is valid and get user info",
  request: {
    headers: z.object({
      authorization: z.string().openapi({
        description: "Bearer JWT token",
        example: "Bearer eyJhbGc...",
      }),
    }),
  },
  responses: {
    200: {
      description: "Validation result",
      content: {
        "application/json": {
          schema: ValidateSessionResponseSchema,
        },
      },
    },
  },
});

app.openapi(validateRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ valid: false, error: "No token provided" });
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || "default-secret-change-in-production";
  const decoded = await verifyToken(token, jwtSecret);

  if (!decoded) {
    return c.json({ valid: false, error: "Invalid token" });
  }

  // Get user info
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.id, decoded.userId))
    .get();

  if (!user || user.status !== "active") {
    return c.json({ valid: false, error: "User not found or inactive" });
  }

  return c.json({
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
    },
  });
});

// ============================================================================
// Export router
// ============================================================================

export function createAuthRouter() {
  return app;
}
