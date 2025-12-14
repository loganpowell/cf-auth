/**
 * Forgot Password Handler
 *
 * POST /v1/auth/forgot-password
 *
 * Initiates password reset flow by sending reset email.
 * Validation is handled by the OpenAPI route definition.
 */

import type { RouteHandler } from "@hono/zod-openapi";
import type { Env } from "../types";
import { forgotPasswordRoute } from "../schemas/auth.schema";
import { generateSecureToken } from "../utils/crypto";
import { sendPasswordResetEmail } from "../services/email";
import { storePasswordResetToken } from "../services/email.service";
import { initDb, schema } from "../db";
import { eq } from "drizzle-orm";

/**
 * Handle forgot password request
 * Data is pre-validated by OpenAPI route schema
 */
export const handleForgotPassword: RouteHandler<
  typeof forgotPasswordRoute,
  { Bindings: Env }
> = async (c) => {
  try {
    // Get validated data from OpenAPI middleware
    const { email } = c.req.valid("json");

    console.log("Password reset requested for:", email);

    const db = initDb(c.env);

    // Look up user by email
    const user = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        emailVerified: schema.users.emailVerified,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .get();

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
    if (user.status !== "active") {
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
    if (!user.emailVerified) {
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
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour

    // Store reset token in database
    await storePasswordResetToken(user.id, resetToken, expiresAt, c.env);

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
    // For any errors, return generic 400 error
    console.error("Forgot password error:", error);
    return c.json(
      {
        error: "Request failed",
        message: "Unable to process password reset request.",
      },
      400
    );
  }
};
