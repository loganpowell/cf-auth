/**
 * Authorization Middleware
 *
 * Provides middleware for checking user permissions on protected routes.
 * Uses Permission Superset Model for hierarchical permission validation.
 */

import type { Context, Next } from "hono";
import type { Env } from "../types";
import { verifyAccessToken } from "../services/token.service";
import {
  checkUserPermission,
  checkUserPermissions,
} from "../services/permission.service";

/**
 * Extract and verify JWT from Authorization header
 * Returns userId from token payload
 */
async function extractUserId(c: Context<{ Bindings: Env }>): Promise<string> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Access token is required in Authorization header");
  }

  const accessToken = authHeader.replace("Bearer ", "");
  const payload = await verifyAccessToken(accessToken, c.env);

  return payload.sub;
}

/**
 * Middleware to require authentication
 * Verifies JWT token is valid
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    // Just verify the token is valid
    await extractUserId(c);

    await next();
  } catch (error) {
    if (error instanceof Error) {
      return c.json(
        {
          error: "Unauthorized",
          message: error.message,
        },
        401
      );
    }

    return c.json(
      {
        error: "Unauthorized",
        message: "Authentication failed",
      },
      401
    );
  }
}

/**
 * Middleware factory to require specific permissions
 *
 * @param permissions - One or more permission bits to check
 * @param options - Optional configuration
 * @returns Middleware function
 *
 * @example
 * app.post('/v1/permissions/grant',
 *   requirePermission(PERM_GRANT),
 *   handleGrantRole
 * );
 *
 * @example
 * app.post('/v1/roles',
 *   requirePermission(PERM_ROLE_CREATE, {
 *     organizationIdParam: 'organizationId'
 *   }),
 *   handleCreateRole
 * );
 */
export function requirePermission(...permissions: bigint[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const userId = await extractUserId(c);

      // Extract scope from query params or body
      let organizationId: string | undefined;
      let teamId: string | undefined;

      // Try to get from query params first
      const query = c.req.query();
      organizationId = query.organizationId;
      teamId = query.teamId;

      // If not in query, try body (for POST/PUT requests)
      if (!organizationId || !teamId) {
        try {
          const body = await c.req.json();
          organizationId = organizationId || body.organizationId;
          teamId = teamId || body.teamId;
        } catch {
          // Body might not be JSON or might not exist
        }
      }

      // Check if user has all required permissions
      const hasAllPerms = await checkUserPermissions(
        userId,
        permissions,
        c.env,
        organizationId,
        teamId
      );

      if (!hasAllPerms) {
        return c.json(
          {
            error: "Forbidden",
            message:
              "You do not have the required permissions to perform this action",
          },
          403
        );
      }

      await next();
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("expired") ||
          error.message.includes("invalid") ||
          error.message.includes("revoked") ||
          error.message.includes("required")
        ) {
          return c.json(
            {
              error: "Unauthorized",
              message: error.message,
            },
            401
          );
        }

        return c.json(
          {
            error: "Authorization failed",
            message: error.message,
          },
          403
        );
      }

      return c.json(
        {
          error: "Authorization failed",
          message: "An unexpected error occurred during authorization",
        },
        403
      );
    }
  };
}

/**
 * Middleware to require at least one of the specified permissions
 *
 * @param permissions - One or more permission bits to check (user needs ANY)
 * @returns Middleware function
 */
export function requireAnyPermission(...permissions: bigint[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const userId = await extractUserId(c);

      // Extract scope from query params or body
      let organizationId: string | undefined;
      let teamId: string | undefined;

      const query = c.req.query();
      organizationId = query.organizationId;
      teamId = query.teamId;

      if (!organizationId || !teamId) {
        try {
          const body = await c.req.json();
          organizationId = organizationId || body.organizationId;
          teamId = teamId || body.teamId;
        } catch {
          // Body might not be JSON
        }
      }

      // Check each permission until we find one the user has
      let hasAnyPerm = false;
      for (const permission of permissions) {
        const hasPerm = await checkUserPermission(
          userId,
          permission,
          c.env,
          organizationId,
          teamId
        );
        if (hasPerm) {
          hasAnyPerm = true;
          break;
        }
      }

      if (!hasAnyPerm) {
        return c.json(
          {
            error: "Forbidden",
            message:
              "You do not have any of the required permissions to perform this action",
          },
          403
        );
      }

      await next();
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("expired") ||
          error.message.includes("invalid") ||
          error.message.includes("revoked") ||
          error.message.includes("required")
        ) {
          return c.json(
            {
              error: "Unauthorized",
              message: error.message,
            },
            401
          );
        }

        return c.json(
          {
            error: "Authorization failed",
            message: error.message,
          },
          403
        );
      }

      return c.json(
        {
          error: "Authorization failed",
          message: "An unexpected error occurred during authorization",
        },
        403
      );
    }
  };
}

/**
 * Extract authenticated user ID from Authorization header
 * Use this in handlers after requireAuth/requirePermission middleware
 */
export async function getUserIdFromContext(
  c: Context<{ Bindings: Env }>
): Promise<string> {
  return await extractUserId(c);
}
