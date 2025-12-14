/**
 * Seed Test Data
 *
 * Creates comprehensive test data for development and E2E testing:
 * - System roles with permission bitmaps (Admin, Member, Viewer, Billing Manager)
 * - Dummy users with various states (verified, unverified, suspended)
 * - Role assignments for testing permission flows
 *
 * Usage:
 *   pnpm tsx scripts/database/seed-data.ts > /tmp/seed.sql
 *   wrangler d1 execute AUTH_DB --local --file=/tmp/seed.sql
 *
 * Or use with cleanup script:
 *   ./scripts/database/cleanup-db.sh --seed
 */

import * as crypto from "crypto";

// ============================================================================
// Utilities
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 15)}`;
}

/**
 * Hash password using PBKDF2 (matches src/utils/crypto.ts implementation)
 * This ensures seed passwords can actually be verified during login
 */
function hashPassword(password: string): string {
  // Generate a random salt (16 bytes)
  const salt = crypto.randomBytes(16);

  // Derive key using PBKDF2 (matching the Web Crypto API parameters)
  const iterations = 100000; // OWASP recommendation
  const keyLength = 32; // 256 bits / 8

  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    keyLength,
    "sha256"
  );

  // Combine salt and hash (salt first, then hash)
  const combined = Buffer.concat([salt, hash]);

  // Convert to base64 (matching btoa() in crypto.ts)
  return combined.toString("base64");
}

function getCurrentTimestamp(): number {
  return Date.now(); // Milliseconds (matches schema's timestamp_ms mode)
}

// ============================================================================
// Permission Constants
// ============================================================================

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

  // API permissions (bits 50-59)
  API_READ: 1n << 50n,
  API_WRITE: 1n << 51n,
  API_DELETE: 1n << 52n,
  API_KEYS_CREATE: 1n << 53n,
  API_KEYS_REVOKE: 1n << 54n,

  // Permission management (bits 60-78)
  PERM_ROLE_CREATE: 1n << 60n,
  PERM_ROLE_READ: 1n << 61n,
  PERM_ROLE_UPDATE: 1n << 62n,
  PERM_ROLE_DELETE: 1n << 63n,
  PERM_ROLE_ASSIGN: 1n << 64n,
  PERM_ROLE_REVOKE: 1n << 65n,
  PERM_USER_READ: 1n << 66n,
  PERM_USER_UPDATE: 1n << 67n,
  PERM_USER_DELETE: 1n << 68n,
  PERM_AUDIT_READ: 1n << 69n,
};

function splitBigInt(value: bigint): { low: string; high: string } {
  const low = value & 0xffffffffffffffffn;
  const high = value >> 64n;
  return {
    low: low.toString(),
    high: high.toString(),
  };
}

// ============================================================================
// Role Definitions
// ============================================================================

const ROLES = [
  {
    id: generateId("role"),
    name: "Admin",
    description: "Full system access with all permissions",
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
      PERMISSIONS.API_READ |
      PERMISSIONS.API_WRITE |
      PERMISSIONS.API_DELETE |
      PERMISSIONS.PERM_ROLE_CREATE |
      PERMISSIONS.PERM_ROLE_READ |
      PERMISSIONS.PERM_ROLE_UPDATE |
      PERMISSIONS.PERM_ROLE_DELETE |
      PERMISSIONS.PERM_ROLE_ASSIGN |
      PERMISSIONS.PERM_ROLE_REVOKE |
      PERMISSIONS.PERM_USER_READ |
      PERMISSIONS.PERM_USER_UPDATE |
      PERMISSIONS.PERM_USER_DELETE |
      PERMISSIONS.PERM_AUDIT_READ,
    isSystem: true,
  },
  {
    id: generateId("role"),
    name: "Member",
    description: "Standard member with read/write access",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_MEMBERS_READ |
      PERMISSIONS.TEAM_READ |
      PERMISSIONS.TEAM_MEMBERS_READ |
      PERMISSIONS.REPO_READ |
      PERMISSIONS.REPO_CREATE |
      PERMISSIONS.DATA_READ |
      PERMISSIONS.DATA_WRITE |
      PERMISSIONS.API_READ |
      PERMISSIONS.API_WRITE |
      PERMISSIONS.PERM_ROLE_READ,
    isSystem: true,
  },
  {
    id: generateId("role"),
    name: "Viewer",
    description: "Read-only access to resources",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_MEMBERS_READ |
      PERMISSIONS.TEAM_READ |
      PERMISSIONS.TEAM_MEMBERS_READ |
      PERMISSIONS.REPO_READ |
      PERMISSIONS.DATA_READ |
      PERMISSIONS.API_READ,
    isSystem: true,
  },
  {
    id: generateId("role"),
    name: "Billing Manager",
    description: "Manage billing and subscription settings",
    permissions:
      PERMISSIONS.ORG_READ |
      PERMISSIONS.ORG_BILLING_READ |
      PERMISSIONS.ORG_BILLING_UPDATE |
      PERMISSIONS.PERM_ROLE_READ,
    isSystem: true,
  },
];

// ============================================================================
// User Definitions
// ============================================================================

const timestamp = getCurrentTimestamp();

// Admin user (verified, with Admin role)
const adminUser = {
  id: generateId("user"),
  email: "admin@example.com",
  displayName: "Admin User",
  passwordHash: hashPassword("Admin123!"),
  emailVerified: true,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp,
};

// Regular member (verified, with Member role)
const memberUser = {
  id: generateId("user"),
  email: "member@example.com",
  displayName: "Member User",
  passwordHash: hashPassword("Member123!"),
  emailVerified: true,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp,
};

// Viewer user (verified, with Viewer role)
const viewerUser = {
  id: generateId("user"),
  email: "viewer@example.com",
  displayName: "Viewer User",
  passwordHash: hashPassword("Viewer123!"),
  emailVerified: true,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: null,
};

// Unverified user (no role yet)
const unverifiedUser = {
  id: generateId("user"),
  email: "unverified@example.com",
  displayName: "Unverified User",
  passwordHash: hashPassword("Unverified123!"),
  emailVerified: false,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: null,
};

// Suspended user (had Member role, now suspended)
const suspendedUser = {
  id: generateId("user"),
  email: "suspended@example.com",
  displayName: "Suspended User",
  passwordHash: hashPassword("Suspended123!"),
  emailVerified: true,
  status: "suspended",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp - 86400000, // 1 day ago
};

const USERS = [
  adminUser,
  memberUser,
  viewerUser,
  unverifiedUser,
  suspendedUser,
];

// ============================================================================
// Role Assignments
// ============================================================================

const ROLE_ASSIGNMENTS = [
  {
    id: generateId("assignment"),
    userId: adminUser.id,
    roleId: ROLES[0].id, // Admin role
    grantedBy: adminUser.id, // Self-granted (system setup)
    createdAt: timestamp,
  },
  {
    id: generateId("assignment"),
    userId: memberUser.id,
    roleId: ROLES[1].id, // Member role
    grantedBy: adminUser.id,
    createdAt: timestamp,
  },
  {
    id: generateId("assignment"),
    userId: viewerUser.id,
    roleId: ROLES[2].id, // Viewer role
    grantedBy: adminUser.id,
    createdAt: timestamp,
  },
  {
    id: generateId("assignment"),
    userId: suspendedUser.id,
    roleId: ROLES[1].id, // Member role (still has role, but suspended)
    grantedBy: adminUser.id,
    createdAt: timestamp - 172800000, // 2 days ago
  },
];

// ============================================================================
// SQL Generation
// ============================================================================

console.log(
  "-- ============================================================================"
);
console.log("-- Seed Data for cf-auth");
console.log("-- Generated:", new Date().toISOString());
console.log(
  "-- ============================================================================\n"
);

console.log(
  "-- ============================================================================"
);
console.log("-- Roles");
console.log(
  "-- ============================================================================\n"
);

for (const role of ROLES) {
  const { low, high } = splitBigInt(role.permissions);
  console.log(
    `INSERT INTO roles (id, name, description, permissions_low, permissions_high, is_system, created_at, updated_at)`
  );
  console.log(`VALUES (`);
  console.log(`  '${role.id}',`);
  console.log(`  '${role.name}',`);
  console.log(`  '${role.description}',`);
  console.log(`  '${low}',`);
  console.log(`  '${high}',`);
  console.log(`  ${role.isSystem ? 1 : 0},`);
  console.log(`  ${timestamp},`);
  console.log(`  ${timestamp}`);
  console.log(`);\n`);
}

console.log(
  "-- ============================================================================"
);
console.log("-- Users");
console.log(
  "-- ============================================================================\n"
);

for (const user of USERS) {
  console.log(
    `INSERT INTO users (id, email, display_name, password_hash, email_verified, status, created_at, updated_at, last_login_at)`
  );
  console.log(`VALUES (`);
  console.log(`  '${user.id}',`);
  console.log(`  '${user.email}',`);
  console.log(`  '${user.displayName}',`);
  console.log(`  '${user.passwordHash}',`);
  console.log(`  ${user.emailVerified ? 1 : 0},`);
  console.log(`  '${user.status}',`);
  console.log(`  ${user.createdAt},`);
  console.log(`  ${user.updatedAt},`);
  console.log(`  ${user.lastLoginAt !== null ? user.lastLoginAt : "NULL"}`);
  console.log(`);\n`);
}

console.log(
  "-- ============================================================================"
);
console.log("-- Role Assignments");
console.log(
  "-- ============================================================================\n"
);

for (const assignment of ROLE_ASSIGNMENTS) {
  console.log(
    `INSERT INTO role_assignments (id, user_id, role_id, granted_by, created_at)`
  );
  console.log(`VALUES (`);
  console.log(`  '${assignment.id}',`);
  console.log(`  '${assignment.userId}',`);
  console.log(`  '${assignment.roleId}',`);
  console.log(`  '${assignment.grantedBy}',`);
  console.log(`  ${assignment.createdAt}`);
  console.log(`);\n`);
}

console.log(
  "-- ============================================================================"
);
console.log("-- Summary");
console.log(
  "-- ============================================================================"
);
console.log(`-- Roles created: ${ROLES.length}`);
console.log(`-- Users created: ${USERS.length}`);
console.log(`-- Role assignments: ${ROLE_ASSIGNMENTS.length}`);
console.log(
  "\n-- ============================================================================"
);
console.log("-- Test Credentials");
console.log(
  "-- ============================================================================"
);
console.log("-- Admin:       admin@example.com / Admin123!");
console.log("-- Member:      member@example.com / Member123!");
console.log("-- Viewer:      viewer@example.com / Viewer123!");
console.log("-- Unverified:  unverified@example.com / Unverified123!");
console.log("-- Suspended:   suspended@example.com / Suspended123!");
console.log(
  "-- ============================================================================\n"
);
