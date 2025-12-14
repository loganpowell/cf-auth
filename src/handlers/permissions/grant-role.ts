/**
 * Grant Role Handler
 *
 * POST /v1/permissions/grant
 *
 * Grants a role to a user with delegation validation.
 * Validates that the grantor has permission to delegate all permissions in the role.
 */

import {
  assignRole,
  checkUserPermission,
} from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";
import { PERM_GRANT } from "../../utils/permissions";

/**
 * Handle role grant request
 * Data is pre-validated by OpenAPI route schema
 */
export const handleGrantRole = async (c: any) => {
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
    const grantorId = payload.sub;

    // Get validated data from OpenAPI middleware
    const validatedData = c.req.valid("json");

    // Check if grantor has PERM_GRANT permission
    const hasPermission = await checkUserPermission(
      grantorId,
      PERM_GRANT,
      c.env,
      validatedData.organizationId,
      validatedData.teamId
    );

    if (!hasPermission) {
      return c.json(
        {
          error: "Forbidden",
          message: "You do not have permission to grant roles.",
        },
        403
      );
    }

    // Assign role with delegation validation
    const assignment = await assignRole(
      {
        userId: validatedData.userId,
        roleId: validatedData.roleId,
        grantedBy: grantorId,
        organizationId: validatedData.organizationId,
        teamId: validatedData.teamId,
        expiresAt: validatedData.expiresAt
          ? new Date(validatedData.expiresAt)
          : undefined,
      },
      c.env
    );

    // Return response matching OpenAPI schema
    return c.json(
      {
        message: "Role granted successfully",
        assignment,
      },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      // Handle delegation validation errors
      if (error.message.includes("cannot grant permissions")) {
        return c.json(
          {
            error: "Forbidden",
            message: error.message,
          },
          403
        );
      }

      // Handle validation/not found/duplicate errors as bad request
      return c.json(
        {
          error: "Bad request",
          message: error.message,
        },
        400
      );
    }

    console.error("Grant role error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred while granting role.",
      },
      500
    );
  }
};
