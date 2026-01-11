/**
 * Relish Multi-Tenant Database Schema
 *
 * ARCHITECTURE:
 * 1. PLATFORM INFRASTRUCTURE (hardcoded SQL)
 *    - Manages tenants, admins, API keys, schema versioning
 *    - Fixed schema controlled by Relish team
 *
 * 2. PLATFORM PERMISSIONS (dogfooted with Relish's own auth)
 *    - Defined in platform-schema.yaml
 *    - Uses KuzuDB authorization graph for access control
 *    - Who can do what to platform resources
 *
 * 3. TENANT DATA SCHEMAS (YAML → Drizzle → D1)
 *    - Each tenant defines their data structure via schema.yaml
 *    - Compiled to Drizzle table definitions
 *    - Applied as migrations to tenant's D1 database
 *
 * 4. TENANT PERMISSIONS (tenant-specific dogfooding)
 *    - Each tenant's schema.yaml includes permission definitions
 *    - Their own KuzuDB graph for resource access
 *
 * This file only contains the PLATFORM INFRASTRUCTURE layer.
 * Tenant data is schema-driven and versioned in tenantDataSchemas.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ==============================================================================
// PLATFORM INFRASTRUCTURE TABLES
// ==============================================================================

// ============================================================================
// Tenants - Customer organizations using Relish
// ============================================================================

export const tenants = sqliteTable(
  "tenants",
  {
    // Primary key and identification
    id: text("id").primaryKey(), // "tenant:acme-corp"
    slug: text("slug").notNull().unique(), // "acme-corp" (for subdomain routing)
    name: text("name").notNull(),

    // Hierarchy support (graph-of-graphs)
    parentId: text("parent_id"), // NULL for root tenants, references tenants.id for children
    depth: integer("depth").notNull().default(0), // 0 = root, 1+ = nested

    // Subscription and status
    plan: text("plan", { enum: ["free", "pro", "enterprise"] })
      .notNull()
      .default("free"),
    status: text("status", {
      enum: ["active", "suspended", "deleted"],
    })
      .notNull()
      .default("active"),

    // API credentials (public/secret for OAuth and APIs)
    publicKey: text("public_key").notNull().unique(), // pk_live_xxx
    secretKey: text("secret_key").notNull().unique(), // sk_live_xxx (encrypted)

    // Tenant branding and configuration
    branding: text("branding"), // JSON: {logo, colors, customDomain, etc}

    // Limits (enforced by middleware)
    limits: text("limits"), // JSON: {maxUsers, maxSchemaSize, maxRequests, etc}

    // Schema versioning (points to current active schema)
    schemaVersion: text("schema_version").default("1.0.0"),

    // Timestamps
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_tenants_slug").on(table.slug),
    index("idx_tenants_parent").on(table.parentId),
    index("idx_tenants_status").on(table.status),
    index("idx_tenants_plan").on(table.plan),
    index("idx_tenants_depth").on(table.depth),
  ]
);

// ============================================================================
// Platform Admins - Relish employees with platform access
// ============================================================================

export const platformAdmins = sqliteTable(
  "platform_admins",
  {
    id: text("id").primaryKey(), // "admin:logan"
    email: text("email").notNull().unique(),
    name: text("name").notNull(),

    // Role determines permissions (defined in platform-schema.yaml)
    role: text("role", {
      enum: ["superadmin", "support", "billing", "readonly"],
    })
      .notNull()
      .default("readonly"),

    // Auth
    passwordHash: text("password_hash"), // For platform admin panel login
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),

    // Timestamps
    createdAt: integer("created_at").notNull(),
    lastLoginAt: integer("last_login_at"),
  },
  (table) => [
    uniqueIndex("idx_platform_admins_email").on(table.email),
    index("idx_platform_admins_role").on(table.role),
  ]
);

// ============================================================================
// Platform Admin → Tenant Permissions (graph edges in authorization)
// ============================================================================

export const platformAdminTenantPermissions = sqliteTable(
  "platform_admin_tenant_permissions",
  {
    adminId: text("admin_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Permission is the edge type (e.g., "manages" with sub-permissions)
    permission: text("permission").notNull(), // "manage", "view", "support"

    grantedAt: integer("granted_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_admin_tenant_perm").on(table.adminId, table.tenantId),
    index("idx_admin_perm").on(table.adminId),
    index("idx_tenant_admin").on(table.tenantId),
  ]
);

// ============================================================================
// API Keys - Tenant credentials (public/secret for their apps)
// ============================================================================

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(), // "key:abc123"
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Key identification and format
    keyPrefix: text("key_prefix").notNull(), // "pk_live_abc123def456"
    keyHash: text("key_hash").notNull(), // SHA256 hash (stored, not original key)
    name: text("name").notNull(), // "Production API Key" or "Mobile App Key"

    // Key properties
    type: text("type", { enum: ["public", "secret", "restricted"] }).notNull(),
    environment: text("environment", { enum: ["test", "live"] }).notNull(),
    permissions: text("permissions"), // JSON: scopes/permissions granted to this key

    // Lifecycle
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"), // NULL = active, set = revoked
  },
  (table) => [
    uniqueIndex("idx_api_key_prefix").on(table.keyPrefix),
    index("idx_api_key_tenant").on(table.tenantId),
    index("idx_api_key_revoked").on(table.revokedAt),
  ]
);

// ============================================================================
// Tenant Data Schemas - YAML schemas that tenants upload to define their data
// ============================================================================

export const tenantDataSchemas = sqliteTable(
  "tenant_data_schemas",
  {
    id: text("id").primaryKey(), // "schema:acme-corp:1.0.0"
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Versioning (semantic versioning)
    version: text("version").notNull(), // "1.0.0", "2.1.3"
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(false), // Only one version active per tenant

    // Schema content
    yamlContent: text("yaml_content").notNull(), // The actual YAML schema
    yamlHash: text("yaml_hash").notNull(), // SHA256 hash for change detection

    // Compilation results
    compiledDrizzleTypes: text("compiled_drizzle_types"), // Generated TypeScript types
    compiledValidators: text("compiled_validators"), // Runtime validators (Zod, etc)
    compilationStatus: text("compilation_status", {
      enum: ["pending", "compiling", "success", "failed"],
    })
      .notNull()
      .default("pending"),
    compilationError: text("compilation_error"), // Error message if compilation failed

    // Metadata
    sizeKb: real("size_kb"), // For quotas
    entityCount: integer("entity_count"), // Number of entities defined
    relationshipCount: integer("relationship_count"), // Number of relationships

    // Timestamps
    publishedAt: integer("published_at").notNull(),
    activatedAt: integer("activated_at"), // When this version became active
  },
  (table) => [
    uniqueIndex("idx_schema_version").on(table.tenantId, table.version),
    index("idx_schema_active").on(table.tenantId, table.isActive),
    index("idx_schema_status").on(table.compilationStatus),
  ]
);

// ============================================================================
// Usage Metrics - Billing and quota tracking per tenant
// ============================================================================

export const usageMetrics = sqliteTable(
  "usage_metrics",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // What's being measured
    metricType: text("metric_type", {
      enum: [
        "auth_requests",
        "authz_queries",
        "api_calls",
        "storage_mb",
        "schema_updates",
      ],
    }).notNull(),

    // The count
    count: integer("count").notNull().default(0),

    // Time period (hourly buckets for efficiency)
    periodStart: integer("period_start").notNull(), // Hour boundary
    periodEnd: integer("period_end").notNull(),

    // Timestamps
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    index("idx_metrics_tenant").on(table.tenantId),
    index("idx_metrics_type").on(table.metricType),
    index("idx_metrics_period").on(table.periodStart, table.periodEnd),
  ]
);

// ==============================================================================
// AUTH.JS ADAPTER TABLES (for platform admin authentication)
// ==============================================================================

// ============================================================================
// Accounts - OAuth provider accounts (for platform admins to use Relish OAuth)
// ============================================================================

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),

    // OAuth provider info
    type: text("type").notNull(), // "oauth", "email"
    provider: text("provider").notNull(), // "github", "google", etc
    providerAccountId: text("provider_account_id").notNull(),

    // Tokens (encrypted in transit)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: integer("expires_at"),

    // Scope
    scope: text("scope"),

    // Timestamps
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_account_provider").on(
      table.userId,
      table.provider,
      table.providerAccountId
    ),
  ]
);

// ============================================================================
// Sessions - Auth.js session tokens for platform admins
// ============================================================================

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    sessionToken: text("session_token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),

    // Expiration
    expiresAt: integer("expires_at").notNull(),

    // Timestamps
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_session_token").on(table.sessionToken)]
);

// ============================================================================
// Verification Tokens - Email verification for platform admin signup
// ============================================================================

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(), // email address
    token: text("token").notNull(),
    expiresAt: integer("expires_at").notNull(),

    // Timestamps
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_verification_token").on(table.identifier, table.token),
  ]
);

// ============================================================================
// Tenant Users - End-users who belong to tenants (app users)
// ============================================================================

export const tenantUsers = sqliteTable(
  "tenant_users",
  {
    id: text("id").primaryKey(), // "user:acme-corp:john-doe"
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // User identification
    email: text("email").notNull(),
    username: text("username"), // Optional display name/username

    // Authentication
    passwordHash: text("password_hash").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),

    // User profile
    name: text("name"),
    avatar: text("avatar"), // URL or base64
    metadata: text("metadata"), // JSON: custom tenant-specific user data

    // Status
    status: text("status", {
      enum: ["active", "suspended", "deleted"],
    })
      .notNull()
      .default("active"),

    // Timestamps
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastLoginAt: integer("last_login_at"),
  },
  (table) => [
    uniqueIndex("idx_tenant_user_email").on(table.tenantId, table.email),
    index("idx_tenant_users_tenant").on(table.tenantId),
    index("idx_tenant_users_status").on(table.status),
  ]
);

// ============================================================================
// Tenant User Sessions - JWT sessions for tenant users
// ============================================================================

export const tenantUserSessions = sqliteTable(
  "tenant_user_sessions",
  {
    id: text("id").primaryKey(),
    sessionToken: text("session_token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => tenantUsers.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Session metadata
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Expiration
    expiresAt: integer("expires_at").notNull(),

    // Timestamps
    createdAt: integer("created_at").notNull(),
    lastActivityAt: integer("last_activity_at").notNull(),
  },
  (table) => [
    index("idx_tenant_session_token").on(table.sessionToken),
    index("idx_tenant_session_user").on(table.userId),
  ]
);

// ==============================================================================
// TYPE EXPORTS - Use these for type safety
// ==============================================================================

// Tenant types
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

// Platform admin types
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type NewPlatformAdmin = typeof platformAdmins.$inferInsert;

// Platform admin tenant permission types
export type PlatformAdminTenantPermission =
  typeof platformAdminTenantPermissions.$inferSelect;
export type NewPlatformAdminTenantPermission =
  typeof platformAdminTenantPermissions.$inferInsert;

// API key types
export type APIKey = typeof apiKeys.$inferSelect;
export type NewAPIKey = typeof apiKeys.$inferInsert;

// Tenant data schema types
export type TenantDataSchema = typeof tenantDataSchemas.$inferSelect;
export type NewTenantDataSchema = typeof tenantDataSchemas.$inferInsert;

// Usage metric types
export type UsageMetric = typeof usageMetrics.$inferSelect;
export type NewUsageMetric = typeof usageMetrics.$inferInsert;

// Auth.js adapter types
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

// Tenant user types
export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;

// Tenant user session types
export type TenantUserSession = typeof tenantUserSessions.$inferSelect;
export type NewTenantUserSession = typeof tenantUserSessions.$inferInsert;
