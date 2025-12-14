/**
 * User Service - Business logic for user operations
 *
 * Handles user registration, authentication, and profile management.
 */

import { eq } from "drizzle-orm";
import { initDb, schema } from "../db";
import type { User } from "../db/schema";
import type { Env } from "../types";
import { hashPassword, verifyPassword } from "../utils/crypto";
import { generateId } from "../utils/crypto";
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from "./token.service";

export interface RegisterResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Get user organizations (Phase 4 - placeholder)
 */
async function getUserOrganizations(
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
  // For Phase 2/3, we'll return an empty array since we haven't implemented
  // the organization/permission system yet.
  // This will be populated in Phase 4.
  return [];
}

/**
 * Register a new user
 *
 * @param data - Registration data
 * @param env - Environment bindings
 * @returns User and tokens
 * @throws Error if email already exists or validation fails
 */
export async function registerUser(
  data: {
    email: string;
    password: string;
    displayName: string;
  },
  env: Env
): Promise<RegisterResult> {
  const db = initDb(env);

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error("Invalid email format");
  }

  // Validate password strength
  if (data.password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  // TODO: Add more password validation (uppercase, lowercase, number, special char)

  // Check if user already exists
  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, data.email.toLowerCase()))
    .get();

  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const userId = generateId();

  await db.insert(schema.users).values({
    id: userId,
    email: data.email.toLowerCase(),
    passwordHash: passwordHash,
    emailVerified: false,
    displayName: data.displayName || null,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    status: "active",
  });

  // Fetch the created user
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user) {
    throw new Error("Failed to create user");
  }

  // Generate tokens
  const organizations = await getUserOrganizations(user.id, env);
  const accessToken = await generateAccessToken(user, env, organizations);
  const refreshTokenData = await generateRefreshToken(env);

  // Store refresh token
  await storeRefreshToken(
    user.id,
    refreshTokenData.tokenHash,
    refreshTokenData.expiresAt,
    env
  );

  // TODO: Send welcome + verification email (Phase 3)

  return {
    user,
    accessToken,
    refreshToken: refreshTokenData.token,
  };
}

/**
 * Authenticate a user with email and password
 *
 * @param data - Login credentials
 * @param env - Environment bindings
 * @returns User and tokens
 * @throws Error if credentials are invalid
 */
export async function loginUser(
  data: {
    email: string;
    password: string;
  },
  env: Env
): Promise<LoginResult> {
  const db = initDb(env);

  // Find user by email
  const rawUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, data.email.toLowerCase()))
    .get();

  if (!rawUser) {
    throw new Error("Invalid email or password");
  }

  // Check if user has a password (might be OAuth-only user)
  if (!rawUser.passwordHash) {
    throw new Error(
      "This account uses social login. Please sign in with your connected provider."
    );
  }

  // Verify password
  const isValid = await verifyPassword(data.password, rawUser.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Check account status (status replaces isActive field)
  if (rawUser.status !== "active") {
    throw new Error("Account has been suspended. Please contact support.");
  }

  // Update last login
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  await db
    .update(schema.users)
    .set({ lastLoginAt: now })
    .where(eq(schema.users.id, rawUser.id));

  const user = rawUser;

  // Generate tokens
  const organizations = await getUserOrganizations(user.id, env);
  const accessToken = await generateAccessToken(user, env, organizations);
  const refreshTokenData = await generateRefreshToken(env);

  // Store refresh token
  await storeRefreshToken(
    user.id,
    refreshTokenData.tokenHash,
    refreshTokenData.expiresAt,
    env
  );

  // TODO: Check for suspicious login (Phase 7)

  return {
    user,
    accessToken,
    refreshToken: refreshTokenData.token,
  };
}

/**
 * Refresh access token using refresh token
 *
 * @param refreshToken - Current refresh token
 * @param env - Environment bindings
 * @returns New tokens
 * @throws Error if refresh token is invalid
 */
export async function refreshUserToken(
  refreshToken: string,
  env: Env
): Promise<{ accessToken: string; refreshToken: string }> {
  const db = initDb(env);

  // Verify and get user ID from refresh token
  const userId = await verifyRefreshToken(refreshToken, env);

  // Get user
  const rawUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!rawUser) {
    throw new Error("User not found");
  }

  const user = rawUser;

  // Revoke old refresh token (single-use rotation)
  await revokeRefreshToken(refreshToken, env);

  // Generate new tokens
  const organizations = await getUserOrganizations(user.id, env);
  const accessToken = await generateAccessToken(user, env, organizations);
  const refreshTokenData = await generateRefreshToken(env);

  // Store new refresh token
  await storeRefreshToken(
    user.id,
    refreshTokenData.tokenHash,
    refreshTokenData.expiresAt,
    env
  );

  return {
    accessToken,
    refreshToken: refreshTokenData.token,
  };
}

/**
 * Get user by ID (for /auth/me endpoint)
 *
 * @param userId - User ID
 * @param env - Environment bindings
 * @returns User object
 * @throws Error if user not found
 */
export async function getUserById(userId: string, env: Env): Promise<User> {
  const db = initDb(env);

  const rawUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!rawUser) {
    throw new Error("User not found");
  }

  return rawUser;
}
