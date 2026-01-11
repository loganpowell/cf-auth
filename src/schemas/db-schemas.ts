/**
 * Database Schema Types
 * 
 * This file exports Zod schemas for the new multi-tenant database tables.
 * Legacy single-tenant tables have been removed.
 */

import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import * as schema from "../db/schema";

/**
 * Multi-tenant Schemas (New)
 */
export const TenantSchema = createSelectSchema(schema.tenants);
export const NewTenantSchema = createInsertSchema(schema.tenants);

export const ApiKeySchema = createSelectSchema(schema.apiKeys);
export const NewApiKeySchema = createInsertSchema(schema.apiKeys);

export const PlatformAdminSchema = createSelectSchema(schema.platformAdmins);
export const NewPlatformAdminSchema = createInsertSchema(schema.platformAdmins);

export const AccountSchema = createSelectSchema(schema.accounts);
export const NewAccountSchema = createInsertSchema(schema.accounts);

export const SessionSchema = createSelectSchema(schema.sessions);
export const NewSessionSchema = createInsertSchema(schema.sessions);

export const TenantDataSchemaSchema = createSelectSchema(schema.tenantDataSchemas);
export const NewTenantDataSchemaSchema = createInsertSchema(schema.tenantDataSchemas);

export const UsageMetricSchema = createSelectSchema(schema.usageMetrics);
export const NewUsageMetricSchema = createInsertSchema(schema.usageMetrics);

export const VerificationTokenSchema = createSelectSchema(schema.verificationTokens);
export const NewVerificationTokenSchema = createInsertSchema(schema.verificationTokens);

export const PlatformAdminTenantPermissionSchema = createSelectSchema(schema.platformAdminTenantPermissions);
export const NewPlatformAdminTenantPermissionSchema = createInsertSchema(schema.platformAdminTenantPermissions);
