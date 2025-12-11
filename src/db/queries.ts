/**
 * Database queries for user and token management
 *
 * All database interactions for users, refresh tokens, and related operations.
 */

import type { User, Env } from "../types";
import { generateId } from "../utils/crypto";

/**
 * Create a new user in the database
 *
 * @param data - User creation data
 * @param env - Environment bindings
 * @returns Created user object
 */
export async function createUser(
  data: {
    email: string;
    passwordHash?: string;
    displayName: string;
    avatarUrl?: string;
    emailVerified?: boolean;
  },
  env: Env
): Promise<User> {
  const userId = generateId();
  const now = Math.floor(Date.now() / 1000);

  const user: User = {
    id: userId,
    email: data.email.toLowerCase(),
    password_hash: data.passwordHash,
    display_name: data.displayName,
    avatar_url: data.avatarUrl,
    email_verified: data.emailVerified || false,
    created_at: now,
    updated_at: now,
    status: "active",
    mfa_enabled: false,
  };

  // Use only columns that exist in the current schema
  await env.DB.prepare(
    `INSERT INTO users (
      id, email, password_hash, email_verified, created_at, updated_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      user.id,
      user.email,
      user.password_hash || null,
      user.email_verified ? 1 : 0,
      user.created_at,
      user.updated_at,
      1 // is_active = true
    )
    .run();

  return user;
}

/**
 * Find a user by email
 *
 * @param email - User email
 * @param env - Environment bindings
 * @returns User object if found, null otherwise
 */
export async function findUserByEmail(
  email: string,
  env: Env
): Promise<User | null> {
  const result = await env.DB.prepare(
    `SELECT * FROM users WHERE email = ? AND is_active = 1`
  )
    .bind(email.toLowerCase())
    .first<any>();

  if (!result) {
    return null;
  }

  return mapDbRowToUser(result);
}

/**
 * Find a user by ID
 *
 * @param userId - User ID
 * @param env - Environment bindings
 * @returns User object if found, null otherwise
 */
export async function findUserById(
  userId: string,
  env: Env
): Promise<User | null> {
  const result = await env.DB.prepare(
    `SELECT * FROM users WHERE id = ? AND is_active = 1`
  )
    .bind(userId)
    .first<any>();

  if (!result) {
    return null;
  }

  return mapDbRowToUser(result);
}

/**
 * Update user's last login timestamp
 *
 * @param userId - User ID
 * @param env - Environment bindings
 */
export async function updateLastLogin(userId: string, env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`
  )
    .bind(now, now, userId)
    .run();
}

/**
 * Update user's email verification status
 *
 * @param userId - User ID
 * @param env - Environment bindings
 */
export async function markEmailAsVerified(
  userId: string,
  env: Env
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?`
  )
    .bind(now, userId)
    .run();
}

/**
 * Update user's password
 *
 * @param userId - User ID
 * @param passwordHash - New password hash
 * @param env - Environment bindings
 */
export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  env: Env
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
  )
    .bind(passwordHash, now, userId)
    .run();
}

/**
 * Get user's organizations with permissions (for JWT token)
 *
 * @param _userId - User ID (unused in Phase 2, will be used in Phase 4)
 * @param _env - Environment bindings (unused in Phase 2, will be used in Phase 4)
 * @returns Array of organizations with permission bitmaps
 */
export async function getUserOrganizations(
  _userId: string,
  _env: Env
): Promise<
  Array<{
    id: string;
    slug: string;
    perms: { low: string; high: string };
    is_owner: boolean;
  }>
> {
  // For Phase 2, we'll return an empty array since we haven't implemented
  // the organization/permission system yet.
  // This will be populated in Phase 4.
  return [];
}

/**
 * Map database row to User object
 *
 * @param row - Database row
 * @returns User object
 */
function mapDbRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    display_name: row.display_name || row.email.split("@")[0], // Fallback to email prefix
    avatar_url: row.avatar_url,
    email_verified: row.email_verified === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
    status: row.is_active === 1 ? "active" : "suspended",
    mfa_enabled: row.mfa_enabled === 1 || false,
    mfa_secret: row.mfa_secret,
    mfa_backup_codes: row.mfa_backup_codes,
    mfa_method: row.mfa_method,
  };
}
