/**
 * Internal Backend Types
 *
 * Types used internally by the backend that are NOT part of the OpenAPI contract.
 * These include JWT payloads and Cloudflare Worker bindings.
 *
 * For database types: Use Drizzle-inferred types from src/db/schema.ts
 * For API types: Use Zod schemas in src/schemas/auth.schema.ts (backend)
 * For frontend types: Use generated SDK types from demo-app/src/lib/api-client.d.ts
 */

// ============================================================================
// JWT Token Payloads (Internal - Not exposed in API)
// ============================================================================

export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  email_verified: boolean;
  iat: number;
  exp: number;
  jti: string;
  display_name: string;
  avatar_url?: string;
  permissions?: {
    organizations: Array<{
      id: string;
      role: string;
      permissions: string[];
    }>;
    resources: Array<{
      id: string;
      type: string;
      permissions: string[];
    }>;
  };
}

export interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string;
  iat: number;
  exp: number;
}

// ============================================================================
// Cloudflare Worker Environment Bindings
// ============================================================================

/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  RATE_LIMITER: KVNamespace;
  TOKEN_BLACKLIST: KVNamespace;
  SESSION_CACHE: KVNamespace;

  // Secrets
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRATION?: string; // seconds, defaults to 900 (15 minutes)
  JWT_REFRESH_EXPIRATION?: string; // seconds, defaults to 604800 (7 days)

  // Email (AWS SES)
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  EMAIL_FROM: string;
  FROM_NAME: string;

  // App URLs
  APP_URL: string;
  API_URL: string;

  // Environment
  ENVIRONMENT?: "development" | "production";

  // OAuth (Phase 6)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
}
