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
import { transformUserToApi } from "../schemas/db-schemas";

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
    const dbUser = await getUserById(payload.sub, c.env);

    // Transform database user to API user (using drizzle-zod transformer)
    const apiUser = transformUserToApi(dbUser);

    // Return user data (transformer handles all conversions)
    return c.json(
      {
        user: apiUser,
      },
      200
    );
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
