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

// Audit log types (Phase 7)
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
