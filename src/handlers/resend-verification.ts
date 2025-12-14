/**
 * Resend Verification Email Handler
 *
 * POST /v1/auth/resend-verification
 * Resends the email verification email to a user
 * Validation is handled by the OpenAPI route definition.
 */

import type { RouteHandler } from "@hono/zod-openapi";
import type { Env } from "../types";
import { resendVerificationRoute } from "../schemas/auth.schema";
import { generateSecureToken } from "../utils/crypto";
import {
  sendVerificationEmail,
  storeEmailVerificationToken,
} from "../services/email.service";
import { initDb, schema } from "../db";
import { eq } from "drizzle-orm";

/**
 * Resend verification email endpoint
 * Data is pre-validated by OpenAPI route schema
 */
export const handleResendVerification: RouteHandler<
  typeof resendVerificationRoute,
  { Bindings: Env }
> = async (c) => {
  try {
    // Get validated data from OpenAPI middleware
    const { email } = c.req.valid("json");

    const db = initDb(c.env);

    // Find the user
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .get();

    if (!user) {
      // Don't reveal if email exists or not (security)
      // Return same success message
      return c.json(
        {
          message:
            "If an account exists with this email, a verification email has been sent",
        },
        200
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return c.json({ error: "Email is already verified" }, 400);
    }

    // Generate new verification token
    const verificationToken = generateSecureToken();
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

    // Store the new verification token (this will delete any existing tokens)
    await storeEmailVerificationToken(
      user.id,
      user.email,
      verificationToken,
      expiresAt,
      c.env
    );

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken, c.env);

    // Return response matching OpenAPI schema
    return c.json(
      {
        message: "Verification email sent successfully",
      },
      200
    );
  } catch (error) {
    console.error("Resend verification error:", error);
    // Return 400 for all errors (only status defined in schema besides 200)
    return c.json(
      {
        error: "Failed to send verification email",
        message: "An error occurred while sending verification email",
      },
      400
    );
  }
};
