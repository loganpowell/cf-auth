/**
 * Token Refresh Handler
 *
 * POST /v1/auth/refresh
 *
 * Refreshes access token using refresh token.
 */

import { Context } from "hono";
import type { Env } from "../types";
import { refreshUserToken } from "../services/user.service";

/**
 * Handle token refresh
 */
export async function handleRefresh(c: Context<{ Bindings: Env }>) {
  try {
    // Get refresh token from cookie
    const cookies = c.req.header("Cookie") || "";
    const refreshToken = cookies
      .split(";")
      .find((cookie) => cookie.trim().startsWith("refreshToken="))
      ?.split("=")[1];

    if (!refreshToken) {
      return c.json(
        {
          error: "No refresh token provided",
          message: "Refresh token is required in cookies.",
        },
        401
      );
    }

    // Refresh tokens
    const result = await refreshUserToken(refreshToken, c.env);

    // Set new refresh token as httpOnly cookie
    c.header(
      "Set-Cookie",
      `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );

    // Return new access token (matching OpenAPI schema)
    return c.json(
      {
        accessToken: result.accessToken,
      },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Invalid or expired")) {
        return c.json(
          {
            error: "Invalid refresh token",
            message:
              "The refresh token is invalid or has expired. Please log in again.",
          },
          401
        );
      }
    }

    console.error("Token refresh error:", error);
    // For any other errors, return 401 (only status defined in schema)
    return c.json(
      {
        error: "Token refresh failed",
        message: "Unable to refresh token. Please log in again.",
      },
      401
    );
  }
}
