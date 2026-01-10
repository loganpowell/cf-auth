/**
 * API Key Management & Validation
 *
 * Provides utilities for:
 * - Generating secure API keys (public/secret/restricted)
 * - Validating API keys against the database
 * - Rotating and revoking keys
 * - Permission scoping per key
 */

import { createHash, randomBytes } from "crypto";
import { Database } from "better-sqlite3";
import { APIKey } from "../db/schema";

export type APIKeyType = "public" | "secret" | "restricted";
export type APIKeyEnvironment = "test" | "live";

/**
 * API Key format:
 * - Prefix: pk_{env}_ (public) | sk_{env}_ (secret) | rk_{env}_ (restricted)
 * - Environment: test | live
 * - Suffix: 32 random alphanumeric characters
 *
 * Examples:
 * - pk_live_abc123def456...
 * - sk_test_xyz789uvw012...
 * - rk_live_...
 */

export interface APIKeyGenOptions {
  tenantId: string;
  name: string;
  type: APIKeyType;
  environment: APIKeyEnvironment;
  permissions?: string[]; // Scopes like "read:users", "write:projects"
}

export interface APIKeyValidationResult {
  valid: boolean;
  apiKey?: APIKey;
  tenantId?: string;
  error?: string;
}

/**
 * Generate a new API key
 *
 * @returns Object with the public key and secret (secret only shown once!)
 */
export function generateAPIKey(options: APIKeyGenOptions): {
  keyId: string;
  keyPrefix: string; // pk_live_abc123...
  keySecret?: string; // Only shown once! Store separately
} {
  // Generate random suffix (32 chars, base62-like encoding)
  const randomSuffix = randomBytes(24)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32);

  // Build key prefix
  const typePrefix = {
    public: "pk",
    secret: "sk",
    restricted: "rk",
  }[options.type];

  const env = options.environment === "test" ? "test" : "live";
  const keyPrefix = `${typePrefix}_${env}_${randomSuffix}`;

  // For secret keys, also generate a secret component
  let keySecret: string | undefined;
  if (options.type === "secret") {
    keySecret = randomBytes(32).toString("hex");
  }

  return {
    keyId: `key:${randomBytes(8).toString("hex")}`,
    keyPrefix,
    keySecret,
  };
}

/**
 * Hash an API key for storage (one-way, like password hashing)
 * The original key is never stored, only the hash
 */
export function hashAPIKey(keyPrefix: string, keySecret?: string): string {
  const data = keySecret ? `${keyPrefix}:${keySecret}` : keyPrefix;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Save API key to database
 */
export function saveAPIKey(
  db: Database,
  options: APIKeyGenOptions,
  generated: ReturnType<typeof generateAPIKey>
): APIKey {
  const now = Math.floor(Date.now() / 1000);
  const keyHash = hashAPIKey(generated.keyPrefix, generated.keySecret);

  const stmt = db.prepare(
    `
    INSERT INTO api_keys (
      id, tenant_id, key_prefix, key_hash, name,
      type, environment, permissions, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );

  stmt.run(
    generated.keyId,
    options.tenantId,
    generated.keyPrefix,
    keyHash,
    options.name,
    options.type,
    options.environment,
    options.permissions ? JSON.stringify(options.permissions) : null,
    now
  );

  return db
    .prepare("SELECT * FROM api_keys WHERE id = ?")
    .get(generated.keyId) as APIKey;
}

/**
 * Validate an API key prefix against the database
 *
 * For secret keys, also requires the secret component for validation
 */
export function validateAPIKey(
  db: Database,
  keyPrefix: string,
  keySecret?: string
): APIKeyValidationResult {
  // Find the API key by prefix
  const apiKey = db
    .prepare(
      `
    SELECT * FROM api_keys
    WHERE key_prefix = ? AND revoked_at IS NULL
    LIMIT 1
  `
    )
    .get(keyPrefix) as any | undefined;

  if (!apiKey) {
    return {
      valid: false,
      error: "Invalid or revoked API key",
    };
  }

  // For secret keys, verify the secret
  if (apiKey.type === "secret" && keySecret) {
    const expectedHash = hashAPIKey(keyPrefix, keySecret);
    if (apiKey.key_hash !== expectedHash) {
      return {
        valid: false,
        error: "Invalid API key secret",
      };
    }
  }

  // Update last_used_at
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
    Math.floor(Date.now() / 1000),
    apiKey.id
  );

  return {
    valid: true,
    apiKey: apiKey as APIKey,
    tenantId: apiKey.tenant_id,
  };
}

/**
 * Check if API key has a specific permission
 */
export function hasPermission(apiKey: APIKey, permission: string): boolean {
  if (!apiKey.permissions) {
    return true; // No restrictions
  }

  const permissions: string[] = JSON.parse(apiKey.permissions);

  // Check exact match or wildcard
  return permissions.some(
    (p) => p === permission || p === "*" || p === `${permission.split(":")[0]}:*`
  );
}

/**
 * Revoke an API key (soft delete)
 */
export function revokeAPIKey(db: Database, apiKeyId: string): void {
  db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(
    Math.floor(Date.now() / 1000),
    apiKeyId
  );
}

/**
 * Rotate an API key (generate new, revoke old)
 */
export function rotateAPIKey(
  db: Database,
  oldApiKeyId: string,
  options: Omit<APIKeyGenOptions, "tenantId">
): {
  keyId: string;
  keyPrefix: string;
  keySecret?: string;
} {
  // Get the old key to find tenant
  const oldKey = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(
    oldApiKeyId
  ) as any;

  if (!oldKey) {
    throw new Error(`API key not found: ${oldApiKeyId}`);
  }

  // Generate new key
  const newGenerated = generateAPIKey({
    ...options,
    tenantId: oldKey.tenant_id,
  });

  // Save new key
  saveAPIKey(
    db,
    {
      ...options,
      tenantId: oldKey.tenant_id,
    },
    newGenerated
  );

  // Revoke old key
  revokeAPIKey(db, oldApiKeyId);

  return newGenerated;
}

/**
 * Extract API key credentials from request
 *
 * Supports:
 * - Bearer {keyPrefix} (public keys)
 * - Bearer {keyPrefix}:{keySecret} (secret keys)
 * - X-API-Key header
 * - api_key query parameter
 */
export function extractAPIKeyFromRequest(request: Request): {
  keyPrefix: string;
  keySecret?: string;
} | null {
  // Strategy 1: Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // Check if it's a secret key (has a colon separator)
    const [keyPrefix, keySecret] = token.split(":");
    return {
      keyPrefix,
      keySecret: keySecret ? keySecret : undefined,
    };
  }

  // Strategy 2: X-API-Key header
  const apiKeyHeader = request.headers.get("X-API-Key");
  if (apiKeyHeader) {
    const [keyPrefix, keySecret] = apiKeyHeader.split(":");
    return {
      keyPrefix,
      keySecret: keySecret ? keySecret : undefined,
    };
  }

  // Strategy 3: Query parameter (less secure, for webhooks)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get("api_key");
  if (apiKeyParam) {
    const [keyPrefix, keySecret] = apiKeyParam.split(":");
    return {
      keyPrefix,
      keySecret: keySecret ? keySecret : undefined,
    };
  }

  return null;
}

/**
 * Middleware: Validate API key from request
 * Attaches validated key and tenant to request context
 */
export function apiKeyAuthMiddleware(db: Database) {
  return async (c: any, next: any) => {
    const credentials = extractAPIKeyFromRequest(c.req.raw);

    if (credentials) {
      const validation = validateAPIKey(
        db,
        credentials.keyPrefix,
        credentials.keySecret
      );

      if (validation.valid) {
        c.apiKey = validation.apiKey;
        c.tenantId = validation.tenantId;
      } else {
        return c.json(
          {
            error: "INVALID_API_KEY",
            message: validation.error,
          },
          { status: 401 }
        );
      }
    }

    await next();
  };
}

/**
 * Helper: List all API keys for a tenant (excluding secrets)
 */
export function listTenantAPIKeys(db: Database, tenantId: string): APIKey[] {
  return db
    .prepare(
      `
    SELECT * FROM api_keys
    WHERE tenant_id = ?
    ORDER BY created_at DESC
  `
    )
    .all(tenantId) as APIKey[];
}

/**
 * Helper: Check if API key is still active
 */
export function isAPIKeyActive(apiKey: APIKey): boolean {
  return !apiKey.revokedAt;
}

/**
 * Helper: Get API key environment (test vs live)
 */
export function getAPIKeyEnvironment(keyPrefix: string): APIKeyEnvironment {
  const match = keyPrefix.match(/_([a-z]+)_/);
  return (match?.[1] as APIKeyEnvironment) || "test";
}

/**
 * Helper: Get API key type from prefix
 */
export function getAPIKeyType(keyPrefix: string): APIKeyType {
  if (keyPrefix.startsWith("pk_")) return "public";
  if (keyPrefix.startsWith("sk_")) return "secret";
  if (keyPrefix.startsWith("rk_")) return "restricted";
  throw new Error(`Unknown API key type: ${keyPrefix}`);
}
