/**
 * Permission Constants and Bitmap Operations
 *
 * Implements the Permission Superset Model for flexible, hierarchical permissions.
 * See docs/permission-model.md for detailed documentation.
 *
 * Key principles:
 * - Organization owners get FULL_SUPERSET (all possible permissions)
 * - All other users get configurable permission subsets
 * - Users can only grant permissions they themselves possess
 * - Permissions stored as bitmaps (two bigints) for fast bitwise operations
 * - Supports up to 128 unique permissions (0-127)
 */

// ============================================================================
// ORGANIZATION DOMAIN (org.*) - Bits 0-19
// ============================================================================

export const ORG_READ = 1n << 0n; // View organization info
export const ORG_WRITE = 1n << 1n; // Update organization settings
export const ORG_DELETE = 1n << 2n; // Delete organization (owner only typically)
export const ORG_TRANSFER = 1n << 3n; // Transfer ownership

export const ORG_MEMBERS_READ = 1n << 4n; // View organization members
export const ORG_MEMBERS_INVITE = 1n << 5n; // Invite new members
export const ORG_MEMBERS_UPDATE = 1n << 6n; // Update member roles/permissions
export const ORG_MEMBERS_REMOVE = 1n << 7n; // Remove members

export const ORG_BILLING_READ = 1n << 8n; // View billing info
export const ORG_BILLING_UPDATE = 1n << 9n; // Update billing info
export const ORG_BILLING_MANAGE = 1n << 10n; // Manage subscriptions/payment methods

export const ORG_SETTINGS_READ = 1n << 11n; // View organization settings
export const ORG_SETTINGS_UPDATE = 1n << 12n; // Update organization settings

// Compound permissions for convenience
export const ORG_MEMBERS_ALL =
  ORG_MEMBERS_READ |
  ORG_MEMBERS_INVITE |
  ORG_MEMBERS_UPDATE |
  ORG_MEMBERS_REMOVE;
export const ORG_BILLING_ALL =
  ORG_BILLING_READ | ORG_BILLING_UPDATE | ORG_BILLING_MANAGE;
export const ORG_SETTINGS_ALL = ORG_SETTINGS_READ | ORG_SETTINGS_UPDATE;

// ============================================================================
// TEAM DOMAIN (team.*) - Bits 20-29
// ============================================================================

export const TEAM_CREATE = 1n << 20n; // Create new teams
export const TEAM_READ = 1n << 21n; // View team info
export const TEAM_UPDATE = 1n << 22n; // Update team settings
export const TEAM_DELETE = 1n << 23n; // Delete teams

export const TEAM_MEMBERS_READ = 1n << 24n; // View team members
export const TEAM_MEMBERS_ADD = 1n << 25n; // Add members to team
export const TEAM_MEMBERS_REMOVE = 1n << 26n; // Remove members from team

export const TEAM_ALL =
  TEAM_CREATE |
  TEAM_READ |
  TEAM_UPDATE |
  TEAM_DELETE |
  TEAM_MEMBERS_READ |
  TEAM_MEMBERS_ADD |
  TEAM_MEMBERS_REMOVE;

// ============================================================================
// REPOSITORY DOMAIN (repo.*) - Bits 30-39
// ============================================================================

export const REPO_CREATE = 1n << 30n; // Create new repositories
export const REPO_READ = 1n << 31n; // View repository info
export const REPO_UPDATE = 1n << 32n; // Update repository settings
export const REPO_DELETE = 1n << 33n; // Delete repositories

export const REPO_COLLAB_READ = 1n << 34n; // View collaborators
export const REPO_COLLAB_ADD = 1n << 35n; // Add collaborators
export const REPO_COLLAB_REMOVE = 1n << 36n; // Remove collaborators

export const REPO_ALL =
  REPO_CREATE |
  REPO_READ |
  REPO_UPDATE |
  REPO_DELETE |
  REPO_COLLAB_READ |
  REPO_COLLAB_ADD |
  REPO_COLLAB_REMOVE;

// ============================================================================
// DATA DOMAIN (data.*) - Bits 40-49
// ============================================================================

export const DATA_READ = 1n << 40n; // Read data
export const DATA_WRITE = 1n << 41n; // Write/modify data
export const DATA_DELETE = 1n << 42n; // Delete data
export const DATA_EXPORT = 1n << 43n; // Export data
export const DATA_IMPORT = 1n << 44n; // Import data

export const DATA_ALL =
  DATA_READ | DATA_WRITE | DATA_DELETE | DATA_EXPORT | DATA_IMPORT;

// ============================================================================
// COLLABORATION DOMAIN (collab.*) - Bits 50-59
// ============================================================================

export const COLLAB_ISSUE_READ = 1n << 50n; // View issues
export const COLLAB_ISSUE_CREATE = 1n << 51n; // Create issues
export const COLLAB_ISSUE_UPDATE = 1n << 52n; // Update issues
export const COLLAB_ISSUE_DELETE = 1n << 53n; // Delete issues

export const COLLAB_PR_READ = 1n << 54n; // View pull requests
export const COLLAB_PR_CREATE = 1n << 55n; // Create pull requests
export const COLLAB_PR_REVIEW = 1n << 56n; // Review pull requests
export const COLLAB_PR_MERGE = 1n << 57n; // Merge pull requests

export const COLLAB_COMMENT_READ = 1n << 58n; // View comments
export const COLLAB_COMMENT_CREATE = 1n << 59n; // Create comments

export const COLLAB_ISSUE_ALL =
  COLLAB_ISSUE_READ |
  COLLAB_ISSUE_CREATE |
  COLLAB_ISSUE_UPDATE |
  COLLAB_ISSUE_DELETE;
export const COLLAB_PR_ALL =
  COLLAB_PR_READ | COLLAB_PR_CREATE | COLLAB_PR_REVIEW | COLLAB_PR_MERGE;
export const COLLAB_COMMENT_ALL = COLLAB_COMMENT_READ | COLLAB_COMMENT_CREATE;

// ============================================================================
// ADMIN DOMAIN (admin.*) - Bits 60-69
// ============================================================================

export const ADMIN_USER_READ = 1n << 60n; // View user admin panel
export const ADMIN_USER_UPDATE = 1n << 61n; // Update user accounts
export const ADMIN_USER_DELETE = 1n << 62n; // Delete user accounts
export const ADMIN_USER_IMPERSONATE = 1n << 63n; // Impersonate users

// Continue in high bitmap (bits 64+)
export const ADMIN_AUDIT_READ = 1n << 64n; // Access audit logs
export const ADMIN_WEBHOOK_READ = 1n << 65n; // View webhooks
export const ADMIN_WEBHOOK_CREATE = 1n << 66n; // Create webhooks
export const ADMIN_WEBHOOK_UPDATE = 1n << 67n; // Update webhooks
export const ADMIN_WEBHOOK_DELETE = 1n << 68n; // Delete webhooks

export const ADMIN_USER_ALL =
  ADMIN_USER_READ |
  ADMIN_USER_UPDATE |
  ADMIN_USER_DELETE |
  ADMIN_USER_IMPERSONATE;
export const ADMIN_WEBHOOK_ALL =
  ADMIN_WEBHOOK_READ |
  ADMIN_WEBHOOK_CREATE |
  ADMIN_WEBHOOK_UPDATE |
  ADMIN_WEBHOOK_DELETE;

// ============================================================================
// PERMISSION DOMAIN (perm.*) - Bits 70-79
// ============================================================================

export const PERM_READ = 1n << 70n; // View permissions
export const PERM_GRANT = 1n << 71n; // Grant permissions
export const PERM_REVOKE = 1n << 72n; // Revoke permissions
export const PERM_ROLE_CREATE = 1n << 73n; // Create custom roles
export const PERM_ROLE_UPDATE = 1n << 74n; // Update roles
export const PERM_ROLE_DELETE = 1n << 75n; // Delete roles

export const PERM_ALL =
  PERM_READ |
  PERM_GRANT |
  PERM_REVOKE |
  PERM_ROLE_CREATE |
  PERM_ROLE_UPDATE |
  PERM_ROLE_DELETE;

// ============================================================================
// FULL SUPERSET - All permissions combined
// ============================================================================

export const FULL_SUPERSET_LOW =
  // Organization (0-19)
  ORG_READ |
  ORG_WRITE |
  ORG_DELETE |
  ORG_TRANSFER |
  ORG_MEMBERS_ALL |
  ORG_BILLING_ALL |
  ORG_SETTINGS_ALL |
  // Team (20-29)
  TEAM_ALL |
  // Repository (30-39)
  REPO_ALL |
  // Data (40-49)
  DATA_ALL |
  // Collaboration (50-59)
  COLLAB_ISSUE_ALL |
  COLLAB_PR_ALL |
  COLLAB_COMMENT_ALL |
  // Admin (60-63 in low bitmap)
  ADMIN_USER_READ |
  ADMIN_USER_UPDATE |
  ADMIN_USER_DELETE |
  ADMIN_USER_IMPERSONATE;

export const FULL_SUPERSET_HIGH =
  // Admin (64-69 in high bitmap)
  (ADMIN_AUDIT_READ >> 64n) |
  (ADMIN_WEBHOOK_READ >> 64n) |
  (ADMIN_WEBHOOK_CREATE >> 64n) |
  (ADMIN_WEBHOOK_UPDATE >> 64n) |
  (ADMIN_WEBHOOK_DELETE >> 64n) |
  // Permission (70-79 in high bitmap)
  (PERM_READ >> 64n) |
  (PERM_GRANT >> 64n) |
  (PERM_REVOKE >> 64n) |
  (PERM_ROLE_CREATE >> 64n) |
  (PERM_ROLE_UPDATE >> 64n) |
  (PERM_ROLE_DELETE >> 64n);

// ============================================================================
// PRESET ROLES - Common permission combinations
// ============================================================================

export const ROLE_ADMIN_LOW =
  ORG_READ |
  ORG_WRITE |
  ORG_MEMBERS_ALL |
  ORG_SETTINGS_ALL |
  TEAM_ALL |
  REPO_ALL |
  DATA_READ |
  DATA_WRITE |
  COLLAB_ISSUE_ALL |
  COLLAB_PR_ALL |
  COLLAB_COMMENT_ALL;

export const ROLE_ADMIN_HIGH = 0n;

export const ROLE_MEMBER_LOW =
  ORG_READ |
  TEAM_READ |
  REPO_READ |
  DATA_READ |
  COLLAB_ISSUE_ALL |
  COLLAB_COMMENT_ALL;

export const ROLE_MEMBER_HIGH = 0n;

export const ROLE_BILLING_MANAGER_LOW = ORG_READ | ORG_BILLING_ALL;

export const ROLE_BILLING_MANAGER_HIGH = 0n;

// ============================================================================
// BITMAP STORAGE - Split/Merge for database storage
// ============================================================================

/**
 * Split a single bigint into low (0-63) and high (64-127) components for storage
 */
export function splitBitmap(bitmap: bigint): { low: string; high: string } {
  const low = bitmap & ((1n << 64n) - 1n); // Extract bits 0-63
  const high = bitmap >> 64n; // Extract bits 64+
  return {
    low: low.toString(),
    high: high.toString(),
  };
}

/**
 * Merge low and high components back into a single bigint
 */
export function mergeBitmap(low: string, high: string): bigint {
  const lowBits = BigInt(low);
  const highBits = BigInt(high);
  return lowBits | (highBits << 64n);
}

/**
 * Merge separate low/high bitmaps into combined bitmap
 */
export function mergeBitmaps(lowBitmap: bigint, highBitmap: bigint): bigint {
  return lowBitmap | (highBitmap << 64n);
}

// ============================================================================
// PERMISSION OPERATIONS
// ============================================================================

/**
 * Check if a bitmap contains a specific permission
 * @param bitmap - The user's permission bitmap
 * @param permission - The permission to check
 * @returns true if user has the permission
 */
export function hasPermission(bitmap: bigint, permission: bigint): boolean {
  return (bitmap & permission) === permission;
}

/**
 * Check if a bitmap contains all required permissions
 * @param bitmap - The user's permission bitmap
 * @param permissions - Array of permissions to check
 * @returns true if user has ALL permissions
 */
export function hasAllPermissions(
  bitmap: bigint,
  permissions: bigint[]
): boolean {
  return permissions.every((perm) => hasPermission(bitmap, perm));
}

/**
 * Check if a bitmap contains any of the required permissions
 * @param bitmap - The user's permission bitmap
 * @param permissions - Array of permissions to check
 * @returns true if user has ANY permission
 */
export function hasAnyPermission(
  bitmap: bigint,
  permissions: bigint[]
): boolean {
  return permissions.some((perm) => hasPermission(bitmap, perm));
}

/**
 * Grant a permission to a bitmap
 * @param bitmap - Current permission bitmap
 * @param permission - Permission to grant
 * @returns Updated bitmap with permission added
 */
export function grantPermission(bitmap: bigint, permission: bigint): bigint {
  return bitmap | permission;
}

/**
 * Grant multiple permissions to a bitmap
 * @param bitmap - Current permission bitmap
 * @param permissions - Array of permissions to grant
 * @returns Updated bitmap with all permissions added
 */
export function grantPermissions(
  bitmap: bigint,
  permissions: bigint[]
): bigint {
  return permissions.reduce((acc, perm) => acc | perm, bitmap);
}

/**
 * Revoke a permission from a bitmap
 * @param bitmap - Current permission bitmap
 * @param permission - Permission to revoke
 * @returns Updated bitmap with permission removed
 */
export function revokePermission(bitmap: bigint, permission: bigint): bigint {
  return bitmap & ~permission;
}

/**
 * Revoke multiple permissions from a bitmap
 * @param bitmap - Current permission bitmap
 * @param permissions - Array of permissions to revoke
 * @returns Updated bitmap with all permissions removed
 */
export function revokePermissions(
  bitmap: bigint,
  permissions: bigint[]
): bigint {
  return permissions.reduce((acc, perm) => acc & ~perm, bitmap);
}

/**
 * Check if a grantor can delegate permissions to a grantee
 * (Grantor must possess all permissions being granted)
 *
 * @param grantorBitmap - Grantor's permission bitmap
 * @param targetBitmap - Permissions being granted
 * @returns true if delegation is allowed
 */
export function canDelegate(
  grantorBitmap: bigint,
  targetBitmap: bigint
): boolean {
  // Target must be a subset of grantor's permissions
  return (targetBitmap & grantorBitmap) === targetBitmap;
}

/**
 * Get permissions that grantor can delegate (intersection)
 * @param grantorBitmap - Grantor's permission bitmap
 * @param requestedBitmap - Requested permissions bitmap
 * @returns Bitmap of permissions that can actually be granted
 */
export function getDelegatablePermissions(
  grantorBitmap: bigint,
  requestedBitmap: bigint
): bigint {
  return grantorBitmap & requestedBitmap;
}

/**
 * Get permissions that grantor CANNOT delegate
 * @param grantorBitmap - Grantor's permission bitmap
 * @param requestedBitmap - Requested permissions bitmap
 * @returns Bitmap of permissions that cannot be granted
 */
export function getNonDelegatablePermissions(
  grantorBitmap: bigint,
  requestedBitmap: bigint
): bigint {
  return requestedBitmap & ~grantorBitmap;
}

// ============================================================================
// PERMISSION METADATA - Human-readable names and descriptions
// ============================================================================

export interface PermissionMetadata {
  bit: bigint;
  name: string;
  description: string;
  domain: "org" | "team" | "repo" | "data" | "collab" | "admin" | "perm";
}

export const PERMISSION_METADATA: PermissionMetadata[] = [
  // Organization
  {
    bit: ORG_READ,
    name: "org.read",
    description: "View organization info",
    domain: "org",
  },
  {
    bit: ORG_WRITE,
    name: "org.write",
    description: "Update organization settings",
    domain: "org",
  },
  {
    bit: ORG_DELETE,
    name: "org.delete",
    description: "Delete organization",
    domain: "org",
  },
  {
    bit: ORG_TRANSFER,
    name: "org.transfer",
    description: "Transfer ownership",
    domain: "org",
  },
  {
    bit: ORG_MEMBERS_READ,
    name: "org.members.read",
    description: "View organization members",
    domain: "org",
  },
  {
    bit: ORG_MEMBERS_INVITE,
    name: "org.members.invite",
    description: "Invite new members",
    domain: "org",
  },
  {
    bit: ORG_MEMBERS_UPDATE,
    name: "org.members.update",
    description: "Update member roles/permissions",
    domain: "org",
  },
  {
    bit: ORG_MEMBERS_REMOVE,
    name: "org.members.remove",
    description: "Remove members",
    domain: "org",
  },
  {
    bit: ORG_BILLING_READ,
    name: "org.billing.read",
    description: "View billing info",
    domain: "org",
  },
  {
    bit: ORG_BILLING_UPDATE,
    name: "org.billing.update",
    description: "Update billing info",
    domain: "org",
  },
  {
    bit: ORG_BILLING_MANAGE,
    name: "org.billing.manage",
    description: "Manage subscriptions/payment methods",
    domain: "org",
  },
  {
    bit: ORG_SETTINGS_READ,
    name: "org.settings.read",
    description: "View organization settings",
    domain: "org",
  },
  {
    bit: ORG_SETTINGS_UPDATE,
    name: "org.settings.update",
    description: "Update organization settings",
    domain: "org",
  },

  // Team
  {
    bit: TEAM_CREATE,
    name: "team.create",
    description: "Create new teams",
    domain: "team",
  },
  {
    bit: TEAM_READ,
    name: "team.read",
    description: "View team info",
    domain: "team",
  },
  {
    bit: TEAM_UPDATE,
    name: "team.update",
    description: "Update team settings",
    domain: "team",
  },
  {
    bit: TEAM_DELETE,
    name: "team.delete",
    description: "Delete teams",
    domain: "team",
  },
  {
    bit: TEAM_MEMBERS_READ,
    name: "team.members.read",
    description: "View team members",
    domain: "team",
  },
  {
    bit: TEAM_MEMBERS_ADD,
    name: "team.members.add",
    description: "Add members to team",
    domain: "team",
  },
  {
    bit: TEAM_MEMBERS_REMOVE,
    name: "team.members.remove",
    description: "Remove members from team",
    domain: "team",
  },

  // Repository
  {
    bit: REPO_CREATE,
    name: "repo.create",
    description: "Create new repositories",
    domain: "repo",
  },
  {
    bit: REPO_READ,
    name: "repo.read",
    description: "View repository info",
    domain: "repo",
  },
  {
    bit: REPO_UPDATE,
    name: "repo.update",
    description: "Update repository settings",
    domain: "repo",
  },
  {
    bit: REPO_DELETE,
    name: "repo.delete",
    description: "Delete repositories",
    domain: "repo",
  },
  {
    bit: REPO_COLLAB_READ,
    name: "repo.collab.read",
    description: "View collaborators",
    domain: "repo",
  },
  {
    bit: REPO_COLLAB_ADD,
    name: "repo.collab.add",
    description: "Add collaborators",
    domain: "repo",
  },
  {
    bit: REPO_COLLAB_REMOVE,
    name: "repo.collab.remove",
    description: "Remove collaborators",
    domain: "repo",
  },

  // Data
  {
    bit: DATA_READ,
    name: "data.read",
    description: "Read data",
    domain: "data",
  },
  {
    bit: DATA_WRITE,
    name: "data.write",
    description: "Write/modify data",
    domain: "data",
  },
  {
    bit: DATA_DELETE,
    name: "data.delete",
    description: "Delete data",
    domain: "data",
  },
  {
    bit: DATA_EXPORT,
    name: "data.export",
    description: "Export data",
    domain: "data",
  },
  {
    bit: DATA_IMPORT,
    name: "data.import",
    description: "Import data",
    domain: "data",
  },

  // Collaboration
  {
    bit: COLLAB_ISSUE_READ,
    name: "collab.issue.read",
    description: "View issues",
    domain: "collab",
  },
  {
    bit: COLLAB_ISSUE_CREATE,
    name: "collab.issue.create",
    description: "Create issues",
    domain: "collab",
  },
  {
    bit: COLLAB_ISSUE_UPDATE,
    name: "collab.issue.update",
    description: "Update issues",
    domain: "collab",
  },
  {
    bit: COLLAB_ISSUE_DELETE,
    name: "collab.issue.delete",
    description: "Delete issues",
    domain: "collab",
  },
  {
    bit: COLLAB_PR_READ,
    name: "collab.pr.read",
    description: "View pull requests",
    domain: "collab",
  },
  {
    bit: COLLAB_PR_CREATE,
    name: "collab.pr.create",
    description: "Create pull requests",
    domain: "collab",
  },
  {
    bit: COLLAB_PR_REVIEW,
    name: "collab.pr.review",
    description: "Review pull requests",
    domain: "collab",
  },
  {
    bit: COLLAB_PR_MERGE,
    name: "collab.pr.merge",
    description: "Merge pull requests",
    domain: "collab",
  },
  {
    bit: COLLAB_COMMENT_READ,
    name: "collab.comment.read",
    description: "View comments",
    domain: "collab",
  },
  {
    bit: COLLAB_COMMENT_CREATE,
    name: "collab.comment.create",
    description: "Create comments",
    domain: "collab",
  },

  // Admin
  {
    bit: ADMIN_USER_READ,
    name: "admin.user.read",
    description: "View user admin panel",
    domain: "admin",
  },
  {
    bit: ADMIN_USER_UPDATE,
    name: "admin.user.update",
    description: "Update user accounts",
    domain: "admin",
  },
  {
    bit: ADMIN_USER_DELETE,
    name: "admin.user.delete",
    description: "Delete user accounts",
    domain: "admin",
  },
  {
    bit: ADMIN_USER_IMPERSONATE,
    name: "admin.user.impersonate",
    description: "Impersonate users",
    domain: "admin",
  },
  {
    bit: ADMIN_AUDIT_READ,
    name: "admin.audit.read",
    description: "Access audit logs",
    domain: "admin",
  },
  {
    bit: ADMIN_WEBHOOK_READ,
    name: "admin.webhook.read",
    description: "View webhooks",
    domain: "admin",
  },
  {
    bit: ADMIN_WEBHOOK_CREATE,
    name: "admin.webhook.create",
    description: "Create webhooks",
    domain: "admin",
  },
  {
    bit: ADMIN_WEBHOOK_UPDATE,
    name: "admin.webhook.update",
    description: "Update webhooks",
    domain: "admin",
  },
  {
    bit: ADMIN_WEBHOOK_DELETE,
    name: "admin.webhook.delete",
    description: "Delete webhooks",
    domain: "admin",
  },

  // Permission
  {
    bit: PERM_READ,
    name: "perm.read",
    description: "View permissions",
    domain: "perm",
  },
  {
    bit: PERM_GRANT,
    name: "perm.grant",
    description: "Grant permissions",
    domain: "perm",
  },
  {
    bit: PERM_REVOKE,
    name: "perm.revoke",
    description: "Revoke permissions",
    domain: "perm",
  },
  {
    bit: PERM_ROLE_CREATE,
    name: "perm.role.create",
    description: "Create custom roles",
    domain: "perm",
  },
  {
    bit: PERM_ROLE_UPDATE,
    name: "perm.role.update",
    description: "Update roles",
    domain: "perm",
  },
  {
    bit: PERM_ROLE_DELETE,
    name: "perm.role.delete",
    description: "Delete roles",
    domain: "perm",
  },
];

/**
 * Get metadata for a specific permission
 */
export function getPermissionMetadata(
  permission: bigint
): PermissionMetadata | undefined {
  return PERMISSION_METADATA.find((meta) => meta.bit === permission);
}

/**
 * Get all permissions in a bitmap as an array of metadata
 */
export function getPermissionsFromBitmap(bitmap: bigint): PermissionMetadata[] {
  return PERMISSION_METADATA.filter((meta) => hasPermission(bitmap, meta.bit));
}

/**
 * Get permission names from bitmap
 */
export function getPermissionNames(bitmap: bigint): string[] {
  return getPermissionsFromBitmap(bitmap).map((meta) => meta.name);
}

/**
 * Convert permission name to bit value
 */
export function getPermissionBit(name: string): bigint | undefined {
  return PERMISSION_METADATA.find((meta) => meta.name === name)?.bit;
}

/**
 * Convert multiple permission names to combined bitmap
 */
export function permissionNamesToBitmap(names: string[]): bigint {
  return names.reduce((bitmap, name) => {
    const bit = getPermissionBit(name);
    return bit ? bitmap | bit : bitmap;
  }, 0n);
}
