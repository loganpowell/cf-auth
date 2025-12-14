/**
 * Drizzle ORM Database Schema
 *
 * This file defines the database schema using Drizzle ORM.
 * Types are automatically inferred from the schema definition.
 *
 * To use these types:
 * ```ts
 * import { users } from "./db/schema";
 * type User = typeof users.$inferSelect;
 * type NewUser = typeof users.$inferInsert;
 * ```
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ============================================================================
// Users Table
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"), // NULL for OAuth-only accounts
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    displayName: text("display_name"), // Optional - defaults to email prefix if not set
    avatarUrl: text("avatar_url"), // Optional - user profile picture URL
    createdAt: integer("created_at").notNull(), // Unix timestamp (seconds)
    updatedAt: integer("updated_at").notNull(), // Unix timestamp (seconds)
    lastLoginAt: integer("last_login_at"), // Unix timestamp (seconds)
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
  },
  (table) => [
    uniqueIndex("idx_users_email").on(table.email),
    index("idx_users_created_at").on(table.createdAt),
  ]
);

// ============================================================================
// Email Verification Tokens
// ============================================================================

export const emailVerificationTokens = sqliteTable(
  "email_verification_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    email: text("email").notNull(),
    expiresAt: integer("expires_at").notNull(), // Unix timestamp (seconds)
    createdAt: integer("created_at").notNull(), // Unix timestamp (seconds)
  },
  (table) => [
    uniqueIndex("idx_email_verification_token").on(table.token),
    index("idx_email_verification_user").on(table.userId),
  ]
);

// ============================================================================
// Password Reset Tokens
// ============================================================================

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at").notNull(), // Unix timestamp (seconds)
    usedAt: integer("used_at"), // Unix timestamp (seconds)
    createdAt: integer("created_at").notNull(), // Unix timestamp (seconds)
  },
  (table) => [
    uniqueIndex("idx_password_reset_token").on(table.token),
    index("idx_password_reset_user").on(table.userId),
  ]
);

// ============================================================================
// Refresh Tokens (Not in SQL schema yet, but used in current implementation)
// ============================================================================

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(), // Unix timestamp (seconds)
    createdAt: integer("created_at").notNull(), // Unix timestamp (seconds)
    revokedAt: integer("revoked_at"), // Unix timestamp (seconds)
  },
  (table) => [
    index("idx_refresh_tokens_user").on(table.userId),
    index("idx_refresh_tokens_hash").on(table.tokenHash),
  ]
);

// ============================================================================
// Organizations (Phase 4+)
// ============================================================================

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
  },
  (table) => [
    uniqueIndex("idx_organizations_slug").on(table.slug),
    index("idx_organizations_owner").on(table.ownerUserId),
  ]
);

// ============================================================================
// Teams (Phase 4+)
// ============================================================================

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
  },
  (table) => [
    index("idx_teams_org").on(table.organizationId),
    uniqueIndex("idx_teams_slug").on(table.organizationId, table.slug),
  ]
);

// ============================================================================
// OAuth Providers (Phase 6)
// ============================================================================

export const oauthProviders = sqliteTable(
  "oauth_providers",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'github', 'google', 'twitter'
    providerUserId: text("provider_user_id").notNull(),
    providerUsername: text("provider_username"),
    providerEmail: text("provider_email"),
    accessToken: text("access_token"), // Encrypted
    refreshToken: text("refresh_token"), // Encrypted
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("pk_oauth_providers").on(table.userId, table.provider),
    uniqueIndex("idx_oauth_provider_user").on(
      table.provider,
      table.providerUserId
    ),
  ]
);

// ============================================================================
// Roles (Phase 4)
// ============================================================================

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    // Permission bitmap stored as two text fields (can hold bigint as string)
    permissionsLow: text("permissions_low").notNull().default("0"), // Bits 0-63
    permissionsHigh: text("permissions_high").notNull().default("0"), // Bits 64-127
    isSystem: integer("is_system", { mode: "boolean" })
      .notNull()
      .default(false), // System roles cannot be deleted
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }), // NULL = global system role
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_roles_org").on(table.organizationId),
    index("idx_roles_system").on(table.isSystem),
  ]
);

// ============================================================================
// Role Assignments (Phase 4)
// ============================================================================

export const roleAssignments = sqliteTable(
  "role_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }), // NULL = global assignment
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }), // NULL = org-level assignment
    grantedBy: text("granted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }), // Who granted this role
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }), // NULL = no expiration
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_role_assignments_user").on(table.userId),
    index("idx_role_assignments_role").on(table.roleId),
    index("idx_role_assignments_org").on(table.organizationId),
    index("idx_role_assignments_team").on(table.teamId),
    uniqueIndex("idx_role_assignments_unique").on(
      table.userId,
      table.roleId,
      table.organizationId,
      table.teamId
    ),
  ]
);

// ============================================================================
// Permission Audit (Phase 4)
// ============================================================================

export const permissionAudit = sqliteTable(
  "permission_audit",
  {
    id: text("id").primaryKey(),
    action: text("action", {
      enum: ["grant", "revoke", "role_create", "role_update", "role_delete"],
    }).notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }), // Who performed the action
    targetUserId: text("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }), // Who was affected
    roleId: text("role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    metadata: text("metadata"), // JSON - additional context
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_permission_audit_actor").on(table.actorUserId),
    index("idx_permission_audit_target").on(table.targetUserId),
    index("idx_permission_audit_org").on(table.organizationId),
    index("idx_permission_audit_created").on(table.createdAt),
  ]
);

// ============================================================================
// Audit Log (Phase 7)
// ============================================================================

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_created").on(table.createdAt),
    index("idx_audit_action").on(table.action),
  ]
);

// ============================================================================
// Type Exports - Use these instead of manually defined types
// ============================================================================

// User types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Email verification token types
export type EmailVerificationToken =
  typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken =
  typeof emailVerificationTokens.$inferInsert;

// Password reset token types
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// Refresh token types
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

// Organization types (Phase 4+)
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

// Team types (Phase 4+)
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

// OAuth provider types (Phase 6)
export type OAuthProvider = typeof oauthProviders.$inferSelect;
export type NewOAuthProvider = typeof oauthProviders.$inferInsert;

// Role types (Phase 4)
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

// Role assignment types (Phase 4)
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type NewRoleAssignment = typeof roleAssignments.$inferInsert;

// Permission audit types (Phase 4)
export type PermissionAudit = typeof permissionAudit.$inferSelect;
export type NewPermissionAudit = typeof permissionAudit.$inferInsert;

// Audit log types (Phase 7)
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
