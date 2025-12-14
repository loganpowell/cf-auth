/**
 * List Roles Handler
 *
 * GET /v1/roles
 *
 * Lists all roles for an organization or team.
 */

import { getRoles } from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";

export const handleListRoles = async (c: any) => {
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

    const query = c.req.valid("query");

    const roles = await getRoles(c.env, query.organizationId);

    return c.json(
      {
        roles,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        error: "Internal Server Error",
        message: error.message || "Failed to list roles",
      },
      500
    );
  }
};
