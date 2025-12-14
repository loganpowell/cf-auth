/**
 * Change Password Handler
 *
 * POST /v1/auth/change-password
 *
 * Allows authenticated users to change their password by providing their current password.
 * This is different from reset-password which uses a token for forgot password flow.
 */

import { Context } from "hono";
import type { Env } from "../types";
import { verifyAccessToken } from "../services/token.service";
import { getUserById } from "../services/user.service";
import { hashPassword, verifyPassword } from "../utils/crypto";
import { initDb, schema } from "../db";
import { eq } from "drizzle-orm";

/**
 * Handle change password request
 */
export async function handleChangePassword(c: Context<{ Bindings: Env }>) {
  try {
    // Get access token from Authorization header
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Access token is required in Authorization header.",
        },
        401
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Verify token and get payload
    const payload = await verifyAccessToken(accessToken, c.env);

    // Get request body
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    // Validate request
    if (!currentPassword || !newPassword) {
      return c.json(
        { error: "currentPassword and newPassword are required" },
        400
      );
    }

    if (newPassword.length < 8) {
      return c.json(
        { error: "New password must be at least 8 characters" },
        400
      );
    }

    // Get full user record with password hash
    const dbUser = await getUserById(payload.sub, c.env);
    if (!dbUser.passwordHash) {
      return c.json({ error: "User has no password set" }, 400);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return c.json({ error: "Current password is incorrect" }, 401);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    const db = initDb(c.env);
    await db
      .update(schema.users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: Date.now(),
      })
      .where(eq(schema.users.id, payload.sub));

    return c.json(
      {
        message: "Password changed successfully",
      },
      200
    );
  } catch (error) {
    console.error("Change password error:", error);
    return c.json(
      {
        error: "Failed to change password",
        message: (error as Error).message,
      },
      500
    );
  }
}
