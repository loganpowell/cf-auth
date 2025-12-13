/**
 * Registration Handler
 *
 * POST /v1/auth/register
 *
 * Creates a new user account with email/password.
 */

import { Context } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import { registerUser } from "../services/user.service";
import { generateSecureToken, hashToken } from "../utils/crypto";
import { sendVerificationEmail } from "../services/email";

// Request body validation schema
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name must be less than 100 characters"),
});

/**
 * Handle user registration
 */
export async function handleRegister(c: Context<{ Bindings: Env }>) {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    console.log("Registration request body:", body);
    const validatedData = registerSchema.parse(body);
    console.log("Validation passed, registering user...");

    // Register user
    const result = await registerUser(validatedData, c.env);
    console.log("User registered:", result.user.email);

    // Generate email verification token
    const verificationToken = generateSecureToken();
    const tokenHash = await hashToken(verificationToken);
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

    // Store verification token in database
    await c.env.DB.prepare(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(result.user.id, tokenHash, expiresAt, Math.floor(Date.now() / 1000))
      .run();

    // Send verification email (wait for it to ensure it sends)
    try {
      await sendVerificationEmail(result.user.email, verificationToken, c.env);
      console.log("✅ Verification email sent successfully");
    } catch (error) {
      console.error("❌ Failed to send verification email:", error);
      // Don't fail registration if email fails
    }

    // Set refresh token as httpOnly cookie
    c.header(
      "Set-Cookie",
      `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    // Return user and access token (excluding sensitive data)
    return c.json(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.display_name,
          avatarUrl: result.user.avatar_url,
          emailVerified: result.user.email_verified,
          createdAt: result.user.created_at,
        },
        accessToken: result.accessToken,
        message:
          "Registration successful. Please check your email to verify your account.",
      },
      201
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
      return c.json(
        {
          error: "Validation failed",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        400
      );
    }

    // Handle business logic errors
    if (error instanceof Error) {
      console.error("Business logic error:", error.message);
      // Check for specific error messages
      if (error.message.includes("already registered")) {
        return c.json(
          {
            error: "Email already registered",
            message:
              "This email address is already associated with an account.",
          },
          409
        );
      }

      return c.json(
        {
          error: "Registration failed",
          message: error.message,
        },
        400
      );
    }

    // Generic error
    console.error("Registration error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred during registration.",
      },
      500
    );
  }
}
