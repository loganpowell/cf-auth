/**
 * Logout Handler
 *
 * POST /v1/auth/logout
 *
 * Invalidates refresh token and blacklists access token.
 */

import { Context } from "hono";
import type { Env } from "../types";
import { verifyAccessToken, blacklistToken } from "../services/token.service";
import { revokeRefreshToken } from "../services/token.service";

/**
 * Handle user logout
 */
export async function handleLogout(c: Context<{ Bindings: Env }>) {
  try {
    // Get access token from Authorization header
    const authHeader = c.req.header("Authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    // Get refresh token from cookie
    const cookies = c.req.header("Cookie") || "";
    const refreshToken = cookies
      .split(";")
      .find((cookie) => cookie.trim().startsWith("refreshToken="))
      ?.split("=")[1];

    // Blacklist access token if provided
    if (accessToken) {
      try {
        const payload = await verifyAccessToken(accessToken, c.env);
        await blacklistToken(payload.jti, payload.exp, c.env);
      } catch (error) {
        // Token might already be invalid, continue with logout
        console.log("Access token blacklist error:", error);
      }
    }

    // Revoke refresh token if provided
    if (refreshToken) {
      try {
        await revokeRefreshToken(refreshToken, c.env);
      } catch (error) {
        // Token might already be invalid, continue with logout
        console.log("Refresh token revoke error:", error);
      }
    }

    // Clear refresh token cookie
    c.header(
      "Set-Cookie",
      "refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
    );

    return c.json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred during logout.",
      },
      500
    );
  }
}
