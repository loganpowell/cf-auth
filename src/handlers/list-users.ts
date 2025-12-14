/**
 * GET /v1/users
 *
 * List all users (requires authentication)
 * Simple endpoint to help with user selection in the permissions dashboard
 */

import { Context } from "hono";
import type { Env } from "../types.js";
import { initDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { desc } from "drizzle-orm";
import { verifyAccessToken } from "../services/token.service.js";

export async function handleListUsers(c: Context<{ Bindings: Env }>) {
  try {
    // Get access token from Authorization header
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Access token is required in Authorization header.",
        },
        401 as const
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Verify token (throws if invalid)
    await verifyAccessToken(accessToken, c.env);

    const db = initDb(c.env);

    // Get all users, ordered by most recent first
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        status: users.status,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(100); // Limit to prevent huge responses

    return c.json(
      {
        users: allUsers,
        count: allUsers.length,
      },
      200 as const
    );
  } catch (error) {
    console.error("Error listing users:", error);
    return c.json(
      {
        error: "Internal Server Error",
        message: "Failed to list users.",
      },
      500 as const
    );
  }
}
