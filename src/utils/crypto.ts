/**
 * Cryptography utilities for password hashing and verification
 *
 * Using bcrypt for password hashing as it's well-supported in Cloudflare Workers.
 * Note: For production, consider using argon2 via WASM for better security.
 */

/**
 * Hash a password using bcrypt
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  // For Cloudflare Workers, we'll use the Web Crypto API with PBKDF2
  // This is a secure alternative until we can integrate bcrypt/argon2 WASM

  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Import the password as a key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Derive a key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // OWASP recommendation
      hash: "SHA-256",
    },
    keyMaterial,
    256 // 32 bytes
  );

  // Combine salt and hash for storage
  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt, 0);
  combined.set(hashArray, salt.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a hash
 *
 * @param password - Plain text password to verify
 * @param hash - Stored password hash
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    // Decode the stored hash
    const combined = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));

    // Extract salt and hash
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);

    // Hash the provided password with the same salt
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

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

    const newHash = new Uint8Array(derivedBits);

    // Compare the hashes in constant time
    return constantTimeCompare(storedHash, newHash);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

/**
 * Constant-time comparison to prevent timing attacks
 *
 * @param a - First array
 * @param b - Second array
 * @returns True if arrays are equal, false otherwise
 */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }

  return result === 0;
}

/**
 * Generate a secure random token (for email verification, password reset, etc.)
 *
 * @param byteLength - Length of the token in bytes (default: 32)
 * @returns URL-safe base64 encoded token
 */
export function generateSecureToken(byteLength: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  // Convert to URL-safe base64
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Hash a token for secure storage (e.g., refresh tokens, verification tokens)
 *
 * @param token - Token to hash
 * @returns Hashed token
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}

/**
 * Generate a unique ID (UUID v4)
 *
 * @returns UUID string
 */
export function generateId(): string {
  return crypto.randomUUID();
}
