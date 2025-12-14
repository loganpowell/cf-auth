/**
 * Revoke Role Handler
 *
 * POST /v1/permissions/revoke
 *
 * Revokes a role from a user.
 * Validates that the revoker has permission to manage the role.
 */

import {
  revokeRole,
  checkUserPermission,
} from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";
import { PERM_REVOKE } from "../../utils/permissions";

export const handleRevokeRole = async (c: any) => {
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
    const revokerId = payload.sub;

    const validatedData = c.req.valid("json");

    // Check if revoker has PERM_REVOKE permission
    const hasPermission = await checkUserPermission(
      revokerId,
      PERM_REVOKE,
      c.env,
      validatedData.organizationId,
      validatedData.teamId
    );

    if (!hasPermission) {
      return c.json(
        {
          error: "Forbidden",
          message: "You do not have permission to revoke roles.",
        },
        403
      );
    }

    await revokeRole(
      {
        userId: validatedData.userId,
        roleId: validatedData.roleId,
        organizationId: validatedData.organizationId,
        teamId: validatedData.teamId,
        revokedBy: revokerId,
      },
      c.env
    );

    return c.json(
      {
        message: "Role revoked successfully",
      },
      200
    );
  } catch (error: any) {
    if (error.message?.includes("permission")) {
      return c.json(
        {
          error: "Forbidden",
          message: error.message,
        },
        403
      );
    }

    if (error.message?.includes("not found")) {
      return c.json(
        {
          error: "Not Found",
          message: error.message,
        },
        400
      );
    }

    return c.json(
      {
        error: "Internal Server Error",
        message: error.message || "Failed to revoke role",
      },
      500
    );
  }
};
