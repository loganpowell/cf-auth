/**
 * Tenant Management API
 *
 * CRUD operations for managing tenants
 * Platform admin endpoints (requires superadmin role)
 *
 * Endpoints:
 * POST   /admin/tenants              - Create new tenant
 * GET    /admin/tenants              - List tenants
 * GET    /admin/tenants/:id          - Get tenant details
 * PUT    /admin/tenants/:id          - Update tenant
 * DELETE /admin/tenants/:id          - Delete (soft) tenant
 * POST   /admin/tenants/:id/keys     - Create API key for tenant
 * GET    /admin/tenants/:id/keys     - List tenant API keys
 */

import { Router } from "hono";
import { Database } from "better-sqlite3";
import { Tenant, NewTenant } from "../db/schema";
import { namespaceId } from "../utils/namespace-isolation";
import { generateAPIKey, saveAPIKey } from "../utils/api-keys";

export function createTenantRouter(db: Database): Router {
  const router = new Router();

  // ===================================================================
  // Create Tenant
  // ===================================================================
  router.post("/", async (c) => {
    const body = await c.req.json<{
      slug: string;
      name: string;
      plan?: "free" | "pro" | "enterprise";
      parent_id?: string;
    }>();

    // Validate input
    if (!body.slug || !body.name) {
      return c.json(
        { error: "VALIDATION_ERROR", message: "slug and name are required" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "slug must be lowercase alphanumeric with hyphens",
        },
        { status: 400 }
      );
    }

    // Check slug is unique
    const existing = db
      .prepare("SELECT id FROM tenants WHERE slug = ?")
      .get(body.slug);
    if (existing) {
      return c.json(
        {
          error: "CONFLICT",
          message: `Slug already exists: ${body.slug}`,
        },
        { status: 409 }
      );
    }

    // Validate parent tenant if provided
    let depth = 0;
    if (body.parent_id) {
      const parent = db
        .prepare("SELECT depth FROM tenants WHERE id = ?")
        .get(body.parent_id) as any;

      if (!parent) {
        return c.json(
          {
            error: "NOT_FOUND",
            message: `Parent tenant not found: ${body.parent_id}`,
          },
          { status: 404 }
        );
      }

      depth = parent.depth + 1;

      // Prevent excessive nesting
      if (depth > 5) {
        return c.json(
          {
            error: "VALIDATION_ERROR",
            message: "Maximum tenant hierarchy depth is 5",
          },
          { status: 400 }
        );
      }
    }

    // Generate API keys
    const publicKeyGen = generateAPIKey({
      tenantId: "", // Will be set after tenant creation
      name: "Default Public Key",
      type: "public",
      environment: "live",
    });

    const secretKeyGen = generateAPIKey({
      tenantId: "", // Will be set after tenant creation
      name: "Default Secret Key",
      type: "secret",
      environment: "live",
    });

    // Create tenant
    const now = Math.floor(Date.now() / 1000);
    const tenantId = `tenant:${body.slug}`;

    try {
      const stmt = db.prepare(
        `
        INSERT INTO tenants (
          id, slug, name, plan, status,
          public_key, secret_key,
          parent_id, depth,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      );

      stmt.run(
        tenantId,
        body.slug,
        body.name,
        body.plan || "free",
        "active",
        publicKeyGen.keyPrefix,
        secretKeyGen.keyPrefix, // Note: in production, encrypt this!
        body.parent_id || null,
        depth,
        now,
        now
      );

      // Save API keys (with tenant now known)
      saveAPIKey(
        db,
        {
          tenantId,
          name: "Default Public Key",
          type: "public",
          environment: "live",
        },
        publicKeyGen
      );

      saveAPIKey(
        db,
        {
          tenantId,
          name: "Default Secret Key",
          type: "secret",
          environment: "live",
        },
        secretKeyGen
      );

      const tenant = db
        .prepare("SELECT * FROM tenants WHERE id = ?")
        .get(tenantId) as Tenant;

      return c.json(
        {
          tenant,
          credentials: {
            publicKey: publicKeyGen.keyPrefix,
            secretKey: secretKeyGen.keySecret, // Only shown once!
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Failed to create tenant:", error);
      return c.json(
        {
          error: "INTERNAL_ERROR",
          message: "Failed to create tenant",
        },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // List Tenants
  // ===================================================================
  router.get("/", async (c) => {
    try {
      const tenants = db
        .prepare(
          `
        SELECT id, slug, name, plan, status, depth, parent_id,
               created_at, updated_at
        FROM tenants
        WHERE status != 'deleted'
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
      `
        )
        .all(100, 0) as Tenant[];

      return c.json({ tenants });
    } catch (error) {
      console.error("Failed to list tenants:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to list tenants" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // Get Tenant
  // ===================================================================
  router.get("/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId");

    try {
      const tenant = db
        .prepare("SELECT * FROM tenants WHERE id = ?")
        .get(tenantId) as Tenant | undefined;

      if (!tenant) {
        return c.json(
          { error: "NOT_FOUND", message: `Tenant not found: ${tenantId}` },
          { status: 404 }
        );
      }

      return c.json({ tenant });
    } catch (error) {
      console.error("Failed to get tenant:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to get tenant" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // Update Tenant
  // ===================================================================
  router.put("/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId");
    const body = await c.req.json<{
      name?: string;
      plan?: "free" | "pro" | "enterprise";
      branding?: object;
      limits?: object;
    }>();

    try {
      const tenant = db
        .prepare("SELECT * FROM tenants WHERE id = ?")
        .get(tenantId) as Tenant | undefined;

      if (!tenant) {
        return c.json(
          { error: "NOT_FOUND", message: `Tenant not found: ${tenantId}` },
          { status: 404 }
        );
      }

      const now = Math.floor(Date.now() / 1000);

      // Build update statement dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (body.name !== undefined) {
        updates.push("name = ?");
        values.push(body.name);
      }
      if (body.plan !== undefined) {
        updates.push("plan = ?");
        values.push(body.plan);
      }
      if (body.branding !== undefined) {
        updates.push("branding = ?");
        values.push(JSON.stringify(body.branding));
      }
      if (body.limits !== undefined) {
        updates.push("limits = ?");
        values.push(JSON.stringify(body.limits));
      }

      updates.push("updated_at = ?");
      values.push(now);
      values.push(tenantId);

      const stmt = db.prepare(
        `UPDATE tenants SET ${updates.join(", ")} WHERE id = ?`
      );
      stmt.run(...values);

      const updated = db
        .prepare("SELECT * FROM tenants WHERE id = ?")
        .get(tenantId) as Tenant;

      return c.json({ tenant: updated });
    } catch (error) {
      console.error("Failed to update tenant:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to update tenant" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // Delete Tenant (soft delete)
  // ===================================================================
  router.delete("/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId");

    try {
      const tenant = db
        .prepare("SELECT * FROM tenants WHERE id = ?")
        .get(tenantId) as Tenant | undefined;

      if (!tenant) {
        return c.json(
          { error: "NOT_FOUND", message: `Tenant not found: ${tenantId}` },
          { status: 404 }
        );
      }

      // Soft delete
      db.prepare("UPDATE tenants SET status = 'deleted', updated_at = ? WHERE id = ?").run(
        Math.floor(Date.now() / 1000),
        tenantId
      );

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete tenant:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to delete tenant" },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // Create API Key for Tenant
  // ===================================================================
  router.post("/:tenantId/keys", async (c) => {
    const tenantId = c.req.param("tenantId");
    const body = await c.req.json<{
      name: string;
      type: "public" | "secret" | "restricted";
      environment: "test" | "live";
      permissions?: string[];
    }>();

    try {
      const tenant = db
        .prepare("SELECT id FROM tenants WHERE id = ?")
        .get(tenantId) as any;

      if (!tenant) {
        return c.json(
          { error: "NOT_FOUND", message: `Tenant not found: ${tenantId}` },
          { status: 404 }
        );
      }

      const generated = generateAPIKey({
        tenantId,
        name: body.name,
        type: body.type,
        environment: body.environment,
        permissions: body.permissions,
      });

      const apiKey = saveAPIKey(
        db,
        {
          tenantId,
          name: body.name,
          type: body.type,
          environment: body.environment,
          permissions: body.permissions,
        },
        generated
      );

      return c.json(
        {
          apiKey,
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
        {
          error: "INTERNAL_ERROR",
          message: "Failed to create API key",
        },
        { status: 500 }
      );
    }
  });

  // ===================================================================
  // List API Keys for Tenant
  // ===================================================================
  router.get("/:tenantId/keys", async (c) => {
    const tenantId = c.req.param("tenantId");

    try {
      const tenant = db
        .prepare("SELECT id FROM tenants WHERE id = ?")
        .get(tenantId) as any;

      if (!tenant) {
        return c.json(
          { error: "NOT_FOUND", message: `Tenant not found: ${tenantId}` },
          { status: 404 }
        );
      }

      const apiKeys = db
        .prepare(
          `
        SELECT id, name, type, environment, created_at, revoked_at
        FROM api_keys
        WHERE tenant_id = ?
        ORDER BY created_at DESC
      `
        )
        .all(tenantId) as any[];

      return c.json({ apiKeys });
    } catch (error) {
      console.error("Failed to list API keys:", error);
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to list API keys" },
        { status: 500 }
      );
    }
  });

  return router;
}
