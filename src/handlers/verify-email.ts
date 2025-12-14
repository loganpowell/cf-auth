/**
 * Email Verification Handler
 *
 * POST /v1/auth/verify-email
 * Verifies a user's email address using a verification token
 * Validation is handled by the OpenAPI route definition.
 */

import type { RouteHandler } from "@hono/zod-openapi";
import type { Env } from "../types";
import { verifyEmailRoute } from "../schemas/auth.schema";
import {
  verifyEmailToken,
  deleteEmailVerificationToken,
} from "../services/email.service";
import { initDb, schema } from "../db";
import { eq } from "drizzle-orm";

/**
 * Verify email endpoint
 * Data is pre-validated by OpenAPI route schema
 */
export const handleVerifyEmail: RouteHandler<
  typeof verifyEmailRoute,
  { Bindings: Env }
> = async (c) => {
  try {
    // Get validated data from OpenAPI middleware
    const { token } = c.req.valid("json");

    // Verify the token and get user ID
    const userId = await verifyEmailToken(token, c.env);

    if (!userId) {
      return c.json({ error: "Invalid or expired verification token" }, 400);
    }

    const db = initDb(c.env);
    const now = Math.floor(Date.now() / 1000);

    // Mark the user's email as verified
    await db
      .update(schema.users)
      .set({
        emailVerified: true,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userId));

    // Delete the used verification token
    await deleteEmailVerificationToken(token, c.env);

    // Return response matching OpenAPI schema
    return c.json(
      {
        message: "Email verified successfully",
      },
      200
    );
  } catch (error) {
    console.error("Email verification error:", error);
    // Return 400 for all errors (only status defined in schema besides 200)
    return c.json(
      {
        error: "Email verification failed",
        message: "An error occurred during verification",
      },
      400
    );
  }
};
