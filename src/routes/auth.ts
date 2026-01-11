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
  accessToken: z
    .string()
    .optional()
    .openapi({ description: "JWT access token" }),
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
  let tenant = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .get();

  // Auto-create tenant in development if it doesn't exist
  if (!tenant && c.env.ENVIRONMENT !== "production") {
    console.log(`🛠️ Auto-creating tenant ${tenantId} for development`);

    // Generate simple API keys for development
    const publicKey = `pk_dev_${tenantId}`;
    const secretKey = `sk_dev_${tenantId}_${Date.now()}`;

    await db.insert(schema.tenants).values({
      id: tenantId,
      slug: tenantId.replace("tenant_", ""),
      name: `Dev Tenant ${tenantId}`,
      plan: "free",
      publicKey,
      secretKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    tenant = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .get();
  }

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

  // Generate and send email verification token
  const verificationToken = crypto.randomUUID();
  const tokenExpiry = now + 24 * 60 * 60 * 1000; // 24 hours

  await db.insert(schema.verificationTokens).values({
    identifier: email.toLowerCase(),
    token: verificationToken,
    expiresAt: tokenExpiry,
    createdAt: now,
  });

  // Send verification email (skip in development or log it)
  if (c.env.ENVIRONMENT === "production") {
    try {
      const { sendVerificationEmail } = await import(
        "../services/email/ses.service"
      );
      await sendVerificationEmail(email, verificationToken, c.env);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Don't fail registration if email fails
    }
  } else {
    console.log("📧 [DEV] Verification email would be sent to:", email);
    console.log("📧 [DEV] Verification token:", verificationToken);
    console.log(
      "📧 [DEV] Verification URL:",
      `http://localhost:5173/verify-email?token=${verificationToken}`
    );
  }

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
      accessToken: token,
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
    accessToken: token,
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
// GET /auth/me - Get current user
// ============================================================================

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Authentication"],
  summary: "Get current user",
  description: "Get the authenticated user's information",
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
      description: "User information",
      content: {
        "application/json": {
          schema: z.object({
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
              username: z.string().nullable(),
              emailVerified: z.boolean(),
              tenantId: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(getMeRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "No token provided" }, 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || "default-secret-change-in-production";
  const decoded = await verifyToken(token, jwtSecret);

  if (!decoded) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // Get user info
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.id, decoded.userId))
    .get();

  if (!user || user.status !== "active") {
    return c.json({ error: "User not found or inactive" }, 401);
  }

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        emailVerified: user.emailVerified,
        tenantId: user.tenantId,
      },
    },
    200
  );
});

// ============================================================================
// POST /auth/resend-verification - Resend verification email
// ============================================================================

const resendVerificationRoute = createRoute({
  method: "post",
  path: "/resend-verification",
  tags: ["Authentication"],
  summary: "Resend verification email",
  description: "Resend email verification link to user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Verification email sent",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(resendVerificationRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { email } = await c.req.json();

  // Find user by email
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.email, email))
    .get();

  if (!user) {
    return c.json(
      {
        success: false,
        error: "User not found",
      },
      400
    );
  }

  if (user.emailVerified) {
    return c.json(
      {
        success: false,
        error: "Email already verified",
      },
      400
    );
  }

  // Generate new verification token
  const verificationToken = crypto.randomUUID();
  const now = Date.now();

  // Delete old verification tokens for this user's email
  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.identifier, email));

  // Create new verification token
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours
  await db.insert(schema.verificationTokens).values({
    identifier: email,
    token: verificationToken,
    expiresAt,
    createdAt: now,
  });

  // Send verification email
  const environment = c.env.ENVIRONMENT || "production";
  if (environment === "development") {
    console.log("\n=== EMAIL VERIFICATION (DEV MODE) ===");
    console.log(`To: ${email}`);
    console.log(
      `Verification Link: http://localhost:5173/verify-email?token=${verificationToken}`
    );
    console.log("=====================================\n");
  } else {
    // Send actual email via AWS SES in production
    try {
      const { sendVerificationEmail } = await import(
        "../services/email/ses.service"
      );
      await sendVerificationEmail(email, verificationToken, c.env);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      return c.json(
        {
          success: false,
          error: "Failed to send verification email",
        },
        500
      );
    }
  }

  return c.json(
    {
      success: true,
      message: "Verification email sent",
    },
    200
  );
});

// ============================================================================
// POST /auth/verify-email - Verify email with token
// ============================================================================

const verifyEmailRoute = createRoute({
  method: "post",
  path: "/verify-email",
  tags: ["Authentication"],
  summary: "Verify email address",
  description: "Verify user email address with verification token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Email verified successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(verifyEmailRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { token } = await c.req.json();

  // Find verification token
  const verificationToken = await db
    .select()
    .from(schema.verificationTokens)
    .where(eq(schema.verificationTokens.token, token))
    .get();

  if (!verificationToken) {
    return c.json(
      {
        success: false,
        error: "Invalid verification token",
      },
      400
    );
  }

  // Check if token expired
  if (verificationToken.expiresAt < Date.now()) {
    // Delete expired token
    await db
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.token, token));

    return c.json(
      {
        success: false,
        error: "Verification token expired",
      },
      400
    );
  }

  // Find user by email (identifier)
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.email, verificationToken.identifier))
    .get();

  if (!user) {
    return c.json(
      {
        success: false,
        error: "User not found",
      },
      400
    );
  }

  // Update user to mark email as verified
  await db
    .update(schema.tenantUsers)
    .set({ emailVerified: true })
    .where(eq(schema.tenantUsers.id, user.id));

  // Delete the used verification token
  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.token, token));

  return c.json(
    {
      success: true,
      message: "Email verified successfully",
    },
    200
  );
});

// ============================================================================
// POST /auth/forgot-password - Request password reset
// ============================================================================

const forgotPasswordRoute = createRoute({
  method: "post",
  path: "/forgot-password",
  tags: ["Authentication"],
  summary: "Request password reset",
  description: "Send password reset email to user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password reset email sent",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(forgotPasswordRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { email } = await c.req.json();

  // Find user by email
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.email, email))
    .get();

  // Always return success even if user not found (security best practice)
  if (!user) {
    return c.json(
      {
        success: true,
        message: "If an account exists, a password reset email has been sent",
      },
      200
    );
  }

  // Generate password reset token
  const resetToken = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000; // 1 hour

  // Delete old password reset tokens for this user
  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.identifier, email));

  // Create new password reset token
  await db.insert(schema.verificationTokens).values({
    identifier: email,
    token: resetToken,
    expiresAt,
    createdAt: now,
  });

  // Send password reset email
  const environment = c.env.ENVIRONMENT || "production";
  if (environment === "development") {
    console.log("\n=== PASSWORD RESET (DEV MODE) ===");
    console.log(`To: ${email}`);
    console.log(
      `Reset Link: http://localhost:5173/reset-password?token=${resetToken}`
    );
    console.log("=================================\n");
  } else {
    // Send actual email via AWS SES in production
    try {
      const { sendPasswordResetEmail } = await import(
        "../services/email/ses.service"
      );
      await sendPasswordResetEmail(email, resetToken, c.env);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      // Don't expose error to user for security
    }
  }

  return c.json(
    {
      success: true,
      message: "If an account exists, a password reset email has been sent",
    },
    200
  );
});

// ============================================================================
// POST /auth/reset-password - Reset password with token
// ============================================================================

const resetPasswordRoute = createRoute({
  method: "post",
  path: "/reset-password",
  tags: ["Authentication"],
  summary: "Reset password",
  description: "Reset user password with reset token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            newPassword: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password reset successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(resetPasswordRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { token, newPassword } = await c.req.json();

  // Validate password strength
  if (!isStrongPassword(newPassword)) {
    return c.json(
      {
        success: false,
        error:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      },
      400
    );
  }

  // Find reset token
  const resetToken = await db
    .select()
    .from(schema.verificationTokens)
    .where(eq(schema.verificationTokens.token, token))
    .get();

  if (!resetToken) {
    return c.json(
      {
        success: false,
        error: "Invalid or expired reset token",
      },
      400
    );
  }

  // Check if token expired
  if (resetToken.expiresAt < Date.now()) {
    // Delete expired token
    await db
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.token, token));

    return c.json(
      {
        success: false,
        error: "Reset token has expired",
      },
      400
    );
  }

  // Find user by email
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.email, resetToken.identifier))
    .get();

  if (!user) {
    return c.json(
      {
        success: false,
        error: "User not found",
      },
      400
    );
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  await db
    .update(schema.tenantUsers)
    .set({ passwordHash: hashedPassword })
    .where(eq(schema.tenantUsers.id, user.id));

  // Delete the used reset token
  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.token, token));

  // Invalidate all user sessions
  await db
    .delete(schema.tenantUserSessions)
    .where(eq(schema.tenantUserSessions.userId, user.id));

  // Send password changed notification email
  const environment = c.env.ENVIRONMENT || "production";
  if (environment === "development") {
    console.log("\n=== PASSWORD CHANGED NOTIFICATION (DEV MODE) ===");
    console.log(`To: ${user.email}`);
    console.log("Password was successfully changed via reset");
    console.log("================================================\n");
  } else {
    try {
      const { sendPasswordChangedEmail } = await import(
        "../services/email/ses.service"
      );
      await sendPasswordChangedEmail(user.email, c.env);
    } catch (error) {
      console.error("Failed to send password changed email:", error);
      // Don't fail the request if email fails
    }
  }

  return c.json(
    {
      success: true,
      message: "Password reset successfully",
    },
    200
  );
});

// ============================================================================
// POST /auth/change-password - Change password for authenticated user
// ============================================================================

const changePasswordRoute = createRoute({
  method: "post",
  path: "/change-password",
  tags: ["Authentication"],
  summary: "Change password",
  description:
    "Change password for authenticated user (requires current password)",
  request: {
    headers: z.object({
      authorization: z.string().openapi({
        description: "Bearer JWT token",
        example: "Bearer eyJhbGc...",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password changed successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            error: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(changePasswordRoute, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        error: "No token provided",
      },
      401
    );
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || "default-secret-change-in-production";
  const decoded = await verifyToken(token, jwtSecret);

  if (!decoded) {
    return c.json(
      {
        success: false,
        error: "Invalid token",
      },
      401
    );
  }

  const { currentPassword, newPassword } = await c.req.json();

  // Validate new password strength
  if (!isStrongPassword(newPassword)) {
    return c.json(
      {
        success: false,
        error:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      },
      400
    );
  }

  // Get user
  const user = await db
    .select()
    .from(schema.tenantUsers)
    .where(eq(schema.tenantUsers.id, decoded.userId))
    .get();

  if (!user || user.status !== "active") {
    return c.json(
      {
        success: false,
        error: "User not found or inactive",
      },
      401
    );
  }

  // Verify current password
  const isValidPassword = await verifyPassword(
    currentPassword,
    user.passwordHash
  );

  if (!isValidPassword) {
    return c.json(
      {
        success: false,
        error: "Current password is incorrect",
      },
      400
    );
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  await db
    .update(schema.tenantUsers)
    .set({ passwordHash: hashedPassword })
    .where(eq(schema.tenantUsers.id, user.id));

  // Invalidate all user sessions except current one
  await db
    .delete(schema.tenantUserSessions)
    .where(eq(schema.tenantUserSessions.userId, user.id));

  // Send password changed notification email
  const environment = c.env.ENVIRONMENT || "production";
  if (environment === "development") {
    console.log("\n=== PASSWORD CHANGED NOTIFICATION (DEV MODE) ===");
    console.log(`To: ${user.email}`);
    console.log("Password was successfully changed");
    console.log("================================================\n");
  } else {
    try {
      const { sendPasswordChangedEmail } = await import(
        "../services/email/ses.service"
      );
      await sendPasswordChangedEmail(user.email, c.env);
    } catch (error) {
      console.error("Failed to send password changed email:", error);
      // Don't fail the request if email fails
    }
  }

  return c.json(
    {
      success: true,
      message: "Password changed successfully",
    },
    200
  );
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
