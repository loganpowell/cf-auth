/**
 * Forgot Password Handler
 *
 * POST /v1/auth/forgot-password
 *
 * Initiates password reset flow by sending reset email.
 */

import { Context } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import { generateSecureToken, hashToken } from "../utils/crypto";
import { sendPasswordResetEmail } from "../services/email";

// Request body validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

/**
 * Handle forgot password request
 */
export async function handleForgotPassword(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();
    const { email } = forgotPasswordSchema.parse(body);

    console.log("Password reset requested for:", email);

    // Look up user by email
    const user = await c.env.DB.prepare(
      `SELECT id, email, email_verified, is_active FROM users WHERE email = ? COLLATE NOCASE`
    )
      .bind(email)
      .first<{
        id: string;
        email: string;
        email_verified: number;
        is_active: number;
      }>();

    // Always return success to prevent email enumeration attacks
    // Don't reveal whether the email exists or not
    if (!user) {
      console.log("User not found for email:", email);
      return c.json(
        {
          message:
            "If an account with that email exists, a password reset link has been sent.",
        },
        200
      );
    }

    // Check if user account is active
    if (user.is_active !== 1) {
      console.log("User account is inactive:", email);
      return c.json(
        {
          message:
            "If an account with that email exists, a password reset link has been sent.",
        },
        200
      );
    }

    // Check if email is verified
    if (user.email_verified !== 1) {
      console.log("User email not verified:", email);
      return c.json(
        {
          error: "Email not verified",
          message:
            "Please verify your email address before resetting your password.",
        },
        400
      );
    }

    // Generate password reset token
    const resetToken = generateSecureToken();
    const tokenHash = await hashToken(resetToken);
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    const tokenId = crypto.randomUUID();

    // Store reset token in database
    await c.env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        tokenId,
        user.id,
        tokenHash,
        expiresAt,
        Math.floor(Date.now() / 1000)
      )
      .run();

    console.log("Password reset token created for user:", user.id);

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, c.env);
      console.log("✅ Password reset email sent to:", user.email);
    } catch (error) {
      console.error("❌ Failed to send password reset email:", error);
      // Don't fail the request if email sending fails
      // User will still see success message
    }

    return c.json(
      {
        message:
          "If an account with that email exists, a password reset link has been sent.",
      },
      200
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors);
      return c.json(
        {
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        400
      );
    }

    // Generic error
    console.error("Forgot password error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred.",
      },
      500
    );
  }
}
