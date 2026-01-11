import { Hono } from "hono";
import { eq, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  requireKeyType,
  tenantRouterMiddleware,
  type TenantContext,
} from "../../middleware/tenant-router";
import { generateAPIKey, hashAPIKey } from "../../utils/api-keys";
import type { Env } from "../../types";

/**
 * Admin Dashboard API
 *
 * Protected endpoints for platform administrators to manage:
 * - Tenants (CRUD operations)
 * - API keys (create, list, revoke)
 * - Usage metrics and billing
 * - Platform settings
 *
 * Authentication: Platform admin API key (type=secret, tenant=relish-platform)
 */

export function createAdminRouter() {
  const router = new Hono<{ Bindings: Env }>();

  // Apply tenant middleware to all admin routes
  // This extracts tenant context from API keys in Authorization header
  router.use("/*", async (c, next) => {
    const db = c.env.DB;
    return tenantRouterMiddleware(db)(c, next);
  });

  /**
   * GET /admin/debug/tenant
   * Debug endpoint to check tenant context
   */
  router.get("/debug/tenant", async (c) => {
    const tenant = (c as any).tenant as TenantContext | undefined;
    return c.json({
      tenant: tenant || null,
      hasApiKey: !!tenant?.apiKeyId,
      isValid: tenant?.isValid,
      error: tenant?.error,
    });
  });

  /**
   * GET /admin/dashboard
   * Admin overview with key metrics
   */
  router.get("/dashboard", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });

    try {
      // Get basic stats
      const tenantCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.tenants)
        .where(eq(schema.tenants.status, "active"));

      const apiKeyCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.apiKeys)
        .where(isNull(schema.apiKeys.revokedAt));

      const totalAdmins = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.platformAdmins)
        .where(eq(schema.platformAdmins.status, "active"));

      return c.json(
        {
          status: "success",
          timestamp: new Date().toISOString(),
          metrics: {
            activeTenants: tenantCount[0]?.count || 0,
            activeAPIKeys: apiKeyCount[0]?.count || 0,
            totalAdmins: totalAdmins[0]?.count || 0,
            environment: env.ENVIRONMENT,
          },
        },
        200
      );
    } catch (error) {
      console.error("Dashboard error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to load dashboard metrics",
        },
        500
      );
    }
  });

  /**
   * GET /admin/tenants
   * List all tenants with pagination and filtering
   */
  router.get("/tenants", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });

    // Get query parameters from c.req instead of c.query()
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const status = (c.req.query("status") || "active") as
      | "active"
      | "suspended"
      | "deleted";

    try {
      const offset = (page - 1) * limit;

      const tenants = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.status, status))
        .limit(limit)
        .offset(offset);

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.tenants)
        .where(eq(schema.tenants.status, status));

      return c.json(
        {
          status: "success",
          data: tenants,
          pagination: {
            page,
            limit,
            total: totalResult[0]?.count || 0,
            pages: Math.ceil((totalResult[0]?.count || 0) / limit),
          },
        },
        200
      );
    } catch (error) {
      console.error("List tenants error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to list tenants",
        },
        500
      );
    }
  });

  /**
   * POST /admin/tenants
   * Create a new tenant with auto-generated API keys
   */
  router.post("/tenants", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });

    try {
      const body = await c.req.json();
      const {
        slug,
        name,
        plan = "free",
        parentId = null,
      } = body as {
        slug: string;
        name: string;
        plan?: "free" | "pro" | "enterprise";
        parentId?: string | null;
      };

      // Validate input
      if (!slug || !name) {
        return c.json(
          {
            status: "error",
            error: "slug and name are required",
          },
          400
        );
      }

      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return c.json(
          {
            status: "error",
            error:
              "slug must contain only lowercase letters, numbers, and hyphens",
          },
          400
        );
      }

      // Check slug uniqueness
      const existing = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, slug))
        .limit(1);

      if (existing.length > 0) {
        return c.json(
          {
            status: "error",
            error: "slug already exists",
          },
          409
        );
      }

      // Validate hierarchical depth if parent specified
      let depth = 0;
      if (parentId) {
        const parent = await db
          .select()
          .from(schema.tenants)
          .where(eq(schema.tenants.id, parentId))
          .limit(1);

        if (parent.length === 0) {
          return c.json(
            {
              status: "error",
              error: "parent_id not found",
            },
            404
          );
        }

        depth = (parent[0]!.depth || 0) + 1;

        if (depth > 5) {
          return c.json(
            {
              status: "error",
              error: "maximum nesting depth (5) exceeded",
            },
            400
          );
        }
      }

      // Generate tenant ID
      const tenantId = `tenant:${slug}`;

      // Generate API keys using proper function
      const publicKeyGen = generateAPIKey({
        tenantId,
        name: "Public API Key",
        type: "public",
        environment: "live",
      });

      const secretKeyGen = generateAPIKey({
        tenantId,
        name: "Secret API Key",
        type: "secret",
        environment: "live",
      });

      // Hash the secret key
      const secretKeyHash = hashAPIKey(
        secretKeyGen.keyPrefix,
        secretKeyGen.keySecret
      );

      const now = Math.floor(Date.now() / 1000);

      // Insert tenant
      await db.insert(schema.tenants).values({
        id: tenantId,
        slug,
        name,
        plan,
        status: "active",
        parentId: parentId || null,
        depth,
        publicKey: publicKeyGen.keyPrefix,
        secretKey: secretKeyGen.keyPrefix,
        createdAt: now,
        updatedAt: now,
      });

      // Insert API keys
      await db.insert(schema.apiKeys).values([
        {
          id: publicKeyGen.keyId,
          tenantId,
          name: "Public API Key",
          keyPrefix: publicKeyGen.keyPrefix,
          keyHash: hashAPIKey(publicKeyGen.keyPrefix),
          type: "public",
          environment: "live",
          permissions: null,
          createdAt: now,
          revokedAt: null,
        },
        {
          id: secretKeyGen.keyId,
          tenantId,
          name: "Secret API Key",
          keyPrefix: secretKeyGen.keyPrefix,
          keyHash: secretKeyHash,
          type: "secret",
          environment: "live",
          permissions: null,
          createdAt: now,
          revokedAt: null,
        },
      ]);

      return c.json(
        {
          status: "success",
          data: {
            tenant: {
              id: tenantId,
              slug,
              name,
              plan,
              status: "active",
              depth,
              parentId,
            },
            credentials: {
              publicKey: {
                prefix: publicKeyGen.keyPrefix,
                // Secret not shown for public key
              },
              secretKey: {
                prefix: secretKeyGen.keyPrefix,
                secret: secretKeyGen.keySecret, // Only shown once!
              },
            },
          },
        },
        201
      );
    } catch (error) {
      console.error("Create tenant error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to create tenant",
        },
        500
      );
    }
  });

  /**
   * GET /admin/tenants/:id
   * Get tenant details
   */
  router.get("/tenants/:id", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });
    const tenantId = c.req.param("id");

    try {
      const tenant = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return c.json(
          {
            status: "error",
            error: "Tenant not found",
          },
          404
        );
      }

      // Get API keys count
      const keyCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.tenantId, tenantId));

      // Get user count
      const userCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.platformAdmins);

      return c.json(
        {
          status: "success",
          data: {
            ...tenant[0],
            stats: {
              apiKeys: keyCount[0]?.count || 0,
              users: userCount[0]?.count || 0,
            },
          },
        },
        200
      );
    } catch (error) {
      console.error("Get tenant error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to get tenant",
        },
        500
      );
    }
  });

  /**
   * PUT /admin/tenants/:id
   * Update tenant (plan, branding, limits)
   */
  router.put("/tenants/:id", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });
    const tenantId = c.req.param("id");

    try {
      const body = await c.req.json();
      const { plan, branding, limits } = body as {
        plan?: string;
        branding?: Record<string, string>;
        limits?: Record<string, number>;
      };

      // Get tenant first
      const tenant = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return c.json(
          {
            status: "error",
            error: "Tenant not found",
          },
          404
        );
      }

      // Update tenant
      const updates: any = {
        updatedAt: Math.floor(Date.now() / 1000),
      };

      if (plan) updates.plan = plan;
      if (branding) updates.branding = JSON.stringify(branding);
      if (limits) updates.limits = JSON.stringify(limits);

      await db
        .update(schema.tenants)
        .set(updates)
        .where(eq(schema.tenants.id, tenantId));

      return c.json(
        {
          status: "success",
          message: "Tenant updated",
        },
        200
      );
    } catch (error) {
      console.error("Update tenant error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to update tenant",
        },
        500
      );
    }
  });

  /**
   * DELETE /admin/tenants/:id
   * Soft delete tenant
   */
  router.delete("/tenants/:id", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });
    const tenantId = c.req.param("id");

    try {
      // Get tenant first
      const tenant = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return c.json(
          {
            status: "error",
            error: "Tenant not found",
          },
          404
        );
      }

      // Soft delete
      await db
        .update(schema.tenants)
        .set({
          status: "deleted",
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(schema.tenants.id, tenantId));

      return c.json(
        {
          status: "success",
          message: "Tenant deleted",
        },
        200
      );
    } catch (error) {
      console.error("Delete tenant error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to delete tenant",
        },
        500
      );
    }
  });

  /**
   * GET /admin/tenants/:id/keys
   * List API keys for tenant
   */
  router.get("/tenants/:id/keys", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });
    const tenantId = c.req.param("id");

    try {
      const keys = await db
        .select()
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.tenantId, tenantId));

      // Remove sensitive data (hash)
      const safeKeys = keys.map(({ keyHash, ...key }) => key);

      return c.json(
        {
          status: "success",
          data: safeKeys,
        },
        200
      );
    } catch (error) {
      console.error("List API keys error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to list API keys",
        },
        500
      );
    }
  });

  /**
   * POST /admin/tenants/:id/keys
   * Create API key for tenant
   */
  router.post("/tenants/:id/keys", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });
    const tenantId = c.req.param("id");

    try {
      const body = await c.req.json();
      const {
        type = "secret",
        environment = "live",
        name,
        permissions,
      } = body as {
        type: "public" | "secret" | "restricted";
        environment: "test" | "live";
        name?: string;
        permissions?: string[];
      };

      // Verify tenant exists
      const tenant = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return c.json(
          {
            status: "error",
            error: "Tenant not found",
          },
          404
        );
      }

      // Generate key
      const apiKey = generateAPIKey({
        tenantId,
        name: name || `${type} key`,
        type,
        environment,
        permissions,
      });

      const now = Math.floor(Date.now() / 1000);
      const keyHash = hashAPIKey(apiKey.keyPrefix, apiKey.keySecret);

      // Insert key
      await db.insert(schema.apiKeys).values({
        id: apiKey.keyId,
        tenantId,
        name: name || `${type} key`,
        keyPrefix: apiKey.keyPrefix,
        keyHash,
        type,
        environment,
        permissions: permissions ? JSON.stringify(permissions) : null,
        createdAt: now,
        revokedAt: null,
      });

      return c.json(
        {
          status: "success",
          data: {
            id: apiKey.keyId,
            prefix: apiKey.keyPrefix,
            secret: apiKey.keySecret, // Only shown once!
            type,
            environment,
          },
        },
        201
      );
    } catch (error) {
      console.error("Create API key error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to create API key",
        },
        500
      );
    }
  });

  /**
   * GET /admin/metrics
   * Platform-wide usage metrics
   */
  router.get("/metrics", requireKeyType("secret"), async (c) => {
    const env = c.env;
    const db = drizzle(env.DB, { schema });

    try {
      const metrics = await db.select().from(schema.usageMetrics);

      // Group by metric type
      const grouped = metrics.reduce((acc, metric) => {
        const key = metric.metricType || "unknown";
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(metric);
        return acc;
      }, {} as Record<string, typeof metrics>);

      return c.json(
        {
          status: "success",
          data: grouped,
        },
        200
      );
    } catch (error) {
      console.error("Get metrics error:", error);
      return c.json(
        {
          status: "error",
          error: "Failed to get metrics",
        },
        500
      );
    }
  });

  return router;
}
