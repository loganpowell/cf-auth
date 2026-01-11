/**
 * Authentication utilities for end-user authentication
 *
 * Provides:
 * - Password hashing and verification
 * - JWT token generation and validation
 * - Session management
 */

import { SignJWT, jwtVerify } from "jose";

/**
 * Hash a password using Cloudflare Workers Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Use PBKDF2 with 100,000 iterations (OWASP recommendation)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  // Combine salt + hash for storage
  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Decode the stored hash
  const combined = Uint8Array.from(atob(hashedPassword), (c) =>
    c.charCodeAt(0)
  );
  const salt = combined.slice(0, 16);
  const storedHash = combined.slice(16);

  // Derive the key with the same parameters
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(derivedBits);

  // Compare the hashes
  if (hashArray.length !== storedHash.length) return false;

  let match = true;
  for (let i = 0; i < hashArray.length; i++) {
    if (hashArray[i] !== storedHash[i]) match = false;
  }

  return match;
}

/**
 * Generate a JWT token for a user session
 */
export async function generateToken(
  userId: string,
  tenantId: string,
  secret: string,
  expiresIn: string = "7d"
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const jwt = await new SignJWT({
    userId,
    tenantId,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<{ userId: string; tenantId: string; type: string } | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const { payload } = await jwtVerify(token, secretKey);

    if (
      payload &&
      typeof payload.userId === "string" &&
      typeof payload.tenantId === "string" &&
      typeof payload.type === "string"
    ) {
      return {
        userId: payload.userId,
        tenantId: payload.tenantId,
        type: payload.type,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate a random verification code for email verification
 */
export function generateVerificationCode(): string {
  const array = new Uint8Array(3);
  crypto.getRandomValues(array);
  const num =
    ((array[0] || 0) << 16) | ((array[1] || 0) << 8) | (array[2] || 0);
  return (num % 1000000).toString().padStart(6, "0");
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: at least 8 characters, 1 uppercase, 1 lowercase, 1 number
 */
export function isStrongPassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }

  return { valid: true };
}
