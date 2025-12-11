/**
 * Email Verification Handler
 *
 * POST /v1/auth/verify-email
 * Verifies a user's email address using a verification token
 */

import { Hono } from "hono";
import type { Env } from "../types";
import { z } from "zod";
import { hashToken } from "../utils/crypto";

const app = new Hono<{ Bindings: Env }>();

// Request validation schema
const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

/**
 * Verify email endpoint
 */
app.post("/", async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validation = verifyEmailSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        { error: validation.error.errors[0]?.message || "Invalid request" },
        400
      );
    }

    const { token } = validation.data;

    // Hash the token to compare with stored hash
    const tokenHash = await hashToken(token);

    // Find the verification token in the database
    const verificationRecord = await c.env.DB.prepare(
      `SELECT user_id, expires_at FROM email_verification_tokens 
       WHERE token_hash = ? AND used_at IS NULL`
    )
      .bind(tokenHash)
      .first<{ user_id: string; expires_at: number }>();

    if (!verificationRecord) {
      return c.json({ error: "Invalid or expired verification token" }, 400);
    }

    // Check if token has expired (24 hours)
    const now = Math.floor(Date.now() / 1000);
    if (verificationRecord.expires_at < now) {
      return c.json({ error: "Verification token has expired" }, 400);
    }

    // Mark the token as used
    await c.env.DB.prepare(
      `UPDATE email_verification_tokens 
       SET used_at = ? 
       WHERE token_hash = ?`
    )
      .bind(now, tokenHash)
      .run();

    // Mark the user's email as verified
    await c.env.DB.prepare(
      `UPDATE users 
       SET email_verified = 1, 
           updated_at = ? 
       WHERE id = ?`
    )
      .bind(now, verificationRecord.user_id)
      .run();

    return c.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return c.json({ error: "An error occurred during verification" }, 500);
  }
});

export default app;
