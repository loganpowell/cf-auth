/**
 * Core TypeScript types for the authentication service
 */

// Environment bindings for Cloudflare Workers
export interface Env {
  // D1 Database
  AUTH_DB: D1Database;
  
  // KV Namespaces
  AUTH_RATE_LIMIT: KVNamespace;
  AUTH_TOKEN_BLACKLIST: KVNamespace;
  AUTH_CACHE: KVNamespace;
  
  // Secrets
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  
  // OAuth Secrets
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  
  // Email Configuration
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
  
  // App URLs
  APP_URL: string;
  API_URL: string;
  
  // Feature Flags
  ENABLE_CUSTOM_DOMAINS?: string;
  ENABLE_ANALYTICS?: string;
  ENABLE_AUDIT_LOGGING?: string;
}

// User types
export interface User {
  id: string;
  email: string;
  password_hash?: string;
  display_name: string;
  avatar_url?: string;
  email_verified: boolean;
  created_at: number;
  updated_at: number;
  last_login_at?: number;
  status: 'active' | 'suspended' | 'deleted';
  mfa_enabled: boolean;
  mfa_secret?: string;
  mfa_backup_codes?: string;
  mfa_method?: 'totp' | 'sms' | 'webauthn';
}

// Permission bitmap
export interface PermissionBitmap {
  low: bigint;  // Permissions 0-63
  high: bigint; // Permissions 64-127
}

// JWT payload
export interface AccessTokenPayload {
  // Standard claims
  sub: string;
  email: string;
  email_verified: boolean;
  iat: number;
  exp: number;
  jti: string;
  
  // User info
  display_name: string;
  avatar_url?: string;
  
  // Permissions
  permissions: {
    organizations: Array<{
      id: string;
      slug: string;
      perms: {
        low: string;
        high: string;
      };
      is_owner: boolean;
    }>;
    resources?: Array<{
      type: 'team' | 'repository' | 'project';
      id: string;
      slug: string;
      perms: {
        low: string;
        high: string;
      };
    }>;
  };
  
  grants?: string[];
}

// API Request/Response types
export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    email_verified: boolean;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

// Domain configuration for multi-domain support
export interface DomainConfig {
  domain: string;
  organizationId?: string;
  teamId?: string;
  customBranding?: {
    logoUrl: string;
    primaryColor: string;
    companyName: string;
  };
  corsOrigins: string[];
  emailFrom?: string;
}
