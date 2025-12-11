/**
 * User Service - Business logic for user operations
 *
 * Handles user registration, authentication, and profile management.
 */

import type { User, Env } from "../types";
import { hashPassword, verifyPassword } from "../utils/crypto";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin,
  getUserOrganizations,
} from "../db/queries";
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
  const existingUser = await findUserByEmail(data.email, env);
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await createUser(
    {
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      emailVerified: false, // Will need email verification
    },
    env
  );

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
  // Find user by email
  const user = await findUserByEmail(data.email, env);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check if user has a password (might be OAuth-only user)
  if (!user.password_hash) {
    throw new Error(
      "This account uses social login. Please sign in with your connected provider."
    );
  }

  // Verify password
  const isValid = await verifyPassword(data.password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Check account status
  if (user.status === "suspended") {
    throw new Error("Account has been suspended. Please contact support.");
  }

  // Update last login
  await updateLastLogin(user.id, env);

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
  // Verify and get user ID from refresh token
  const userId = await verifyRefreshToken(refreshToken, env);

  // Get user
  const user = await findUserById(userId, env);
  if (!user) {
    throw new Error("User not found");
  }

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
  const user = await findUserById(userId, env);
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
