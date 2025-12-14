/**
 * Create Role Handler
 *
 * POST /v1/roles
 *
 * Creates a new custom role with specified permissions.
 * Validates that the creator can delegate all requested permissions.
 */

import {
  createCustomRole,
  checkUserPermission,
} from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";
import { PERM_ROLE_CREATE } from "../../utils/permissions";

export const handleCreateRole = async (c: any) => {
  try {
    // Authenticate user
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
    const payload = await verifyAccessToken(accessToken, c.env);
    const creatorId = payload.sub;

    const validatedData = c.req.valid("json");

    // Check if creator has PERM_ROLE_CREATE permission
    const hasPermission = await checkUserPermission(
      creatorId,
      PERM_ROLE_CREATE,
      c.env,
      validatedData.organizationId
    );

    if (!hasPermission) {
      return c.json(
        {
          error: "Forbidden",
          message: "You do not have permission to create roles.",
        },
        403
      );
    }

    const role = await createCustomRole(
      {
        name: validatedData.name,
        description: validatedData.description,
        permissionNames: validatedData.permissions,
        organizationId: validatedData.organizationId,
        createdBy: creatorId,
      },
      c.env
    );

    return c.json(
      {
        message: "Role created successfully",
        role,
      },
      200
    );
  } catch (error: any) {
    if (
      error.message?.includes("permission") ||
      error.message?.includes("delegate")
    ) {
      return c.json(
        {
          error: "Forbidden",
          message: error.message,
        },
        403
      );
    }

    if (
      error.message?.includes("invalid") ||
      error.message?.includes("required")
    ) {
      return c.json(
        {
          error: "Bad Request",
          message: error.message,
        },
        400
      );
    }

    return c.json(
      {
        error: "Internal Server Error",
        message: error.message || "Failed to create role",
      },
      500
    );
  }
};
