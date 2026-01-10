/**
 * Tenant Router Middleware
 *
 * Extracts tenant context from requests (subdomain, header, or API key).
 * This middleware is foundational - all requests must establish tenant context.
 *
 * Patterns supported:
 * 1. Subdomain: {slug}.auth.example.com → tenant:slug
 * 2. Header: X-Tenant-ID: tenant:acme-corp
 * 3. API Key: Bearer pk_live_xxx or sk_live_xxx → extract from db
 * 4. Query param: ?tenant_id=tenant:acme-corp (fallback)
 */

import { Router } from "hono";
import { Context } from "hono";
import { Database } from "better-sqlite3";
import { Tenant } from "../db/schema";

export interface TenantContext {
  tenantId: string; // "tenant:acme-corp"
  slug: string; // "acme-corp"
  tenant: Tenant | null; // Full tenant record from DB
  apiKeyId?: string; // If authenticated via API key
  isValid: boolean; // Whether tenant context was successfully established
  error?: string; // Error message if validation failed
}

export interface RequestWithTenant extends Context {
  tenant: TenantContext;
}

/**
 * Extract tenant from request using multiple strategies
 */
export async function extractTenant(
  request: Request,
  env: any,
  db: Database
): Promise<TenantContext> {
  const url = new URL(request.url);

  // Strategy 1: X-Tenant-ID header (explicit tenant override, for testing/admin)
  const tenantIdHeader = request.headers.get("X-Tenant-ID");
  if (tenantIdHeader) {
    const tenant = db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .get(tenantIdHeader) as Tenant | undefined;
    return {
      tenantId: tenantIdHeader,
      slug: tenant?.slug || "",
      tenant: tenant || null,
      isValid: !!tenant,
      error: tenant ? undefined : `Tenant not found: ${tenantIdHeader}`,
    };
  }

  // Strategy 2: Subdomain extraction (primary pattern)
  // Supports: acme.auth.example.com → tenant:acme
  const hostname = url.hostname;
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\./);
  if (subdomainMatch && !isMainDomain(hostname)) {
    const slug = subdomainMatch[1];
    const tenant = db
      .prepare("SELECT * FROM tenants WHERE slug = ?")
      .get(slug) as Tenant | undefined;

    return {
      tenantId: tenant?.id || `tenant:${slug}`,
      slug,
      tenant: tenant || null,
      isValid: !!tenant,
      error: tenant ? undefined : `Tenant not found: ${slug}`,
    };
  }

  // Strategy 3: API Key in Authorization header
  // Supports: Bearer sk_live_xxx or pk_live_xxx
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const keyPrefix = authHeader.slice(7); // Remove "Bearer "
    const apiKey = db
      .prepare("SELECT * FROM api_keys WHERE key_prefix = ? AND revoked_at IS NULL")
      .get(keyPrefix) as any | undefined;

    if (apiKey) {
      const tenant = db
        .prepare("SELECT * FROM tenants WHERE id = ?")
        .get(apiKey.tenant_id) as Tenant | undefined;

      return {
        tenantId: apiKey.tenant_id,
        slug: tenant?.slug || "",
        tenant: tenant || null,
        apiKeyId: apiKey.id,
        isValid: !!tenant,
        error: tenant ? undefined : `API key not associated with valid tenant`,
      };
    }

    return {
      tenantId: "",
      slug: "",
      tenant: null,
      isValid: false,
      error: `Invalid or revoked API key: ${keyPrefix}`,
    };
  }

  // Strategy 4: Query parameter (fallback for testing)
  const tenantParam = url.searchParams.get("tenant_id");
  if (tenantParam) {
    const tenant = db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .get(tenantParam) as Tenant | undefined;

    return {
      tenantId: tenantParam,
      slug: tenant?.slug || "",
      tenant: tenant || null,
      isValid: !!tenant,
      error: tenant ? undefined : `Tenant not found: ${tenantParam}`,
    };
  }

  // No tenant context found
  return {
    tenantId: "",
    slug: "",
    tenant: null,
    isValid: false,
    error: "No tenant context found in request",
  };
}

/**
 * Middleware: Attach tenant context to request
 * Must be applied before any route handlers
 */
export function tenantRouterMiddleware(db: Database) {
  return async (c: Context, next: any) => {
    const tenant = await extractTenant(c.req.raw, c.env, db);

    // Attach to context
    (c as any).tenant = tenant;

    // If tenant is invalid and this isn't the platform API, reject
    if (!tenant.isValid && !isPlatformAPI(c.req.path)) {
      return c.json(
        {
          error: "INVALID_TENANT",
          message: tenant.error,
        },
        { status: 401 }
      );
    }

    await next();
  };
}

/**
 * Guard: Require valid tenant context
 * Use on routes that need tenant isolation
 */
export function requireTenant() {
  return async (c: Context, next: any) => {
    const tenant = (c as any).tenant as TenantContext | undefined;

    if (!tenant?.isValid) {
      return c.json(
        {
          error: "TENANT_REQUIRED",
          message: tenant?.error || "Valid tenant context required",
        },
        { status: 401 }
      );
    }

    await next();
  };
}

/**
 * Guard: Require API key authentication
 * Use on routes that modify data
 */
export function requireAPIKey() {
  return async (c: Context, next: any) => {
    const tenant = (c as any).tenant as TenantContext | undefined;

    if (!tenant?.apiKeyId) {
      return c.json(
        {
          error: "API_KEY_REQUIRED",
          message: "API key authentication required for this endpoint",
        },
        { status: 401 }
      );
    }

    await next();
  };
}

/**
 * Guard: Require specific API key type
 */
export function requireKeyType(type: "public" | "secret" | "restricted") {
  return async (c: Context, next: any) => {
    const tenant = (c as any).tenant as TenantContext | undefined;
    const db = (c as any).db as Database;

    if (!tenant?.apiKeyId) {
      return c.json(
        {
          error: "API_KEY_REQUIRED",
          message: `${type} API key required`,
        },
        { status: 401 }
      );
    }

    const apiKey = db
      .prepare("SELECT type FROM api_keys WHERE id = ?")
      .get(tenant.apiKeyId) as any | undefined;

    if (!apiKey || apiKey.type !== type) {
      return c.json(
        {
          error: "INVALID_KEY_TYPE",
          message: `${type} API key required, got ${apiKey?.type || "unknown"}`,
        },
        { status: 403 }
      );
    }

    await next();
  };
}

/**
 * Helper: Check if hostname is main domain (not a tenant subdomain)
 */
function isMainDomain(hostname: string): boolean {
  // Main domain patterns (add as needed)
  const mainDomains = [
    "localhost",
    "127.0.0.1",
    "auth.example.com", // primary domain
  ];

  return mainDomains.some((domain) => hostname === domain);
}

/**
 * Helper: Check if path is a platform API endpoint
 * Platform APIs (like /admin/tenants) don't require tenant context
 */
function isPlatformAPI(path: string): boolean {
  const platformPaths = [
    /^\/admin\//,
    /^\/health/,
    /^\/metrics/,
    /^\/api\/v1\/platform\//,
  ];

  return platformPaths.some((pattern) => pattern.test(path));
}

/**
 * Create a tenant router for organizing tenant-specific routes
 */
export function createTenantRouter() {
  const router = new Router();

  router.use(requireTenant());

  // Routes added to this router will have tenant context
  return router;
}
