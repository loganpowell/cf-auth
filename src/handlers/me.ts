/**
 * Get Current User Handler
 *
 * GET /v1/auth/me
 *
 * Returns the currently authenticated user's information.
 */

import { Context } from "hono";
import type { Env } from "../types";
import { verifyAccessToken } from "../services/token.service";
import { getUserById } from "../services/user.service";

/**
 * Handle get current user request
 */
export async function handleGetMe(c: Context<{ Bindings: Env }>) {
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

    // Get user from database
    const user = await getUserById(payload.sub, c.env);

    // Return user data (excluding sensitive fields)
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
        status: user.status,
        mfaEnabled: user.mfa_enabled,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("expired") ||
        error.message.includes("invalid") ||
        error.message.includes("revoked")
      ) {
        return c.json(
          {
            error: "Unauthorized",
            message: error.message,
          },
          401
        );
      }

      if (error.message.includes("not found")) {
        return c.json(
          {
            error: "User not found",
            message: "The user associated with this token no longer exists.",
          },
          404
        );
      }

      return c.json(
        {
          error: "Request failed",
          message: error.message,
        },
        400
      );
    }

    console.error("Get me error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred.",
      },
      500
    );
  }
}
