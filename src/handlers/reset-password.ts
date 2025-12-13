/**
 * Reset Password Handler
 *
 * POST /v1/auth/reset-password
 *
 * Resets user password using a valid reset token.
 */

import { Context } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import { hashPassword } from "../utils/crypto";
import { hashToken } from "../utils/crypto";
import { sendPasswordChangedEmail } from "../services/email/ses.service";

// Request body validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
});

/**
 * Handle password reset
 */
export async function handleResetPassword(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json();
    const { token, newPassword } = resetPasswordSchema.parse(body);

    console.log("Password reset attempt with token");

    // Hash the token to look up in database
    const tokenHash = await hashToken(token);

    // Look up reset token
    const resetToken = await c.env.DB.prepare(
      `SELECT id, user_id, expires_at, used_at 
       FROM password_reset_tokens 
       WHERE token = ?`
    )
      .bind(tokenHash)
      .first<{
        id: string;
        user_id: string;
        expires_at: number;
        used_at: number | null;
      }>();

    // Validate token exists
    if (!resetToken) {
      console.log("Invalid reset token");
      return c.json(
        {
          error: "Invalid token",
          message: "The password reset token is invalid or has expired.",
        },
        400
      );
    }

    // Check if token has already been used
    if (resetToken.used_at !== null) {
      console.log("Reset token already used");
      return c.json(
        {
          error: "Token already used",
          message: "This password reset token has already been used.",
        },
        400
      );
    }

    // Check if token has expired
    const now = Math.floor(Date.now() / 1000);
    if (now > resetToken.expires_at) {
      console.log("Reset token expired");
      return c.json(
        {
          error: "Token expired",
          message:
            "The password reset token has expired. Please request a new one.",
        },
        400
      );
    }

    // Get user
    const user = await c.env.DB.prepare(
      `SELECT id, email, is_active FROM users WHERE id = ?`
    )
      .bind(resetToken.user_id)
      .first<{ id: string; email: string; is_active: number }>();

    if (!user) {
      console.log("User not found for reset token");
      return c.json(
        {
          error: "User not found",
          message: "The user associated with this token no longer exists.",
        },
        400
      );
    }

    // Check if user is active
    if (user.is_active !== 1) {
      console.log("User account is inactive");
      return c.json(
        {
          error: "Account inactive",
          message: "This account has been deactivated.",
        },
        400
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update user's password
    await c.env.DB.prepare(
      `UPDATE users 
       SET password_hash = ?, updated_at = ? 
       WHERE id = ?`
    )
      .bind(passwordHash, Math.floor(Date.now() / 1000), user.id)
      .run();

    // Mark reset token as used
    await c.env.DB.prepare(
      `UPDATE password_reset_tokens 
       SET used_at = ? 
       WHERE id = ?`
    )
      .bind(Math.floor(Date.now() / 1000), resetToken.id)
      .run();

    // Note: Refresh tokens are stored as httpOnly cookies, not in the database
    // They will naturally expire after 7 days. User will need to re-login.

    console.log("✅ Password reset successful for user:", user.id);

    // Send password changed notification email
    try {
      await sendPasswordChangedEmail(user.email, c.env);
      console.log("✅ Password changed notification email sent");
    } catch (emailError) {
      console.error("Failed to send password changed email:", emailError);
      // Don't fail the request if email fails - password was already changed
    }

    return c.json(
      {
        message:
          "Password reset successful. You can now log in with your new password.",
      },
      200
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

    // Generic error
    console.error("Reset password error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred.",
      },
      500
    );
  }
}
