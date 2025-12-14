/**
 * Seed Permission System
 *
 * Creates initial system roles with permission bitmaps:
 * - Admin: Full permissions for all domains
 * - Member: Basic read/write permissions
 * - Viewer: Read-only permissions
 *
 * Usage:
 *   pnpm tsx scripts/database/seed-permissions.ts
 */

// Simple ID generator (no external dependencies)
function generateId(): string {
  return `role_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Permission constants (from src/utils/permissions.ts)
const PERMISSIONS = {
  // Organization permissions (bits 0-19)
  ORG_READ: 1n << 0n,
  ORG_UPDATE: 1n << 1n,
  ORG_DELETE: 1n << 2n,
  ORG_SETTINGS_READ: 1n << 3n,
  ORG_SETTINGS_UPDATE: 1n << 4n,
  ORG_MEMBERS_READ: 1n << 5n,
  ORG_MEMBERS_INVITE: 1n << 6n,
  ORG_MEMBERS_REMOVE: 1n << 7n,
  ORG_BILLING_READ: 1n << 8n,
  ORG_BILLING_UPDATE: 1n << 9n,

  // Team permissions (bits 20-29)
  TEAM_CREATE: 1n << 20n,
  TEAM_READ: 1n << 21n,
  TEAM_UPDATE: 1n << 22n,
  TEAM_DELETE: 1n << 23n,
  TEAM_MEMBERS_READ: 1n << 24n,
  TEAM_MEMBERS_ADD: 1n << 25n,
  TEAM_MEMBERS_REMOVE: 1n << 26n,

  // Repository permissions (bits 30-39)
  REPO_CREATE: 1n << 30n,
  REPO_READ: 1n << 31n,
  REPO_UPDATE: 1n << 32n,
  REPO_DELETE: 1n << 33n,
  REPO_SETTINGS_READ: 1n << 34n,
  REPO_SETTINGS_UPDATE: 1n << 35n,

  // Data permissions (bits 40-49)
  DATA_READ: 1n << 40n,
  DATA_WRITE: 1n << 41n,
  DATA_DELETE: 1n << 42n,
  DATA_EXPORT: 1n << 43n,
  DATA_IMPORT: 1n << 44n,

  // Collaboration permissions (bits 50-59)
  COLLAB_INVITE: 1n << 50n,
  COLLAB_ROLE_ASSIGN: 1n << 51n,
  COLLAB_ROLE_REVOKE: 1n << 52n,

  // Admin/Permission permissions (bits 60-79)
  ADMIN_AUDIT_READ: 1n << 60n,
  ADMIN_BILLING_FULL: 1n << 61n,
  PERM_GRANT: 1n << 70n,
  PERM_REVOKE: 1n << 71n,
  PERM_ROLE_CREATE: 1n << 72n,
  PERM_ROLE_UPDATE: 1n << 73n,
  PERM_ROLE_DELETE: 1n << 74n,
};

// Helper to split bigint into low/high strings
function splitBitmap(bitmap: bigint): { low: string; high: string } {
  const low = bitmap & ((1n << 64n) - 1n);
  const high = bitmap >> 64n;
  return {
    low: low.toString(),
    high: high.toString(),
  };
}

// System role definitions
const SYSTEM_ROLES = [
  {
    id: generateId(),
    name: "Admin",
    description: "Full administrative access to all features and permissions",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_UPDATE |
      PERMISSIONS.ORG_DELETE |
      PERMISSIONS.ORG_SETTINGS_READ |
      PERMISSIONS.ORG_SETTINGS_UPDATE |
      PERMISSIONS.ORG_MEMBERS_READ |
      PERMISSIONS.ORG_MEMBERS_INVITE |
      PERMISSIONS.ORG_MEMBERS_REMOVE |
      PERMISSIONS.ORG_BILLING_READ |
      PERMISSIONS.ORG_BILLING_UPDATE |
      PERMISSIONS.TEAM_CREATE |
      PERMISSIONS.TEAM_READ |
      PERMISSIONS.TEAM_UPDATE |
      PERMISSIONS.TEAM_DELETE |
      PERMISSIONS.TEAM_MEMBERS_READ |
      PERMISSIONS.TEAM_MEMBERS_ADD |
      PERMISSIONS.TEAM_MEMBERS_REMOVE |
      PERMISSIONS.REPO_CREATE |
      PERMISSIONS.REPO_READ |
      PERMISSIONS.REPO_UPDATE |
      PERMISSIONS.REPO_DELETE |
      PERMISSIONS.REPO_SETTINGS_READ |
      PERMISSIONS.REPO_SETTINGS_UPDATE |
      PERMISSIONS.DATA_READ |
      PERMISSIONS.DATA_WRITE |
      PERMISSIONS.DATA_DELETE |
      PERMISSIONS.DATA_EXPORT |
      PERMISSIONS.DATA_IMPORT |
      PERMISSIONS.COLLAB_INVITE |
      PERMISSIONS.COLLAB_ROLE_ASSIGN |
      PERMISSIONS.COLLAB_ROLE_REVOKE |
      PERMISSIONS.ADMIN_AUDIT_READ |
      PERMISSIONS.ADMIN_BILLING_FULL |
      PERMISSIONS.PERM_GRANT |
      PERMISSIONS.PERM_REVOKE |
      PERMISSIONS.PERM_ROLE_CREATE |
      PERMISSIONS.PERM_ROLE_UPDATE |
      PERMISSIONS.PERM_ROLE_DELETE,
    isSystem: true,
  },
  {
    id: generateId(),
    name: "Member",
    description:
      "Standard member with read/write access to organization resources",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_SETTINGS_READ |
      PERMISSIONS.ORG_MEMBERS_READ |
      PERMISSIONS.TEAM_READ |
      PERMISSIONS.TEAM_MEMBERS_READ |
      PERMISSIONS.REPO_CREATE |
      PERMISSIONS.REPO_READ |
      PERMISSIONS.REPO_UPDATE |
      PERMISSIONS.REPO_SETTINGS_READ |
      PERMISSIONS.DATA_READ |
      PERMISSIONS.DATA_WRITE |
      PERMISSIONS.DATA_EXPORT |
      PERMISSIONS.COLLAB_INVITE,
    isSystem: true,
  },
  {
    id: generateId(),
    name: "Viewer",
    description: "Read-only access to organization resources",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_SETTINGS_READ |
      PERMISSIONS.ORG_MEMBERS_READ |
      PERMISSIONS.TEAM_READ |
      PERMISSIONS.TEAM_MEMBERS_READ |
      PERMISSIONS.REPO_READ |
      PERMISSIONS.REPO_SETTINGS_READ |
      PERMISSIONS.DATA_READ,
    isSystem: true,
  },
  {
    id: generateId(),
    name: "Billing Manager",
    description: "Manages organization billing and subscription",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_BILLING_READ |
      PERMISSIONS.ORG_BILLING_UPDATE |
      PERMISSIONS.ADMIN_BILLING_FULL,
    isSystem: true,
  },
];

// Generate SQL INSERT statements
const timestamp = Date.now();

console.log("-- Permission System Seed Data");
console.log("-- Generated:", new Date().toISOString());
console.log("");
console.log("-- Insert system roles");
console.log("");

for (const role of SYSTEM_ROLES) {
  const { low, high } = splitBitmap(role.permissions);

  console.log(
    `INSERT INTO roles (id, name, description, permissions_low, permissions_high, is_system, organization_id, created_at, updated_at)`
  );
  console.log(
    `VALUES ('${role.id}', '${role.name}', '${
      role.description
    }', '${low}', '${high}', ${
      role.isSystem ? 1 : 0
    }, NULL, ${timestamp}, ${timestamp});`
  );
  console.log("");
}

console.log("-- Seed data complete!");
console.log(`-- Created ${SYSTEM_ROLES.length} system roles`);
console.log("");
console.log("-- To apply this seed data:");
console.log(
  "--   pnpm tsx scripts/database/seed-permissions.ts > /tmp/seed.sql"
);
console.log("--   wrangler d1 execute auth-db --local --file=/tmp/seed.sql");
