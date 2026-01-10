/**
 * Integration Tests for Multi-Tenant Infrastructure
 *
 * Tests for:
 * 1. Tenant Router - Extract tenant from request
 * 2. Namespace Isolation - Prevent cross-tenant data access
 * 3. API Key Management - Authenticate and validate permissions
 * 4. Tenant CRUD endpoints - Create, read, update, delete tenants
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDatabase } from "../db/schema";
import { extractTenant, TenantContext } from "../middleware/tenant-router";
import {
  namespaceId,
  extractTenantId,
  extractResourceType,
  extractResourceId,
  verifyTenantOwnership,
  isValidNamespacedId,
} from "../utils/namespace-isolation";
import {
  generateAPIKey,
  hashAPIKey,
  saveAPIKey,
  validateAPIKey,
  hasPermission,
  revokeAPIKey,
  rotateAPIKey,
} from "../utils/api-keys";

let db: Database.Database;

beforeEach(() => {
  // Create in-memory database for testing
  db = new Database(":memory:");
  initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

// ===================================================================
// Tenant Router Tests
// ===================================================================

describe("Tenant Router", () => {
  it("extracts tenant from X-Tenant-ID header", () => {
    // Insert test tenant
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test", "test", "Test Tenant", "free", "active");

    const req = new Request("http://example.com/api", {
      headers: { "X-Tenant-ID": "tenant:test" },
    });

    const context = extractTenant(db, req);

    expect(context.isValid).toBe(true);
    expect(context.tenantId).toBe("tenant:test");
    expect(context.slug).toBe("test");
  });

  it("extracts tenant from subdomain", () => {
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:acme-corp", "acme-corp", "ACME Corp", "pro", "active");

    const req = new Request("http://acme-corp.auth.example.com/api");

    const context = extractTenant(db, req);

    expect(context.isValid).toBe(true);
    expect(context.tenantId).toBe("tenant:acme-corp");
    expect(context.slug).toBe("acme-corp");
  });

  it("rejects invalid tenant ID", () => {
    const req = new Request("http://example.com/api", {
      headers: { "X-Tenant-ID": "invalid-tenant" },
    });

    const context = extractTenant(db, req);

    expect(context.isValid).toBe(false);
    expect(context.error).toContain("not found");
  });
});

// ===================================================================
// Namespace Isolation Tests
// ===================================================================

describe("Namespace Isolation", () => {
  it("creates properly formatted namespace IDs", () => {
    const id = namespaceId("tenant:acme-corp", "user", "alice");

    expect(id).toBe("tenant:acme-corp:user:alice");
  });

  it("extracts tenant ID from namespaced ID", () => {
    const namespacedId = "tenant:acme-corp:user:alice";

    const tenantId = extractTenantId(namespacedId);

    expect(tenantId).toBe("tenant:acme-corp");
  });

  it("extracts resource type from namespaced ID", () => {
    const namespacedId = "tenant:acme-corp:user:alice";

    const resourceType = extractResourceType(namespacedId);

    expect(resourceType).toBe("user");
  });

  it("extracts resource ID from namespaced ID", () => {
    const namespacedId = "tenant:acme-corp:user:alice";

    const resourceId = extractResourceId(namespacedId);

    expect(resourceId).toBe("alice");
  });

  it("validates tenant ownership", () => {
    const namespacedId = "tenant:acme-corp:user:alice";

    const isOwner = verifyTenantOwnership(namespacedId, "tenant:acme-corp");

    expect(isOwner).toBe(true);
  });

  it("rejects cross-tenant access", () => {
    const namespacedId = "tenant:acme-corp:user:alice";

    const isOwner = verifyTenantOwnership(
      namespacedId,
      "tenant:other-corp"
    );

    expect(isOwner).toBe(false);
  });

  it("validates namespaced ID format", () => {
    expect(isValidNamespacedId("tenant:acme-corp:user:alice")).toBe(true);
    expect(isValidNamespacedId("invalid")).toBe(false);
    expect(isValidNamespacedId("tenant:acme-corp:user")).toBe(false);
  });
});

// ===================================================================
// API Key Tests
// ===================================================================

describe("API Key Management", () => {
  beforeEach(() => {
    // Insert test tenant
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test", "test", "Test Tenant", "free", "active");
  });

  it("generates API key with correct format", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Test Key",
      type: "secret",
      environment: "live",
    });

    expect(generated.keyPrefix).toMatch(/^sk_live_/);
    expect(generated.keySecret).toMatch(/^sk_live_/);
    expect(generated.keyId).toBeDefined();
  });

  it("generates public key with correct format", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Public Key",
      type: "public",
      environment: "live",
    });

    expect(generated.keyPrefix).toMatch(/^pk_live_/);
  });

  it("generates restricted key with correct format", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Restricted Key",
      type: "restricted",
      environment: "test",
    });

    expect(generated.keyPrefix).toMatch(/^rk_test_/);
  });

  it("hashes API key", () => {
    const keySecret = "sk_live_" + "x".repeat(32);
    const hash = hashAPIKey(keySecret);

    expect(hash).not.toBe(keySecret);
    expect(hash).toBeTruthy();
    expect(hash.length).toBeGreaterThan(0);
  });

  it("saves and validates API key", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Test Key",
      type: "secret",
      environment: "live",
    });

    const saved = saveAPIKey(
      db,
      {
        tenantId: "tenant:test",
        name: "Test Key",
        type: "secret",
        environment: "live",
      },
      generated
    );

    expect(saved.id).toBeDefined();
    expect(saved.key_prefix).toBe(generated.keyPrefix);

    // Validate the key
    const validated = validateAPIKey(
      db,
      generated.keyPrefix,
      generated.keySecret
    );

    expect(validated).toBeTruthy();
    expect(validated?.tenant_id).toBe("tenant:test");
  });

  it("rejects invalid API key", () => {
    const validated = validateAPIKey(db, "sk_live_invalid", "secret");

    expect(validated).toBeNull();
  });

  it("checks permission for API key", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Restricted Key",
      type: "restricted",
      environment: "live",
      permissions: ["read:users", "write:projects"],
    });

    const saved = saveAPIKey(
      db,
      {
        tenantId: "tenant:test",
        name: "Restricted Key",
        type: "restricted",
        environment: "live",
        permissions: ["read:users", "write:projects"],
      },
      generated
    );

    expect(hasPermission(saved, "read:users")).toBe(true);
    expect(hasPermission(saved, "write:projects")).toBe(true);
    expect(hasPermission(saved, "delete:users")).toBe(false);
  });

  it("revokes API key", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Test Key",
      type: "secret",
      environment: "live",
    });

    const saved = saveAPIKey(
      db,
      {
        tenantId: "tenant:test",
        name: "Test Key",
        type: "secret",
        environment: "live",
      },
      generated
    );

    revokeAPIKey(db, saved.id);

    const validated = validateAPIKey(
      db,
      generated.keyPrefix,
      generated.keySecret
    );

    expect(validated).toBeNull(); // Should fail because key is revoked
  });

  it("rotates API key", () => {
    const generated = generateAPIKey({
      tenantId: "tenant:test",
      name: "Test Key",
      type: "secret",
      environment: "live",
    });

    const saved = saveAPIKey(
      db,
      {
        tenantId: "tenant:test",
        name: "Test Key",
        type: "secret",
        environment: "live",
      },
      generated
    );

    const rotated = rotateAPIKey(
      db,
      saved.id,
      {
        tenantId: "tenant:test",
        name: "Test Key",
        type: "secret",
        environment: "live",
      }
    );

    expect(rotated.id).not.toBe(saved.id);
    expect(rotated.keyPrefix).not.toBe(generated.keyPrefix);

    // Old key should be revoked
    const validatedOld = validateAPIKey(
      db,
      generated.keyPrefix,
      generated.keySecret
    );
    expect(validatedOld).toBeNull();

    // New key should be valid
    const validatedNew = validateAPIKey(
      db,
      rotated.keyPrefix,
      rotated.keySecret
    );
    expect(validatedNew).toBeTruthy();
  });
});

// ===================================================================
// Tenant CRUD Tests
// ===================================================================

describe("Tenant CRUD Operations", () => {
  it("creates a new tenant", () => {
    const stmt = db.prepare(
      `
      INSERT INTO tenants (id, slug, name, plan, status)
      VALUES (?, ?, ?, ?, ?)
    `
    );

    stmt.run("tenant:new", "new", "New Tenant", "free", "active");

    const tenant = db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .get("tenant:new") as any;

    expect(tenant).toBeDefined();
    expect(tenant.slug).toBe("new");
    expect(tenant.name).toBe("New Tenant");
  });

  it("retrieves a tenant by ID", () => {
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test", "test", "Test Tenant", "free", "active");

    const tenant = db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .get("tenant:test") as any;

    expect(tenant.id).toBe("tenant:test");
  });

  it("updates a tenant", () => {
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test", "test", "Test Tenant", "free", "active");

    db.prepare("UPDATE tenants SET plan = ? WHERE id = ?").run("pro", "tenant:test");

    const tenant = db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .get("tenant:test") as any;

    expect(tenant.plan).toBe("pro");
  });

  it("soft deletes a tenant", () => {
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test", "test", "Test Tenant", "free", "active");

    db.prepare("UPDATE tenants SET status = ? WHERE id = ?").run(
      "deleted",
      "tenant:test"
    );

    const tenant = db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .get("tenant:test") as any;

    expect(tenant.status).toBe("deleted");
  });

  it("lists active tenants", () => {
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test1", "test1", "Test 1", "free", "active");

    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test2", "test2", "Test 2", "pro", "active");

    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:test3", "test3", "Test 3", "free", "deleted");

    const tenants = db
      .prepare("SELECT * FROM tenants WHERE status != ? ORDER BY created_at DESC")
      .all("deleted") as any[];

    expect(tenants.length).toBe(2);
  });
});

// ===================================================================
// Multi-Tenant Data Isolation Tests
// ===================================================================

describe("Multi-Tenant Data Isolation", () => {
  beforeEach(() => {
    // Create two tenants
    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:acme", "acme", "ACME Corp", "pro", "active");

    db.prepare(
      "INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, ?)"
    ).run("tenant:globex", "globex", "Globex Corp", "pro", "active");
  });

  it("prevents cross-tenant data access via namespace verification", () => {
    const acmeUserId = namespaceId("tenant:acme", "user", "alice");
    const globexUserId = namespaceId("tenant:globex", "user", "bob");

    // ACME can access their own data
    expect(verifyTenantOwnership(acmeUserId, "tenant:acme")).toBe(true);

    // ACME cannot access Globex data
    expect(verifyTenantOwnership(globexUserId, "tenant:acme")).toBe(false);

    // Globex can access their own data
    expect(verifyTenantOwnership(globexUserId, "tenant:globex")).toBe(true);
  });

  it("enforces namespace isolation in queries", () => {
    // This test demonstrates how the namespace prefix is used in SQL queries
    const tenantId = "tenant:acme";
    const resourceType = "user";
    const resourceId = "alice";

    const namespacedId = namespaceId(tenantId, resourceType, resourceId);

    // Extracted components match original input
    expect(extractTenantId(namespacedId)).toBe(tenantId);
    expect(extractResourceType(namespacedId)).toBe(resourceType);
    expect(extractResourceId(namespacedId)).toBe(resourceId);
  });
});
