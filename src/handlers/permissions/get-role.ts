/**
 * Get Role Handler
 *
 * GET /v1/roles/{roleId}
 *
 * Retrieves a specific role by ID with permission details.
 */

import { getRoleById } from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";

export const handleGetRole = async (c: any) => {
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

    const role = await getRoleById(params.roleId, c.env);

    if (!role) {
      return c.json(
        {
          error: "Not Found",
          message: "Role not found",
        },
        400
      );
    }

    return c.json(
      {
        role,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        error: "Internal Server Error",
        message: error.message || "Failed to retrieve role",
      },
      500
    );
  }
};
