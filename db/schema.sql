-- Auth Service Database Schema
-- SQLite (Cloudflare D1)

-- Users table: Core user account information
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- UUID v4
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT, -- NULL for OAuth-only accounts
    email_verified INTEGER DEFAULT 0 NOT NULL, -- 0 = false, 1 = true
    created_at INTEGER NOT NULL, -- Unix timestamp (milliseconds)
    updated_at INTEGER NOT NULL, -- Unix timestamp (milliseconds)
    last_login_at INTEGER, -- Unix timestamp (milliseconds)
    is_active INTEGER DEFAULT 1 NOT NULL -- 0 = disabled, 1 = active
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Organizations table: Top-level organizational units
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, -- UUID v4
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
    owner_user_id TEXT NOT NULL, -- Organization owner
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

-- Teams table: Subgroups within organizations
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, -- UUID v4
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL, -- Unique within organization
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(organization_id, slug);

-- User-Organization relationships with permission bitmaps
CREATE TABLE IF NOT EXISTS user_organizations (
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    permissions_global INTEGER NOT NULL DEFAULT 0, -- Global permission bitmap
    permissions_org INTEGER NOT NULL DEFAULT 0, -- Organization permission bitmap
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, organization_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);

-- User-Team relationships with permission bitmaps
CREATE TABLE IF NOT EXISTS user_teams (
    user_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    permissions_team INTEGER NOT NULL DEFAULT 0, -- Team permission bitmap
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, team_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_teams_user ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team ON user_teams(team_id);

-- OAuth Providers: Third-party authentication
CREATE TABLE IF NOT EXISTS oauth_providers (
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'github', 'google', etc.
    provider_user_id TEXT NOT NULL, -- ID from the OAuth provider
    provider_username TEXT, -- Username/handle from provider
    provider_email TEXT, -- Email from provider
    access_token TEXT, -- Encrypted token (if stored)
    refresh_token TEXT, -- Encrypted refresh token (if stored)
    expires_at INTEGER, -- Token expiration (Unix timestamp)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_provider_user ON oauth_providers(provider, provider_user_id);

-- Email Verification Tokens: For email verification
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the verification token
    expires_at INTEGER NOT NULL, -- Unix timestamp
    created_at INTEGER NOT NULL,
    used_at INTEGER, -- NULL if not used yet
    PRIMARY KEY (user_id, token_hash),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);

-- Email Verification Tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY, -- UUID v4
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL, -- Email being verified
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY, -- UUID v4
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER, -- NULL if not used yet
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- Domain Configurations: Multi-domain support for custom branding
CREATE TABLE IF NOT EXISTS domain_configs (
    id TEXT PRIMARY KEY, -- UUID v4
    organization_id TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE, -- e.g., 'auth.company.com'
    logo_url TEXT, -- Custom logo URL
    primary_color TEXT, -- Hex color code
    company_name TEXT,
    from_email TEXT, -- Email sender address
    from_name TEXT, -- Email sender name
    cors_origins TEXT, -- JSON array of allowed origins
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domain_configs_domain ON domain_configs(domain);
CREATE INDEX IF NOT EXISTS idx_domain_configs_org ON domain_configs(organization_id);

-- Two-Factor Authentication (2FA) - Extensible for future implementation
-- Schema designed to support TOTP, SMS, and WebAuthn
CREATE TABLE IF NOT EXISTS two_factor_auth (
    id TEXT PRIMARY KEY, -- UUID v4
    user_id TEXT NOT NULL,
    method TEXT NOT NULL, -- 'totp', 'sms', 'webauthn'
    secret TEXT, -- Encrypted TOTP secret or phone number
    backup_codes TEXT, -- Encrypted JSON array of backup codes
    is_enabled INTEGER DEFAULT 0 NOT NULL,
    verified_at INTEGER, -- When 2FA was first verified
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_2fa_user ON two_factor_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_2fa_method ON two_factor_auth(user_id, method);

-- Audit Log: Track important security events
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, -- UUID v4
    user_id TEXT, -- NULL for anonymous events
    action TEXT NOT NULL, -- 'login', 'logout', 'register', 'password_reset', etc.
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- JSON with additional context
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
