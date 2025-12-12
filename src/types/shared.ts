/**
 * Shared Types - Used across Frontend, Backend, and Infrastructure
 *
 * This file contains type definitions that are shared between:
 * - Backend (Cloudflare Workers)
 * - Frontend (Qwik Demo App)
 * - Infrastructure (Pulumi)
 *
 * Export this from backend and import in demo app for type safety.
 */

// ============================================================================
// User & Authentication Types
// ============================================================================

/**
 * User object returned from API endpoints
 * Excludes sensitive information like password_hash
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  isActive: boolean;
}

/**
 * Authentication response (login/register)
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  message?: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  accessToken: string;
}

/**
 * JWT Access Token Payload
 */
export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  email_verified: boolean;
  iat: number;
  exp: number;
  jti: string;
  display_name: string;
  avatar_url?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Registration request body
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Email verification request
 */
export interface VerifyEmailRequest {
  token: string;
}

/**
 * Resend verification email request
 */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * Password reset request (forgot password)
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Password reset (with token)
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Change password (authenticated)
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  data?: T;
  message?: string;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================================================
// Database Record Types (for backend use)
// ============================================================================

/**
 * User database record
 */
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string | null;
  email_verified: number; // SQLite boolean (0/1)
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  is_active: number; // SQLite boolean (0/1)
}

/**
 * Email verification token record
 */
export interface EmailVerificationTokenRecord {
  id: string;
  user_id: string;
  token: string;
  email: string;
  expires_at: number;
  created_at: number;
}

/**
 * Password reset token record
 */
export interface PasswordResetTokenRecord {
  id: string;
  user_id: string;
  token: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

/**
 * Refresh token record
 */
export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  used_at: number | null;
}

/**
 * Audit log record
 */
export interface AuditLogRecord {
  id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null; // JSON string
  created_at: number;
}

// ============================================================================
// Organization & Team Types
// ============================================================================

/**
 * Organization object
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

/**
 * Organization database record
 */
export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  created_at: number;
  updated_at: number;
  is_active: number;
}

/**
 * Team object
 */
export interface Team {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

/**
 * Team database record
 */
export interface TeamRecord {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
  is_active: number;
}

// ============================================================================
// Email Types
// ============================================================================

/**
 * Email sending options
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

/**
 * Email verification email data
 */
export interface VerificationEmailData {
  email: string;
  verificationUrl: string;
  expiresIn: string; // e.g., "24 hours"
}

/**
 * Password reset email data
 */
export interface PasswordResetEmailData {
  email: string;
  resetUrl: string;
  expiresIn: string; // e.g., "1 hour"
}

// ============================================================================
// OAuth Types
// ============================================================================

/**
 * OAuth provider names
 */
export type OAuthProvider = "google" | "github" | "twitter";

/**
 * OAuth provider record
 */
export interface OAuthProviderRecord {
  user_id: string;
  provider: OAuthProvider;
  provider_user_id: string;
  provider_username: string | null;
  provider_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * OAuth account link response
 */
export interface LinkedAccount {
  provider: OAuthProvider;
  providerUsername: string | null;
  providerEmail: string | null;
  linkedAt: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Convert SQLite boolean (0/1) to TypeScript boolean
 */
export function sqliteBoolToBoolean(value: number): boolean {
  return value === 1;
}

/**
 * Convert TypeScript boolean to SQLite boolean (0/1)
 */
export function booleanToSqliteBool(value: boolean): number {
  return value ? 1 : 0;
}

/**
 * Convert database record to API user object
 */
export function dbUserToUser(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    displayName: record.email.split("@")[0] || "User", // Fallback if no display_name column
    avatarUrl: undefined,
    emailVerified: sqliteBoolToBoolean(record.email_verified),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastLoginAt: record.last_login_at ?? undefined,
    isActive: sqliteBoolToBoolean(record.is_active),
  };
}

/**
 * Convert database organization record to API object
 */
export function dbOrgToOrg(record: OrganizationRecord): Organization {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    ownerUserId: record.owner_user_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    isActive: sqliteBoolToBoolean(record.is_active),
  };
}

/**
 * Convert database team record to API object
 */
export function dbTeamToTeam(record: TeamRecord): Team {
  return {
    id: record.id,
    organizationId: record.organization_id,
    name: record.name,
    slug: record.slug,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    isActive: sqliteBoolToBoolean(record.is_active),
  };
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ============================================================================
// Audit Log Types
// ============================================================================

/**
 * Audit log action types
 */
export type AuditAction =
  | "register"
  | "login"
  | "logout"
  | "email_verified"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "oauth_linked"
  | "oauth_unlinked"
  | "org_created"
  | "org_deleted"
  | "team_created"
  | "team_deleted"
  | "member_invited"
  | "member_removed";

/**
 * Audit log entry for API responses
 */
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

// ============================================================================
// Validation Error Types
// ============================================================================

/**
 * Field validation error
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  error: "Validation failed";
  details: FieldError[];
}
