/**
 * Token Service - JWT generation and validation
 *
 * Handles access and refresh token lifecycle using the jose library.
 */

import * as jose from "jose";
import { eq, and, gt, isNull } from "drizzle-orm";
import type { AccessTokenPayload, Env } from "../types";
import type { User } from "../db/schema";
import { initDb, schema } from "../db";
import { generateId, generateSecureToken, hashToken } from "../utils/crypto";

/**
 * Generate an access token for a user
 *
 * @param user - User object
 * @param env - Environment bindings
 * @param organizations - User's organizations with permissions (optional for new users)
 * @returns Signed JWT access token
 */
export async function generateAccessToken(
  user: User,
  env: Env,
  organizations: Array<{
    id: string;
    slug: string;
    perms: { low: string; high: string };
    is_owner: boolean;
  }> = []
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const expirationSeconds = parseInt(env.JWT_ACCESS_EXPIRATION || "900"); // 15 minutes default

  // Map organization data to token payload format
  const orgPermissions = organizations.map((org) => ({
    id: org.id,
    role: org.is_owner ? "owner" : "member",
    permissions: [org.perms.low, org.perms.high],
  }));

  const payload: AccessTokenPayload = {
    // Standard claims
    sub: user.id,
    email: user.email,
    email_verified: user.emailVerified,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expirationSeconds,
    jti: generateId(),

    // User info
    display_name: user.displayName ?? user.email.split("@")[0] ?? "user",
    avatar_url: user.avatarUrl ?? undefined,

    // Permissions
    permissions: {
      organizations: orgPermissions,
      resources: [], // Will be populated when needed
    },
  };

  // Generate JWT
  const jwt = await new jose.SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .setJti(payload.jti)
    .setSubject(payload.sub)
    .sign(secret);

  return jwt;
}

/**
 * Generate a refresh token and store it in the database
 *
 * @param env - Environment bindings
 * @returns Object containing the token and its hash for storage
 */
export async function generateRefreshToken(
  env: Env
): Promise<{ token: string; tokenHash: string; expiresAt: number }> {
  const token = generateSecureToken(32);
  const tokenHash = await hashToken(token);
  const expirationSeconds = parseInt(env.JWT_REFRESH_EXPIRATION || "604800"); // 7 days default
  const expiresAt = Math.floor(Date.now() / 1000) + expirationSeconds;

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

/**
 * Verify and decode an access token
 *
 * @param token - JWT access token
 * @param env - Environment bindings
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyAccessToken(
  token: string,
  env: Env
): Promise<AccessTokenPayload> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jose.jwtVerify(token, secret);

    // Check if token is blacklisted
    const jti = payload.jti as string;
    const isBlacklisted = await env.TOKEN_BLACKLIST.get(`blacklist:${jti}`);

    if (isBlacklisted) {
      throw new Error("Token has been revoked");
    }

    return payload as unknown as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new Error("Token has expired");
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new Error("Invalid token");
    }
    throw error;
  }
}

/**
 * Blacklist a token (used during logout)
 *
 * @param jti - JWT ID to blacklist
 * @param expiresAt - When the token would normally expire
 * @param env - Environment bindings
 */
export async function blacklistToken(
  jti: string,
  expiresAt: number,
  env: Env
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(0, expiresAt - now);

  // Store in KV with TTL matching token expiration
  await env.TOKEN_BLACKLIST.put(`blacklist:${jti}`, now.toString(), {
    expirationTtl: ttl,
  });
}

/**
 * Store refresh token in database
 *
 * @param userId - User ID
 * @param tokenHash - Hashed refresh token
 * @param expiresAt - Expiration timestamp
 * @param env - Environment bindings
 * @returns Refresh token ID
 */
export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: number,
  env: Env
): Promise<string> {
  const db = initDb(env);
  const tokenId = generateId();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(schema.refreshTokens).values({
    id: tokenId,
    userId: userId,
    tokenHash: tokenHash,
    expiresAt: expiresAt,
    createdAt: now,
    revokedAt: null,
  });

  return tokenId;
}

/**
 * Verify a refresh token and return the user ID
 *
 * @param token - Refresh token
 * @param env - Environment bindings
 * @returns User ID if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyRefreshToken(
  token: string,
  env: Env
): Promise<string> {
  const db = initDb(env);
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select({
      userId: schema.refreshTokens.userId,
      expiresAt: schema.refreshTokens.expiresAt,
      revokedAt: schema.refreshTokens.revokedAt,
    })
    .from(schema.refreshTokens)
    .where(
      and(
        eq(schema.refreshTokens.tokenHash, tokenHash),
        gt(schema.refreshTokens.expiresAt, now),
        isNull(schema.refreshTokens.revokedAt)
      )
    )
    .get();

  if (!result) {
    throw new Error("Invalid or expired refresh token");
  }

  return result.userId;
}

/**
 * Revoke a refresh token
 *
 * @param token - Refresh token to revoke
 * @param env - Environment bindings
 */
export async function revokeRefreshToken(
  token: string,
  env: Env
): Promise<void> {
  const db = initDb(env);
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: now })
    .where(eq(schema.refreshTokens.tokenHash, tokenHash));
}

/**
 * Revoke all refresh tokens for a user (sign out all devices)
 *
 * @param userId - User ID
 * @param env - Environment bindings
 */
export async function revokeAllRefreshTokens(
  userId: string,
  env: Env
): Promise<void> {
  const db = initDb(env);
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(schema.refreshTokens.userId, userId),
        isNull(schema.refreshTokens.revokedAt)
      )
    );
}
