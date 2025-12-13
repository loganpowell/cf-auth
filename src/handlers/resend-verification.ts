/**
 * Resend Verification Email Handler
 *
 * POST /v1/auth/resend-verification
 * Resends the email verification email to a user
 */

import { Hono } from "hono";
import type { Env } from "../types";
import { z } from "zod";
import { generateSecureToken, hashToken } from "../utils/crypto";
import { sendVerificationEmail } from "../services/email";
import { findUserByEmail } from "../db/queries";

const app = new Hono<{ Bindings: Env }>();

// Request validation schema
const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * Resend verification email endpoint
 */
app.post("/", async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validation = resendSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        { error: validation.error.issues[0]?.message || "Invalid request" },
        400
      );
    }

    const { email } = validation.data;

    // Find the user
    const user = await findUserByEmail(email, c.env);

    if (!user) {
      // Don't reveal if email exists or not (security)
      return c.json({
        success: true,
        message:
          "If an account exists with this email, a verification email has been sent",
      });
    }

    // Check if already verified
    if (user.email_verified) {
      return c.json({ error: "Email is already verified" }, 400);
    }

    // Generate new verification token
    const verificationToken = generateSecureToken();
    const tokenHash = await hashToken(verificationToken);
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

    // Invalidate any existing unused tokens for this user
    await c.env.DB.prepare(
      `UPDATE email_verification_tokens 
       SET used_at = ? 
       WHERE user_id = ? AND used_at IS NULL`
    )
      .bind(Math.floor(Date.now() / 1000), user.id)
      .run();

    // Store the new verification token
    await c.env.DB.prepare(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(user.id, tokenHash, expiresAt, Math.floor(Date.now() / 1000))
      .run();

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken, c.env);

    return c.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return c.json(
      { error: "An error occurred while sending verification email" },
      500
    );
  }
});

export default app;
