/**
 * Get Audit Trail Handler
 *
 * GET /v1/permissions/audit
 *
 * Retrieves permission audit trail for an organization or team.
 */

import { getPermissionAuditTrail } from "../../services/permission.service";
import { verifyAccessToken } from "../../services/token.service";

export const handleGetAuditTrail = async (c: any) => {
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

    const auditRecords = await getPermissionAuditTrail(
      {
        organizationId: query.organizationId,
        action: query.action,
      },
      c.env,
      query.limit
    );

    return c.json(
      {
        auditRecords,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        error: "Internal Server Error",
        message: error.message || "Failed to retrieve audit trail",
      },
      500
    );
  }
};
