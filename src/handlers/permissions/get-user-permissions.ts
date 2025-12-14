/**
 * Get User Permissions Handler
 *
 * GET /v1/users/{userId}/permissions
 *
 * Retrieves all effective permissions for a user.
 */

import { getUserPermissions } from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";

export const handleGetUserPermissions = async (c: any) => {
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
    await verifyAccessToken(accessToken, c.env);

    const params = c.req.valid("param");
    const query = c.req.valid("query");

    const permissions = await getUserPermissions(
      params.userId,
      c.env,
      query.organizationId,
      query.teamId
    );

    // Convert BigInt values to strings for JSON serialization
    return c.json(
      {
        permissions: {
          ...permissions,
          low: permissions.low.toString(),
          high: permissions.high.toString(),
          combined: permissions.combined.toString(),
        },
      },
      200
    );
  } catch (error: any) {
    console.error("[getUserPermissions] Error:", error);
    console.error("[getUserPermissions] Stack:", error.stack);
    return c.json(
      {
        error: "Internal Server Error",
        message: error.message || "Failed to retrieve user permissions",
      },
      500
    );
  }
};
