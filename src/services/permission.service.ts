/**
 * Permission Service - Business logic for permission operations
 *
 * Implements the Permission Superset Model for hierarchical permission delegation.
 * See docs/permission-model.md for detailed documentation.
 *
 * Key principles:
 * - Organization owners get FULL_SUPERSET automatically
 * - Users can only grant permissions they themselves possess
 * - Permissions can be org-scoped, team-scoped, or global
 * - All permission changes are audited
 */

import { and, eq, isNull, desc, or } from "drizzle-orm";
import { initDb, schema } from "../db";
import type {
  Role,
  NewRole,
  RoleAssignment,
  NewRoleAssignment,
  PermissionAudit,
  NewPermissionAudit,
} from "../db/schema";
import type { Env } from "../types";
import { generateId } from "../utils/crypto";
import {
  mergeBitmap,
  splitBitmap,
  canDelegate,
  FULL_SUPERSET_LOW,
  FULL_SUPERSET_HIGH,
  hasPermission,
  getPermissionNames,
  permissionNamesToBitmap,
} from "../utils/permissions";

export interface EffectivePermissions {
  low: bigint;
  high: bigint;
  combined: bigint;
  names: string[];
  isOwner: boolean;
}

export interface RoleWithPermissions extends Role {
  permissionNames: string[];
}

/**
 * Get user's effective permissions for a specific scope
 *
 * Permissions are calculated by combining:
 * 1. Organization-level role assignments (if orgId provided)
 * 2. Team-level role assignments (if teamId provided)
 * 3. Global role assignments (if no scope provided)
 *
 * @param userId - User ID
 * @param env - Environment bindings
 * @param organizationId - Optional organization scope
 * @param teamId - Optional team scope
 * @returns Combined permission bitmap and metadata
 */
export async function getUserPermissions(
  userId: string,
  env: Env,
  organizationId?: string,
  teamId?: string
): Promise<EffectivePermissions> {
  const db = initDb(env);

  // Check if user is organization owner
  if (organizationId) {
    const org = await db
      .select()
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.id, organizationId),
          eq(schema.organizations.ownerUserId, userId)
        )
      )
      .get();

    // Organization owners get FULL_SUPERSET automatically
    if (org) {
      const combined = mergeBitmap(
        FULL_SUPERSET_LOW.toString(),
        FULL_SUPERSET_HIGH.toString()
      );
      return {
        low: FULL_SUPERSET_LOW,
        high: FULL_SUPERSET_HIGH,
        combined,
        names: getPermissionNames(combined),
        isOwner: true,
      };
    }
  }

  // Build query for role assignments
  const conditions = [eq(schema.roleAssignments.userId, userId)];

  if (organizationId) {
    conditions.push(eq(schema.roleAssignments.organizationId, organizationId));
  } else {
    conditions.push(isNull(schema.roleAssignments.organizationId));
  }

  if (teamId) {
    conditions.push(eq(schema.roleAssignments.teamId, teamId));
  } else {
    conditions.push(isNull(schema.roleAssignments.teamId));
  }

  // Get all role assignments for user in this scope
  const assignments = await db
    .select({
      roleId: schema.roleAssignments.roleId,
      expiresAt: schema.roleAssignments.expiresAt,
    })
    .from(schema.roleAssignments)
    .where(and(...conditions))
    .all();

  // Filter out expired assignments
  const now = Date.now();
  const activeAssignments = assignments.filter((a) => {
    if (!a.expiresAt) return true; // No expiry = always active
    const expiryTime =
      a.expiresAt instanceof Date ? a.expiresAt.getTime() : Number(a.expiresAt);
    return expiryTime > now;
  });

  if (activeAssignments.length === 0) {
    // No permissions
    return {
      low: 0n,
      high: 0n,
      combined: 0n,
      names: [],
      isOwner: false,
    };
  }

  // Get all roles
  const roleIds = activeAssignments.map((a) => a.roleId);
  const roles = await db
    .select()
    .from(schema.roles)
    .where(or(...roleIds.map((id) => eq(schema.roles.id, id))))
    .all();

  // Combine permissions from all roles using bitwise OR
  let combinedLow = 0n;
  let combinedHigh = 0n;

  for (const role of roles) {
    combinedLow |= BigInt(role.permissionsLow);
    combinedHigh |= BigInt(role.permissionsHigh);
  }

  const combined = mergeBitmap(combinedLow.toString(), combinedHigh.toString());

  return {
    low: combinedLow,
    high: combinedHigh,
    combined,
    names: getPermissionNames(combined),
    isOwner: false,
  };
}

/**
 * Check if user has a specific permission
 *
 * @param userId - User ID
 * @param permission - Permission bit to check
 * @param env - Environment bindings
 * @param organizationId - Optional organization scope
 * @param teamId - Optional team scope
 * @returns true if user has the permission
 */
export async function checkUserPermission(
  userId: string,
  permission: bigint,
  env: Env,
  organizationId?: string,
  teamId?: string
): Promise<boolean> {
  const userPerms = await getUserPermissions(
    userId,
    env,
    organizationId,
    teamId
  );
  return hasPermission(userPerms.combined, permission);
}

/**
 * Check if user has all of multiple permissions
 *
 * @param userId - User ID
 * @param permissions - Array of permission bits to check
 * @param env - Environment bindings
 * @param organizationId - Optional organization scope
 * @param teamId - Optional team scope
 * @returns true if user has ALL permissions
 */
export async function checkUserPermissions(
  userId: string,
  permissions: bigint[],
  env: Env,
  organizationId?: string,
  teamId?: string
): Promise<boolean> {
  const userPerms = await getUserPermissions(
    userId,
    env,
    organizationId,
    teamId
  );
  return permissions.every((perm) => hasPermission(userPerms.combined, perm));
}

/**
 * Validate that a user can delegate specific permissions
 * (User must possess all permissions being granted)
 *
 * @param grantorId - User granting the permissions
 * @param targetPermissions - Permissions being granted
 * @param env - Environment bindings
 * @param organizationId - Optional organization scope
 * @param teamId - Optional team scope
 * @returns true if delegation is allowed
 */
export async function validateDelegation(
  grantorId: string,
  targetPermissions: bigint,
  env: Env,
  organizationId?: string,
  teamId?: string
): Promise<boolean> {
  const grantorPerms = await getUserPermissions(
    grantorId,
    env,
    organizationId,
    teamId
  );
  return canDelegate(grantorPerms.combined, targetPermissions);
}

/**
 * Assign a role to a user
 *
 * @param data - Assignment data
 * @param env - Environment bindings
 * @throws Error if grantor doesn't have permission to delegate
 */
export async function assignRole(
  data: {
    userId: string;
    roleId: string;
    grantedBy: string;
    organizationId?: string;
    teamId?: string;
    expiresAt?: Date;
  },
  env: Env
): Promise<RoleAssignment> {
  const db = initDb(env);

  // Get the role being assigned
  const role = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, data.roleId))
    .get();

  if (!role) {
    throw new Error("Role not found");
  }

  // Combine role permissions
  const rolePermissions = mergeBitmap(
    role.permissionsLow,
    role.permissionsHigh
  );

  // Validate that grantor can delegate these permissions
  const canGrantorDelegate = await validateDelegation(
    data.grantedBy,
    rolePermissions,
    env,
    data.organizationId,
    data.teamId
  );

  if (!canGrantorDelegate) {
    throw new Error(
      "You cannot grant permissions you do not possess. Permission delegation must be a subset of your own permissions."
    );
  }

  // Check if assignment already exists
  const existingAssignment = await db
    .select()
    .from(schema.roleAssignments)
    .where(
      and(
        eq(schema.roleAssignments.userId, data.userId),
        eq(schema.roleAssignments.roleId, data.roleId),
        data.organizationId
          ? eq(schema.roleAssignments.organizationId, data.organizationId)
          : isNull(schema.roleAssignments.organizationId),
        data.teamId
          ? eq(schema.roleAssignments.teamId, data.teamId)
          : isNull(schema.roleAssignments.teamId)
      )
    )
    .get();

  if (existingAssignment) {
    throw new Error("Role already assigned to user in this scope");
  }

  // Create assignment
  const now = new Date();
  const assignmentId = generateId();

  const newAssignment: NewRoleAssignment = {
    id: assignmentId,
    userId: data.userId,
    roleId: data.roleId,
    organizationId: data.organizationId || null,
    teamId: data.teamId || null,
    grantedBy: data.grantedBy,
    expiresAt: data.expiresAt || null,
    createdAt: now,
  };

  await db.insert(schema.roleAssignments).values(newAssignment).run();

  // Create audit log entry
  await createPermissionAuditEntry(
    {
      action: "grant",
      actorUserId: data.grantedBy,
      targetUserId: data.userId,
      roleId: data.roleId,
      organizationId: data.organizationId,
      teamId: data.teamId,
      metadata: {
        expiresAt: data.expiresAt?.toISOString(),
        permissionNames: getPermissionNames(rolePermissions),
      },
    },
    env
  );

  return {
    ...newAssignment,
    expiresAt: newAssignment.expiresAt ?? null,
    organizationId: newAssignment.organizationId ?? null,
    teamId: newAssignment.teamId ?? null,
    createdAt: newAssignment.createdAt,
  };
}

/**
 * Revoke a role from a user
 *
 * @param data - Revocation data
 * @param env - Environment bindings
 * @throws Error if revoker doesn't have permission
 */
export async function revokeRole(
  data: {
    userId: string;
    roleId: string;
    revokedBy: string;
    organizationId?: string;
    teamId?: string;
  },
  env: Env
): Promise<void> {
  const db = initDb(env);

  // Get the role being revoked
  const role = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, data.roleId))
    .get();

  if (!role) {
    throw new Error("Role not found");
  }

  // Validate that revoker can manage these permissions
  const rolePermissions = mergeBitmap(
    role.permissionsLow,
    role.permissionsHigh
  );

  const canRevokerManage = await validateDelegation(
    data.revokedBy,
    rolePermissions,
    env,
    data.organizationId,
    data.teamId
  );

  if (!canRevokerManage) {
    throw new Error(
      "You cannot revoke permissions you do not possess. Permission revocation must be a subset of your own permissions."
    );
  }

  // Delete assignment
  await db
    .delete(schema.roleAssignments)
    .where(
      and(
        eq(schema.roleAssignments.userId, data.userId),
        eq(schema.roleAssignments.roleId, data.roleId),
        data.organizationId
          ? eq(schema.roleAssignments.organizationId, data.organizationId)
          : isNull(schema.roleAssignments.organizationId),
        data.teamId
          ? eq(schema.roleAssignments.teamId, data.teamId)
          : isNull(schema.roleAssignments.teamId)
      )
    )
    .run();

  // Create audit log entry
  await createPermissionAuditEntry(
    {
      action: "revoke",
      actorUserId: data.revokedBy,
      targetUserId: data.userId,
      roleId: data.roleId,
      organizationId: data.organizationId,
      teamId: data.teamId,
      metadata: {
        permissionNames: getPermissionNames(rolePermissions),
      },
    },
    env
  );
}

/**
 * Create a custom role
 *
 * @param data - Role data
 * @param env - Environment bindings
 * @returns Created role with permission names
 */
export async function createCustomRole(
  data: {
    name: string;
    description?: string;
    permissionNames: string[];
    createdBy: string;
    organizationId?: string;
  },
  env: Env
): Promise<RoleWithPermissions> {
  const db = initDb(env);

  // Convert permission names to bitmap
  const permissionBitmap = permissionNamesToBitmap(data.permissionNames);
  const { low, high } = splitBitmap(permissionBitmap);

  // Validate that creator can delegate these permissions
  const canCreatorDelegate = await validateDelegation(
    data.createdBy,
    permissionBitmap,
    env,
    data.organizationId
  );

  if (!canCreatorDelegate) {
    throw new Error(
      "You cannot create a role with permissions you do not possess. Role permissions must be a subset of your own permissions."
    );
  }

  // Create role
  const now = new Date();
  const roleId = generateId();

  const newRole: NewRole = {
    id: roleId,
    name: data.name,
    description: data.description || null,
    permissionsLow: low,
    permissionsHigh: high,
    isSystem: false,
    organizationId: data.organizationId || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.roles).values(newRole).run();

  // Create audit log entry
  await createPermissionAuditEntry(
    {
      action: "role_create",
      actorUserId: data.createdBy,
      roleId,
      organizationId: data.organizationId,
      metadata: {
        roleName: data.name,
        permissionNames: data.permissionNames,
      },
    },
    env
  );

  // Fetch the created role to get proper types
  const createdRole = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
    .get();

  if (!createdRole) {
    throw new Error("Failed to create role");
  }

  return {
    ...createdRole,
    permissionNames: data.permissionNames,
  };
}

/**
 * Get all roles available in a scope
 *
 * @param env - Environment bindings
 * @param organizationId - Optional organization scope (null = global system roles)
 * @returns Array of roles with permission names
 */
export async function getRoles(
  env: Env,
  organizationId?: string
): Promise<RoleWithPermissions[]> {
  const db = initDb(env);

  const roles = await db
    .select()
    .from(schema.roles)
    .where(
      organizationId
        ? eq(schema.roles.organizationId, organizationId)
        : isNull(schema.roles.organizationId)
    )
    .all();

  return roles.map((role) => {
    const combined = mergeBitmap(role.permissionsLow, role.permissionsHigh);
    return {
      ...role,
      permissionNames: getPermissionNames(combined),
    };
  });
}

/**
 * Get a specific role by ID
 *
 * @param roleId - Role ID
 * @param env - Environment bindings
 * @returns Role with permission names, or null if not found
 */
export async function getRoleById(
  roleId: string,
  env: Env
): Promise<RoleWithPermissions | null> {
  const db = initDb(env);

  const role = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, roleId))
    .get();

  if (!role) {
    return null;
  }

  const combined = mergeBitmap(role.permissionsLow, role.permissionsHigh);

  return {
    ...role,
    permissionNames: getPermissionNames(combined),
  };
}

/**
 * Get permission audit trail
 *
 * @param filters - Optional filters
 * @param env - Environment bindings
 * @param limit - Maximum number of entries to return (default 100)
 * @returns Array of audit entries
 */
export async function getPermissionAuditTrail(
  filters: {
    userId?: string;
    roleId?: string;
    organizationId?: string;
    action?: PermissionAudit["action"];
  },
  env: Env,
  limit = 100
): Promise<PermissionAudit[]> {
  const db = initDb(env);

  const conditions = [];

  if (filters.userId) {
    conditions.push(
      or(
        eq(schema.permissionAudit.actorUserId, filters.userId),
        eq(schema.permissionAudit.targetUserId, filters.userId)
      )
    );
  }

  if (filters.roleId) {
    conditions.push(eq(schema.permissionAudit.roleId, filters.roleId));
  }

  if (filters.organizationId) {
    conditions.push(
      eq(schema.permissionAudit.organizationId, filters.organizationId)
    );
  }

  if (filters.action) {
    conditions.push(eq(schema.permissionAudit.action, filters.action));
  }

  const query = db
    .select()
    .from(schema.permissionAudit)
    .orderBy(desc(schema.permissionAudit.createdAt))
    .limit(limit);

  if (conditions.length > 0) {
    return query.where(and(...conditions)).all();
  }

  return query.all();
}

/**
 * Create a permission audit log entry (internal helper)
 */
async function createPermissionAuditEntry(
  data: {
    action: PermissionAudit["action"];
    actorUserId: string;
    targetUserId?: string;
    roleId?: string;
    organizationId?: string;
    teamId?: string;
    metadata?: Record<string, any>;
  },
  env: Env
): Promise<void> {
  const db = initDb(env);

  const entry: NewPermissionAudit = {
    id: generateId(),
    action: data.action,
    actorUserId: data.actorUserId,
    targetUserId: data.targetUserId || null,
    roleId: data.roleId || null,
    organizationId: data.organizationId || null,
    teamId: data.teamId || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    createdAt: new Date(),
  };

  await db.insert(schema.permissionAudit).values(entry).run();
}

/**
 * Clean up expired role assignments
 * Should be called periodically (e.g., via cron trigger)
 *
 * @param env - Environment bindings
 * @returns Number of expired assignments removed
 */
export async function cleanupExpiredAssignments(env: Env): Promise<number> {
  const db = initDb(env);

  const now = new Date();

  // Get all expired assignments
  const expiredAssignments = await db
    .select()
    .from(schema.roleAssignments)
    .where(
      and()
      // Filter for non-null expiresAt that is less than now
      // Note: We can't directly compare in SQLite, so we fetch and filter
    )
    .all();

  // Filter in JavaScript for now (SQLite timestamp comparison is tricky)
  const toDelete = expiredAssignments.filter(
    (a) => a.expiresAt && a.expiresAt.getTime() < now.getTime()
  );

  // Delete each expired assignment
  for (const assignment of toDelete) {
    await db
      .delete(schema.roleAssignments)
      .where(eq(schema.roleAssignments.id, assignment.id))
      .run();
  }

  return toDelete.length;
}
