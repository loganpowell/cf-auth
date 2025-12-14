/**
 * Reset Password Handler
 *
 * POST /v1/auth/reset-password
 *
 * Resets user password using a valid reset token.
 * Validation is handled by the OpenAPI route definition.
 */

import type { RouteHandler } from "@hono/zod-openapi";
import type { Env } from "../types";
import { resetPasswordRoute } from "../schemas/auth.schema";
import { hashPassword } from "../utils/crypto";
import { sendPasswordChangedEmail } from "../services/email/ses.service";
import {
  verifyPasswordResetToken,
  markPasswordResetTokenUsed,
} from "../services/email.service";
import { initDb, schema } from "../db";
import { eq } from "drizzle-orm";

/**
 * Handle password reset
 * Data is pre-validated by OpenAPI route schema
 */
export const handleResetPassword: RouteHandler<
  typeof resetPasswordRoute,
  { Bindings: Env }
> = async (c) => {
  try {
    // Get validated data from OpenAPI middleware
    const { token, newPassword } = c.req.valid("json");

    console.log("Password reset attempt with token");

    // Verify the reset token and get user ID
    const userId = await verifyPasswordResetToken(token, c.env);

    if (!userId) {
      console.log("Invalid or expired reset token");
      return c.json(
        {
          error: "Invalid reset token",
          message: "The password reset link is invalid or has expired.",
        },
        400
      );
    }

    const db = initDb(c.env);
    const now = Math.floor(Date.now() / 1000);

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await db
      .update(schema.users)
      .set({
        passwordHash: passwordHash,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userId));

    // Mark token as used
    await markPasswordResetTokenUsed(token, c.env);

    console.log("Password reset successful for user:", userId);

    // Get user email for confirmation email
    const user = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    // Send password changed confirmation email
    if (user) {
      try {
        await sendPasswordChangedEmail(user.email, c.env);
        console.log("✅ Password changed email sent to:", user.email);
      } catch (error) {
        console.error("❌ Failed to send password changed email:", error);
        // Don't fail the request if email sending fails
      }
    }

    return c.json(
      {
        message:
          "Password reset successfully. You can now log in with your new password.",
      },
      200
    );
  } catch (error) {
    // For any errors, return generic 400 error
    console.error("Reset password error:", error);
    return c.json(
      {
        error: "Password reset failed",
        message:
          "Unable to reset password. Please try again or request a new reset link.",
      },
      400
    );
  }
};
