/**
 * Database Schemas - Auto-generated from Drizzle
 *
 * Single source of truth for ALL database entities.
 * Uses drizzle-zod to auto-generate Zod schemas from Drizzle tables.
 *
 * ✅ Database schema IS the validation schema
 * ✅ Zero manual schema definitions
 * ✅ Maximum DRY principle
 */

import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  users,
  emailVerificationTokens,
  passwordResetTokens,
  refreshTokens,
  organizations,
  teams,
  oauthProviders,
  auditLog,
  roles,
  roleAssignments,
  permissionAudit,
} from "../db/schema";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// ============================================================================
// USERS
// ============================================================================

/**
 * Auto-generated User schemas from Drizzle
 */
const BaseUserSchema = createSelectSchema(users);

// Public user schema (excludes passwordHash)
export const UserApiSchema = BaseUserSchema.pick({
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  status: true,
}).openapi("User");

// Partial schemas for specific endpoints
export const UserApiSchemaForRegister = BaseUserSchema.pick({
  id: true,
  email: true,
  displayName: true,
}).openapi("RegisterUser");

export const UserApiSchemaForLogin = BaseUserSchema.pick({
  id: true,
  email: true,
  displayName: true,
  emailVerified: true,
}).openapi("LoginUser");

// ============================================================================
// EMAIL VERIFICATION TOKENS
// ============================================================================

export const EmailVerificationTokenSchema = createSelectSchema(
  emailVerificationTokens
).openapi("EmailVerificationToken");

export const NewEmailVerificationTokenSchema = createInsertSchema(
  emailVerificationTokens
).openapi("NewEmailVerificationToken");

// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================

export const PasswordResetTokenSchema =
  createSelectSchema(passwordResetTokens).openapi("PasswordResetToken");

export const NewPasswordResetTokenSchema = createInsertSchema(
  passwordResetTokens
).openapi("NewPasswordResetToken");

// ============================================================================
// REFRESH TOKENS
// ============================================================================

export const RefreshTokenSchema =
  createSelectSchema(refreshTokens).openapi("RefreshToken");

export const NewRefreshTokenSchema =
  createInsertSchema(refreshTokens).openapi("NewRefreshToken");

// ============================================================================
// ORGANIZATIONS (Phase 4+)
// ============================================================================

export const OrganizationSchema =
  createSelectSchema(organizations).openapi("Organization");

export const NewOrganizationSchema =
  createInsertSchema(organizations).openapi("NewOrganization");

// ============================================================================
// TEAMS (Phase 4+)
// ============================================================================

export const TeamSchema = createSelectSchema(teams).openapi("Team");

export const NewTeamSchema = createInsertSchema(teams).openapi("NewTeam");

// ============================================================================
// OAUTH PROVIDERS (Phase 6)
// ============================================================================

export const OAuthProviderSchema =
  createSelectSchema(oauthProviders).openapi("OAuthProvider");

export const NewOAuthProviderSchema =
  createInsertSchema(oauthProviders).openapi("NewOAuthProvider");

// ============================================================================
// AUDIT LOG (Phase 7)
// ============================================================================

export const AuditLogSchema = createSelectSchema(auditLog).openapi("AuditLog");

export const NewAuditLogSchema =
  createInsertSchema(auditLog).openapi("NewAuditLog");

// ============================================================================
// ROLES (Phase 4)
// ============================================================================

export const RoleSchema = createSelectSchema(roles).openapi("Role");

export const NewRoleSchema = createInsertSchema(roles).openapi("NewRole");

// API schema for roles with permission names
export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissionNames: z.array(z.string()).openapi({
    description: "Human-readable permission names",
    example: ["org.read", "org.write", "team.read"],
  }),
}).openapi("RoleWithPermissions");

// ============================================================================
// ROLE ASSIGNMENTS (Phase 4)
// ============================================================================

export const RoleAssignmentSchema =
  createSelectSchema(roleAssignments).openapi("RoleAssignment");

export const NewRoleAssignmentSchema =
  createInsertSchema(roleAssignments).openapi("NewRoleAssignment");

// ============================================================================
// PERMISSION AUDIT (Phase 4)
// ============================================================================

export const PermissionAuditSchema =
  createSelectSchema(permissionAudit).openapi("PermissionAudit");

export const NewPermissionAuditSchema =
  createInsertSchema(permissionAudit).openapi("NewPermissionAudit");

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserApi = z.infer<typeof UserApiSchema>;
export type UserApiForRegister = z.infer<typeof UserApiSchemaForRegister>;
export type UserApiForLogin = z.infer<typeof UserApiSchemaForLogin>;

// ============================================================================
// TRANSFORMATION FUNCTIONS (Just Validation - No Transformations!)
// ============================================================================

/**
 * Validate and parse user data for API response
 * No transformation - just validation
 */
export function transformUserToApi(dbUser: typeof users.$inferSelect): UserApi {
  return UserApiSchema.parse(dbUser);
}

export function transformUserForRegister(
  dbUser: typeof users.$inferSelect
): UserApiForRegister {
  return UserApiSchemaForRegister.parse(dbUser);
}

export function transformUserForLogin(
  dbUser: typeof users.$inferSelect
): UserApiForLogin {
  return UserApiSchemaForLogin.parse(dbUser);
}
