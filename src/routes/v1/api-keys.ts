/**
 * Tenant API Key Management
 *
 * Self-service endpoints for tenants to manage their own API keys
 *
 * Endpoints:
 * POST   /v1/api-keys           - Create API key
 * GET    /v1/api-keys           - List API keys
 * POST   /v1/api-keys/:id/rotate - Rotate API key
 * DELETE /v1/api-keys/:id       - Revoke API key
 *
 * Authentication:
 * All endpoints require valid API key in Authorization header
 * Tenant context extracted from API key's tenant_id
 */

import { Router } from "hono";
import { Database } from "better-sqlite3";
import {
  generateAPIKey,
  saveAPIKey,
  revokeAPIKey,
  rotateAPIKey,
} from "../../utils/api-keys";
import { namespaceId, verifyTenantOwnership } from "../../utils/namespace-isolation";

export function createAPIKeyRouter(db: Database): Router {
  const router = new Router();

  // ===================================================================
  // Create API Key
  // ===================================================================
  router.post("/", async (c) => {
    // Tenant extracted by middleware (c.get("tenantContext"))
    const tenantContext = c.get("tenantContext");

    if (!tenantContext || !tenantContext.isValid) {
      return c.json(
        { error: "UNAUTHORIZED", message: "Invalid tenant context" },
        { status: 401 }
      );
    }

    const body = await c.req.json<{
      name: string;
      type: "public" | "secret" | "restricted";
      environment: "test" | "live";
      permissions?: string[];
    }>();

    // Validate input
    if (!body.name || !body.type || !body.environment) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "name, type, and environment are required",
        },
        { status: 400 }
      );
    }

    // Validate permissions format if provided
    if (body.permissions && !Array.isArray(body.permissions)) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "permissions must be an array of strings",
        },
        { status: 400 }
      );
    }

    try {
      const generated = generateAPIKey({
        tenantId: tenantContext.tenantId,
        name: body.name,
        type: body.type,
        environment: body.environment,
        permissions: body.permissions,
      });

      const apiKey = saveAPIKey(
        db,
        {
          tenantId: tenantContext.tenantId,
          name: body.name,
          type: body.type,
          environment: body.environment,
          permissions: body.permissions,
        },
        generated
      );

      return c.json(
        {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            type: apiKey.type,
            environment: apiKey.environment,
            createdAt: apiKey.created_at,
          },
          credentials: {
            keyPrefix: generated.keyPrefix,
            keySecret: generated.keySecret, // Only shown once!
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Failed to create API key:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to create API key" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // List API Keys
  // ===================================================================
  router.get("/", async (c) => {
    const tenantContext = c.get("tenantContext");

    if (!tenantContext || !tenantContext.isValid) {
      return c.json(
        { error: "UNAUTHORIZED", message: "Invalid tenant context" },
        { status: 401 }
      );
    }

    try {
      const apiKeys = db
        .prepare(
          `
        SELECT id, name, type, environment, permissions, created_at, revoked_at
        FROM api_keys
        WHERE tenant_id = ? AND revoked_at IS NULL
        ORDER BY created_at DESC
      `
        )
        .all(tenantContext.tenantId) as any[];

      return c.json({
        apiKeys: apiKeys.map((key) => ({
          id: key.id,
          name: key.name,
          type: key.type,
          environment: key.environment,
          permissions: key.permissions ? JSON.parse(key.permissions) : [],
          createdAt: key.created_at,
        })),
      });
    } catch (error) {
      console.error("Failed to list API keys:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to list API keys" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // Rotate API Key
  // ===================================================================
  router.post("/:keyId/rotate", async (c) => {
    const tenantContext = c.get("tenantContext");

    if (!tenantContext || !tenantContext.isValid) {
      return c.json(
        { error: "UNAUTHORIZED", message: "Invalid tenant context" },
        { status: 401 }
      );
    }

    const keyId = c.req.param("keyId");

    try {
      // Verify key belongs to this tenant
      const oldKey = db
        .prepare("SELECT * FROM api_keys WHERE id = ? AND tenant_id = ?")
        .get(keyId, tenantContext.tenantId) as any;

      if (!oldKey) {
        return c.json(
          {
            error: "NOT_FOUND",
            message: `API key not found or does not belong to your tenant: ${keyId}`,
          },
          { status: 404 }
        );
      }

      if (oldKey.revoked_at) {
        return c.json(
          {
            error: "INVALID_STATE",
            message: "Cannot rotate a revoked API key",
          },
          { status: 400 }
        );
      }

      const newKey = rotateAPIKey(
        db,
        keyId,
        {
          tenantId: tenantContext.tenantId,
          name: oldKey.name,
          type: oldKey.type,
          environment: oldKey.environment,
          permissions: oldKey.permissions
            ? JSON.parse(oldKey.permissions)
            : undefined,
        }
      );

      return c.json(
        {
          apiKey: {
            id: newKey.id,
            name: newKey.name,
            type: newKey.type,
            environment: newKey.environment,
            createdAt: newKey.created_at,
          },
          credentials: {
            keyPrefix: newKey.keyPrefix,
            keySecret: newKey.keySecret, // Only shown once!
          },
          message: `Old key (${oldKey.key_prefix}) has been revoked`,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Failed to rotate API key:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to rotate API key" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // Revoke API Key
  // ===================================================================
  router.delete("/:keyId", async (c) => {
    const tenantContext = c.get("tenantContext");

    if (!tenantContext || !tenantContext.isValid) {
      return c.json(
        { error: "UNAUTHORIZED", message: "Invalid tenant context" },
        { status: 401 }
      );
    }

    const keyId = c.req.param("keyId");

    try {
      // Verify key belongs to this tenant
      const apiKey = db
        .prepare("SELECT * FROM api_keys WHERE id = ? AND tenant_id = ?")
        .get(keyId, tenantContext.tenantId) as any;

      if (!apiKey) {
        return c.json(
          {
            error: "NOT_FOUND",
            message: `API key not found or does not belong to your tenant: ${keyId}`,
          },
          { status: 404 }
        );
      }

      revokeAPIKey(db, keyId);

      return c.json({
        success: true,
        message: `API key revoked: ${apiKey.key_prefix}`,
      });
    } catch (error) {
      console.error("Failed to revoke API key:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to revoke API key" },
        { status: 500 }
      );
    }
  });

  return router;
}
