# Authentication Service on Cloudflare - Project Plan

**Project**: Secure Authentication Service  
**Infrastructure**: Cloudflare (Workers, D1, KV, Email)  
**IaC Tool**: Pulumi with TypeScript  
**Last Updated**: December 9, 2025

---

## Overview

Building a production-ready authentication service leveraging Cloudflare's edge infrastructure. The service will handle user registration, login, token management, and email notifications for key authentication events.

**Development Approach**: Each backend feature is immediately integrated with a **Qwik v2 demonstration application** for visual testing, validation, and developer experience feedback. This ensures the API is practical and user-friendly from day one.

### Quick Links

- **Demo Application**: `/demo-app` - Qwik v2 application (replaces old HTML/JS prototype)
  - [Qwik v2 Documentation](https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/)
  - Integrated testing and development
- **Documentation**:
  - [Permission Model](./PERMISSION_MODEL.md) - Detailed permission system design
  - [Project Summary](./PROJECT_SUMMARY.md) - Current status and progress
  - [Qwik Instructions](./.github/instructions/qwik%20v2%20docs.instructions.md) - Framework guidelines

**Deprecated**: `/example-app` (old HTML/JS prototype) - will be removed in Phase 1

---

## Architecture

### Core Components

1. **Cloudflare Workers** - Serverless functions at the edge
2. **Cloudflare D1** - SQLite database for persistent user data
3. **Cloudflare KV** - Key-value store for rate limiting, caching, and token blacklists
4. **Cloudflare Email Workers** - Transactional email delivery
5. **Pulumi** - Infrastructure as Code for deployment and management

### Authentication Strategy

- **Primary**: JWT-based authentication with access + refresh tokens
- **Access Token**: Short-lived (15 minutes), stored in memory/localStorage
  - Contains: user ID, email, permissions bitmap, role hierarchy, organization memberships
- **Refresh Token**: Long-lived (7 days), stored in httpOnly cookie
- **Password Hashing**: bcrypt or argon2 via WASM
- **SSO Providers**: Google, Twitter (X), GitHub OAuth 2.0 integration
- **Account Linking**: Support linking multiple SSO providers to one account
- **Authorization**: Flexible Permission Superset Model
  - Organization owners are "masters of keys" with full permission superset
  - Delegated roles receive configurable permission subsets
  - Hierarchical delegation: users can only grant permissions they themselves possess
  - Granular, composable permission system with bitwise operations

### Multi-Domain Support

**Custom Domain Configuration**: Support for multiple domains to enable tenant isolation or branded experiences

**Use Cases**:

- **Per-Organization Domains**: `auth.company1.com`, `auth.company2.com`
- **Per-Team Subdomains**: `team1.auth.yourdomain.com`, `team2.auth.yourdomain.com`
- **White-Label Solutions**: Custom domains for different clients

**Implementation**:

```typescript
// Domain configuration in environment/KV
interface DomainConfig {
  domain: string;
  organizationId?: string; // Optional org binding
  teamId?: string; // Optional team binding
  customBranding?: {
    logoUrl: string;
    primaryColor: string;
    companyName: string;
  };
  corsOrigins: string[]; // Allowed frontend origins
  emailFrom?: string; // Custom email sender
}

// Middleware to resolve domain configuration
async function resolveDomainConfig(
  request: Request,
  env: Env
): Promise<DomainConfig> {
  const hostname = new URL(request.url).hostname;

  // Check KV cache first
  const cached = await env.AUTH_CACHE.get(`domain:${hostname}`);
  if (cached) return JSON.parse(cached);

  // Query database for custom domain
  const config = await db.query(
    "SELECT * FROM domain_configs WHERE domain = ?",
    [hostname]
  );

  // Default to base configuration
  return config || getDefaultDomainConfig();
}
```

**Database Schema** (add to schema.sql):

```sql
CREATE TABLE domain_configs (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  organization_id TEXT,
  team_id TEXT,
  custom_branding TEXT,        -- JSON: logo, colors, etc.
  cors_origins TEXT NOT NULL,  -- JSON array
  email_from TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);
```

---

## Project Structure

```
/auth
├── /infrastructure          # Pulumi IaC code
│   ├── index.ts            # Main Pulumi program
│   ├── workers.ts          # Worker resources
│   ├── database.ts         # D1 database setup
│   ├── kv.ts               # KV namespace setup
│   ├── email.ts            # Email routing configuration
│   ├── domains.ts          # Multi-domain routing setup
│   └── secrets.ts          # Secret management
├── /src                    # Worker application code
│   ├── /handlers           # Route handlers
│   │   ├── register.ts
│   │   ├── login.ts
│   │   ├── refresh.ts
│   │   ├── logout.ts
│   │   ├── verify-email.ts
│   │   ├── password-reset.ts
│   │   ├── me.ts
│   │   └── /sso            # SSO handlers
│   │       ├── google.ts
│   │       ├── twitter.ts
│   │       ├── github.ts
│   │       └── callback.ts
│   ├── /middleware         # Middleware functions
│   │   ├── auth.ts
│   │   ├── authorize.ts     # Permission checking
│   │   ├── rateLimit.ts
│   │   ├── cors.ts
│   │   └── domain.ts        # Multi-domain routing
│   ├── /services           # Business logic
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── token.service.ts
│   │   ├── email.service.ts
│   │   ├── oauth.service.ts
│   │   ├── permission.service.ts
│   │   └── organization.service.ts
│   ├── /utils              # Utilities
│   │   ├── jwt.ts
│   │   ├── crypto.ts
│   │   └── validation.ts
│   ├── /db                 # Database access
│   │   ├── queries.ts
│   │   └── migrations.ts
│   ├── /templates          # Email templates
│   │   ├── /mjml           # MJML source files
│   │   │   ├── welcome.mjml
│   │   │   ├── verify-email.mjml
│   │   │   ├── password-reset.mjml
│   │   │   ├── password-changed.mjml
│   │   │   └── ...
│   │   └── /compiled       # Compiled HTML + text (generated)
│   │       ├── welcome.ts
│   │       ├── verify-email.ts
│   │       └── ...
│   ├── index.ts            # Main worker entry point
│   └── types.ts            # TypeScript types
├── /demo-app               # Qwik v2 demonstration application
│   ├── /src
│   │   ├── /routes         # Qwik routes
│   │   │   ├── index.tsx   # Home/login page
│   │   │   ├── register/
│   │   │   │   └── index.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── organizations/
│   │   │   │   ├── teams/
│   │   │   │   └── permissions/
│   │   │   ├── settings/
│   │   │   │   └── index.tsx
│   │   │   └── verify-email/
│   │   │       └── index.tsx
│   │   ├── /components     # Reusable components
│   │   │   ├── auth/
│   │   │   │   ├── login-form.tsx
│   │   │   │   ├── register-form.tsx
│   │   │   │   └── sso-buttons.tsx
│   │   │   ├── permissions/
│   │   │   │   ├── permission-tree.tsx
│   │   │   │   ├── role-selector.tsx
│   │   │   │   └── permission-badge.tsx
│   │   │   └── layout/
│   │   │       ├── header.tsx
│   │   │       └── sidebar.tsx
│   │   ├── /lib            # Client utilities
│   │   │   ├── api.ts      # API client wrapper
│   │   │   ├── auth.ts     # Auth context/helpers
│   │   │   └── types.ts    # Shared types
│   │   └── /styles         # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── /db                     # Database schemas
│   └── schema.sql
├── /tests                  # Test files
│   ├── /unit
│   └── /integration
├── /scripts                # Build and utility scripts
│   └── compile-emails.ts   # MJML compilation script
├── package.json
├── tsconfig.json
├── wrangler.toml           # Cloudflare config
├── Pulumi.yaml
└── README.md
```

---

## API Endpoints

**Base URL**: `https://api.yourdomain.com/v1` (versioned from v1)

### Authentication Endpoints

| Method | Endpoint                       | Description                     | Email Trigger                    |
| ------ | ------------------------------ | ------------------------------- | -------------------------------- |
| `POST` | `/v1/auth/register`            | Create new user account         | ✅ Welcome + Email Verification  |
| `POST` | `/v1/auth/login`               | Login with credentials          | ⚠️ Suspicious login detection    |
| `POST` | `/v1/auth/refresh`             | Refresh access token            | -                                |
| `POST` | `/v1/auth/logout`              | Invalidate tokens               | -                                |
| `GET`  | `/v1/auth/me`                  | Get current user info           | -                                |
| `POST` | `/v1/auth/verify-email`        | Verify email address            | ✅ Email verified confirmation   |
| `POST` | `/v1/auth/resend-verification` | Resend verification email       | ✅ Email Verification            |
| `POST` | `/v1/auth/forgot-password`     | Request password reset          | ✅ Password Reset Link           |
| `POST` | `/v1/auth/reset-password`      | Reset password with token       | ✅ Password Changed Confirmation |
| `POST` | `/v1/auth/change-password`     | Change password (authenticated) | ✅ Password Changed Notification |

### SSO Endpoints

| Method   | Endpoint                    | Description                          | Email Trigger          |
| -------- | --------------------------- | ------------------------------------ | ---------------------- |
| `GET`    | `/v1/auth/sso/google`       | Initiate Google OAuth flow           | -                      |
| `GET`    | `/v1/auth/sso/twitter`      | Initiate Twitter OAuth flow          | -                      |
| `GET`    | `/v1/auth/sso/github`       | Initiate GitHub OAuth flow           | -                      |
| `GET`    | `/v1/auth/sso/callback`     | OAuth callback handler               | ✅ Welcome (new users) |
| `POST`   | `/v1/auth/link/google`      | Link Google account (authenticated)  | ✅ Account Linked      |
| `POST`   | `/v1/auth/link/twitter`     | Link Twitter account (authenticated) | ✅ Account Linked      |
| `POST`   | `/v1/auth/link/github`      | Link GitHub account (authenticated)  | ✅ Account Linked      |
| `DELETE` | `/v1/auth/unlink/:provider` | Unlink SSO provider (authenticated)  | ✅ Account Unlinked    |

### Organization & Access Control Endpoints

| Method   | Endpoint                                         | Description                | Email Trigger                |
| -------- | ------------------------------------------------ | -------------------------- | ---------------------------- |
| `POST`   | `/v1/orgs`                                       | Create organization        | ✅ Organization Created      |
| `GET`    | `/v1/orgs`                                       | List user's organizations  | -                            |
| `GET`    | `/v1/orgs/:orgId`                                | Get organization details   | -                            |
| `PATCH`  | `/v1/orgs/:orgId`                                | Update organization        | -                            |
| `DELETE` | `/v1/orgs/:orgId`                                | Delete organization        | ✅ Organization Deleted      |
| `GET`    | `/v1/orgs/:orgId/members`                        | List organization members  | -                            |
| `POST`   | `/v1/orgs/:orgId/members`                        | Invite member to org       | ✅ Organization Invitation   |
| `PATCH`  | `/v1/orgs/:orgId/members/:userId`                | Update member role         | ✅ Role Changed              |
| `DELETE` | `/v1/orgs/:orgId/members/:userId`                | Remove member from org     | ✅ Removed from Organization |
| `GET`    | `/v1/orgs/:orgId/teams`                          | List teams in organization | -                            |
| `POST`   | `/v1/orgs/:orgId/teams`                          | Create team                | -                            |
| `GET`    | `/v1/teams/:teamId`                              | Get team details           | -                            |
| `PATCH`  | `/v1/teams/:teamId`                              | Update team                | -                            |
| `DELETE` | `/v1/teams/:teamId`                              | Delete team                | -                            |
| `GET`    | `/v1/teams/:teamId/members`                      | List team members          | -                            |
| `POST`   | `/v1/teams/:teamId/members`                      | Add member to team         | ✅ Added to Team             |
| `DELETE` | `/v1/teams/:teamId/members/:userId`              | Remove member from team    | ✅ Removed from Team         |
| `GET`    | `/v1/teams/:teamId/repositories`                 | List team repositories     | -                            |
| `POST`   | `/v1/repositories`                               | Create repository          | -                            |
| `GET`    | `/v1/repositories/:repoId`                       | Get repository details     | -                            |
| `GET`    | `/v1/repositories/:repoId/collaborators`         | List collaborators         | -                            |
| `PUT`    | `/v1/repositories/:repoId/collaborators/:userId` | Add collaborator           | ✅ Added as Collaborator     |
| `DELETE` | `/v1/repositories/:repoId/collaborators/:userId` | Remove collaborator        | ✅ Removed as Collaborator   |

---

## Database Schema (D1)

### Tables

#### `users`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  status TEXT DEFAULT 'active', -- active, suspended, deleted
  -- 2FA fields (for future extensibility)
  mfa_enabled BOOLEAN DEFAULT 0,
  mfa_secret TEXT,              -- Encrypted TOTP secret
  mfa_backup_codes TEXT,        -- Encrypted JSON array of backup codes
  mfa_method TEXT               -- 'totp', 'sms', 'webauthn', NULL
);
```

#### `organizations`

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  billing_email TEXT,
  default_repository_permission TEXT DEFAULT 'read', -- none, read, write, admin
  members_can_create_repositories BOOLEAN DEFAULT 1,
  members_can_create_teams BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### `organization_members`

```sql
CREATE TABLE organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_owner BOOLEAN DEFAULT 0,  -- Owner flag (master of keys)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(organization_id, user_id)
);
```

**Note**: Roles are now defined through the `user_roles` table with permissions.

#### `teams`

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  privacy TEXT DEFAULT 'secret', -- secret, closed
  parent_team_id TEXT, -- For nested teams
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (parent_team_id) REFERENCES teams(id),
  UNIQUE(organization_id, slug)
);
```

#### `team_members`

```sql
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(team_id, user_id)
);
```

**Note**: Team member permissions are defined through `user_roles` and `user_permissions` tables.

#### `repositories`

```sql
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  owner_id TEXT NOT NULL, -- User ID if personal, org ID if org-owned
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'private', -- public, private, internal
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  UNIQUE(owner_id, slug)
);
```

**Note**: Repository collaborators and team repository access are now managed through `user_permissions` and `user_roles` tables with resource scoping.

#### `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `email_verification_tokens`

```sql
CREATE TABLE email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `oauth_accounts`

```sql
CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- google, twitter, github
  provider_user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  token_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(provider, provider_user_id)
);
```

#### `oauth_state`

```sql
CREATE TABLE oauth_state (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  action TEXT DEFAULT 'login', -- login or link
  user_id TEXT, -- For linking accounts
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

#### `audit_log`

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## KV Namespaces

### 1. `AUTH_RATE_LIMIT`

**Purpose**: Rate limiting for authentication endpoints

- Key: `ratelimit:{endpoint}:{ip}`
- Value: Request count
- TTL: 60-900 seconds (depending on endpoint)

### 2. `AUTH_TOKEN_BLACKLIST`

**Purpose**: Invalidated tokens (logout)

- Key: `blacklist:{token_jti}`
- Value: Timestamp
- TTL: Token expiration time

### 3. `AUTH_CACHE`

**Purpose**: General caching (user lookups, etc.)

- Key: Various cache keys
- Value: Cached data
- TTL: 300-3600 seconds

---

## Email Notifications

### Email Types & Templates

#### 1. **Welcome Email** (Post-Registration)

**Trigger**: User completes registration  
**Template**: `welcome.ts`  
**Content**:

- Welcome message
- Email verification link
- Getting started guide
- Support contact info

#### 2. **Email Verification**

**Trigger**: Registration or re-send verification  
**Template**: `verify-email.ts`  
**Content**:

- Verification link (token embedded)
- Link expiration time (24 hours)
- Alternative: verification code

#### 3. **Email Verified Confirmation**

**Trigger**: Successful email verification  
**Template**: `email-verified.ts`  
**Content**:

- Confirmation message
- Next steps
- Account overview link

#### 4. **Password Reset Request**

**Trigger**: Forgot password flow  
**Template**: `password-reset.ts`  
**Content**:

- Password reset link (token embedded)
- Link expiration time (1 hour)
- Security note (ignore if not requested)

#### 5. **Password Changed Notification**

**Trigger**: Successful password change/reset  
**Template**: `password-changed.ts`  
**Content**:

- Confirmation of password change
- Change timestamp
- Security warning (if not you, contact support)
- Account recovery link

#### 6. **Suspicious Login Alert** (Optional)

**Trigger**: Login from new device/location  
**Template**: `suspicious-login.ts`  
**Content**:

- Login details (location, device, time)
- Verification prompt
- Secure account action

#### 7. **Account Locked** (Optional)

**Trigger**: Multiple failed login attempts  
**Template**: `account-locked.ts`  
**Content**:

- Lock reason
- Unlock instructions
- Support contact

#### 8. **SSO Account Linked**

**Trigger**: User links a social account  
**Template**: `account-linked.ts`  
**Content**:

- Confirmation of linked provider
- Provider name and email
- Security notice
- Manage connections link

#### 9. **SSO Account Unlinked**

**Trigger**: User unlinks a social account  
**Template**: `account-unlinked.ts`  
**Content**:

- Confirmation of unlinked provider
- Remaining authentication methods
- Security notice

#### 10. **Organization Invitation**

**Trigger**: User invited to organization  
**Template**: `org-invitation.ts`  
**Content**:

- Organization name and inviter
- Role being granted
- Accept invitation link
- Invitation expiration (7 days)

#### 11. **Role Changed**

**Trigger**: User's organization/team role changed  
**Template**: `role-changed.ts`  
**Content**:

- Organization/team name
- Previous and new role
- Effective permissions summary

#### 12. **Added to Team**

**Trigger**: User added to team  
**Template**: `team-added.ts`  
**Content**:

- Team and organization name
- Team role
- Team repositories access

#### 13. **Removed from Team/Organization**

**Trigger**: User removed from team or organization  
**Template**: `access-removed.ts`  
**Content**:

- Team/organization name
- Removal reason (if provided)
- Impact on access

#### 14. **Added as Collaborator**

**Trigger**: User added as repository collaborator  
**Template**: `collaborator-added.ts`  
**Content**:

- Repository name
- Permission level granted
- Repository URL

### Email Service Configuration

**Provider**: Cloudflare Email Routing + Email Workers (Native Cloudflare Solution)

- **Email Routing**: Cloudflare Email Routing for domain verification and sending
- **Email Workers**: Send emails directly from Workers using `send_email` binding
- **Setup**: Requires Email Routing enabled on your domain
- **Advantages**:
  - Native Cloudflare integration (no external services)
  - No API keys needed
  - Built-in DMARC/SPF/DKIM support
  - Free tier: 100 emails/day
- **Template Engine**: MJML (compiles to responsive HTML)
  - MJML source files in `/src/templates/*.mjml`
  - Compile to HTML during build process
  - Generate plain text fallback automatically
  - Responsive design out of the box

**Email Settings**:

- From: `noreply@yourdomain.com` (must be verified in Email Routing)
- Reply-To: `support@yourdomain.com`
- Rate Limiting: Max 10 emails per user per hour
- Format: HTML (MJML-compiled) + plain text fallback
- Limits: 100 emails/day on free tier, upgrade for more

**MJML Build Process**:

```typescript
// Build script to compile MJML templates
import mjml2html from "mjml";
import { readFileSync, writeFileSync } from "fs";

const templates = ["welcome", "verify-email", "password-reset" /* ... */];

templates.forEach((template) => {
  const mjmlContent = readFileSync(`src/templates/${template}.mjml`, "utf8");
  const { html } = mjml2html(mjmlContent);
  const plainText = htmlToPlainText(html); // Custom converter

  writeFileSync(
    `src/templates/compiled/${template}.ts`,
    `
    export const html = \`${html}\`;
    export const text = \`${plainText}\`;
  `
  );
});
```

---

---

## Access Control & Permissions (Superset Model)

### Permission Superset Architecture

This system uses a **flexible permission superset model** where permissions are composable, delegatable, and hierarchical:

- **Organization Owner** = Master of Keys (holds full permission superset)
- **Delegated Users** = Receive configurable permission subsets
- **Delegation Rule**: Users can only grant permissions they themselves possess
- **Composability**: Permissions are granular and can be combined

### Permission Hierarchy Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION SUPERSET                               │
│                    (Organization Owner - Master of Keys)                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ALL PERMISSIONS (Bitwise: 0xFFFFFFFFFFFFFFFF)                       │  │
│  │                                                                     │  │
│  │ Organization Domain:                                                │  │
│  │  • org.read, org.write, org.delete                                  │  │
│  │  • org.members.read, org.members.write, org.members.delete          │  │
│  │  • org.billing.read, org.billing.write                              │  │
│  │  • org.settings.read, org.settings.write                            │  │
│  │                                                                     │  │
│  │ Resource Domain (Teams, Repos, etc.):                               │  │
│  │  • resource.create, resource.read, resource.update, resource.delete │  │
│  │  • resource.permissions.read, resource.permissions.write            │  │
│  │                                                                     │  │
│  │ Data Domain:                                                        │  │
│  │  • data.read, data.write, data.delete                               │  │
│  │  • data.export, data.import                                         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Can Delegate ↓                                                           │
│                                                                           │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐     │
│  │    PERMISSION SUBSET A       │    │    PERMISSION SUBSET B       │     │
│  │    (Administrator Role)      │    │    (Developer Role)          │     │
│  │  ┌────────────────────────┐  │    │  ┌────────────────────────┐  │     │
│  │  │ Delegated Permissions: │  │    │  │ Delegated Permissions: │  │     │
│  │  │  • org.read            │  │    │  │  • resource.read       │  │     │
│  │  │  • org.members.*       │  │    │  │  • resource.create     │  │     │
│  │  │  • org.settings.read   │  │    │  │  • data.read           │  │     │
│  │  │  • resource.*          │  │    │  │  • data.write          │  │     │
│  │  │  • data.read           │  │    │  │                        │  │     │
│  │  └────────────────────────┘  │    │  └────────────────────────┘  │     │
│  │                              │    │                              │     │
│  │  Can Delegate ↓              │    │  Can Delegate ↓              │     │
│  │                              │    │                              │     │
│  │  ┌───────────────────────┐   │    │  ┌───────────────────────┐   │     │
│  │  │ PERMISSION SUBSET A.1 │   │    │  │ PERMISSION SUBSET B.1 │   │     │
│  │  │ (Team Lead)           │   │    │  │ (Viewer)              │   │     │
│  │  │  • org.read           │   │    │  │  • resource.read      │   │     │
│  │  │  • resource.read      │   │    │  │  • data.read          │   │     │
│  │  │  • resource.update    │   │    │  │                       │   │     │
│  │  │  • data.read          │   │    │  │                       │   │     │
│  │  └───────────────────────┘   │    │  └───────────────────────┘   │     │
│  └──────────────────────────────┘    └──────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                      DELEGATION VALIDATION FLOW                           │
└───────────────────────────────────────────────────────────────────────────┘

User A wants to grant permissions to User B
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Get User A's permission set (P_A)      │
    └────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Get requested permissions for B (P_B)  │
    └────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Is P_B ⊆ P_A? (Is B subset of A?)      │──── NO ──→ DENY (Cannot grant
    └────────────────────────────────────────┘            permissions you
         │ YES                                             don't have)
         ▼
    ┌────────────────────────────────────────┐
    │ Grant P_B to User B                    │
    │ Record delegation in audit log         │
    └────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │ User B can now delegate any subset of  │
    │ P_B to other users                     │
    └────────────────────────────────────────┘

```

### Permission Domains

For detailed permission documentation, see [PERMISSION_MODEL.md](./PERMISSION_MODEL.md).

#### Quick Reference: 5 Core Domains

1. **Organization** (`org.*`) - Org settings, members, billing
2. **Resource** (`resource.*`) - Teams, repositories, projects
3. **Data** (`data.*`) - Data operations, export/import
4. **Collaboration** (`collab.*`) - Invites, roles, team management
5. **Admin** (`admin.*`) - Audit logs, billing

### Permission Storage & Representation

#### Database Schema

```sql
-- Permissions table (defines all available permissions)
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL, -- e.g., 'org.members.write'
  domain TEXT NOT NULL,       -- e.g., 'org', 'resource', 'data'
  description TEXT,
  bit_position INTEGER UNIQUE, -- For bitwise operations (0-127)
  created_at INTEGER NOT NULL
);

-- Role templates (pre-defined permission sets)
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT,       -- NULL for system roles
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT 0, -- System roles (owner, admin, etc.)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Permissions assigned to roles
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  granted_by TEXT,            -- User ID who granted this
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id),
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- User permissions (direct grants, not through roles)
CREATE TABLE user_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  resource_type TEXT,         -- 'team', 'repository', NULL for org-wide
  resource_id TEXT,           -- Specific resource ID
  granted_by TEXT NOT NULL,   -- User who granted this permission
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,         -- Optional expiration
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id),
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- User role assignments
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  resource_type TEXT,         -- NULL for org-wide, 'team', 'repository', etc.
  resource_id TEXT,           -- Specific resource ID if scoped
  granted_by TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- Permission delegation audit trail
CREATE TABLE permission_delegations (
  id TEXT PRIMARY KEY,
  grantor_id TEXT NOT NULL,    -- User granting permission
  grantee_id TEXT NOT NULL,    -- User receiving permission
  organization_id TEXT NOT NULL,
  permission_id TEXT,          -- NULL if granting a role
  role_id TEXT,                -- NULL if granting direct permission
  resource_type TEXT,
  resource_id TEXT,
  action TEXT NOT NULL,        -- 'grant' or 'revoke'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (grantor_id) REFERENCES users(id),
  FOREIGN KEY (grantee_id) REFERENCES users(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

#### Bitwise Permission Representation

For fast permission checking, we use bitwise operations:

```typescript
// Permission bitmap (can store up to 128 permissions using 2x 64-bit integers)
type PermissionBitmap = {
  low: bigint; // Permissions 0-63
  high: bigint; // Permissions 64-127
};

// Example permission bits
const PERMISSIONS = {
  // Organization permissions (0-31)
  ORG_READ: 1n << 0n,
  ORG_WRITE: 1n << 1n,
  ORG_DELETE: 1n << 2n,
  ORG_TRANSFER: 1n << 3n,
  ORG_MEMBERS_READ: 1n << 4n,
  ORG_MEMBERS_WRITE: 1n << 5n,
  ORG_MEMBERS_DELETE: 1n << 6n,
  ORG_BILLING_READ: 1n << 7n,
  ORG_BILLING_WRITE: 1n << 8n,
  ORG_SETTINGS_READ: 1n << 9n,
  ORG_SETTINGS_WRITE: 1n << 10n,

  // Resource permissions (32-63)
  RESOURCE_CREATE: 1n << 32n,
  RESOURCE_READ: 1n << 33n,
  RESOURCE_UPDATE: 1n << 34n,
  RESOURCE_DELETE: 1n << 35n,
  RESOURCE_PERMISSIONS_READ: 1n << 36n,
  RESOURCE_PERMISSIONS_WRITE: 1n << 37n,

  // Data permissions (64-95)
  DATA_READ: 1n << 64n,
  DATA_WRITE: 1n << 65n,
  DATA_DELETE: 1n << 66n,
  DATA_EXPORT: 1n << 67n,
  DATA_IMPORT: 1n << 68n,
};

// Check if user has permission
function hasPermission(userPerms: PermissionBitmap, required: bigint): boolean {
  if (required <= 1n << 63n) {
    return (userPerms.low & required) === required;
  } else {
    return (userPerms.high & (required >> 64n)) === required >> 64n;
  }
}

// Check if grantor can delegate to grantee
function canDelegate(
  grantorPerms: PermissionBitmap,
  granteePerms: PermissionBitmap
): boolean {
  // Grantee permissions must be a subset of grantor permissions
  const lowSubset = (granteePerms.low & grantorPerms.low) === granteePerms.low;
  const highSubset =
    (granteePerms.high & grantorPerms.high) === granteePerms.high;
  return lowSubset && highSubset;
}
```

### JWT Token Structure (Updated)

```typescript
interface AccessTokenPayload {
  // Standard JWT claims
  sub: string; // User ID
  email: string;
  email_verified: boolean;
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID (for blacklisting)

  // User info
  display_name: string;
  avatar_url?: string;

  // Permissions (compact representation)
  permissions: {
    // Organization-level permissions
    organizations: Array<{
      id: string;
      slug: string;
      perms: {
        low: string; // Hex string of bigint
        high: string; // Hex string of bigint
      };
      is_owner: boolean;
    }>;

    // Resource-specific permissions (if needed)
    resources?: Array<{
      type: "team" | "repository" | "project";
      id: string;
      slug: string;
      perms: {
        low: string;
        high: string;
      };
    }>;
  };

  // Human-readable permissions (for debugging/display)
  grants?: string[]; // e.g., ['org.read', 'resource.teams.create']
}
```

### Permission Implementation

For complete implementation details including:

- Permission service class
- Delegation validation logic
- Authorization middleware
- Permission scoping and inheritance
- Custom role creation
- Expiration handling

See [PERMISSION_MODEL.md](./PERMISSION_MODEL.md)

---

---

## SSO Integration

### Supported Providers

#### 1. **Google OAuth 2.0**

- **Provider**: Google Identity Platform
- **Scopes**: `openid`, `email`, `profile`
- **User Info**: Email, name, profile picture
- **Setup**: Google Cloud Console OAuth 2.0 credentials
- **Docs**: https://developers.google.com/identity/protocols/oauth2

#### 2. **Twitter (X) OAuth 2.0**

- **Provider**: Twitter API v2
- **Scopes**: `tweet.read`, `users.read`
- **User Info**: Username, display name, profile picture
- **Setup**: Twitter Developer Portal OAuth 2.0 app
- **Docs**: https://developer.twitter.com/en/docs/authentication/oauth-2-0

#### 3. **GitHub OAuth**

- **Provider**: GitHub OAuth Apps
- **Scopes**: `read:user`, `user:email`
- **User Info**: Username, email, name, avatar
- **Setup**: GitHub Developer Settings OAuth App
- **Docs**: https://docs.github.com/en/developers/apps/building-oauth-apps

### OAuth Flow

#### Login/Registration Flow

1. User clicks "Sign in with [Provider]"
2. Backend generates secure state token (CSRF protection)
3. Store state in `oauth_state` table with expiration (5 minutes)
4. Redirect user to provider's authorization URL
5. Provider redirects back to callback URL with code + state
6. Verify state token matches
7. Exchange code for access token
8. Fetch user profile from provider
9. Check if `oauth_accounts` entry exists:
   - **Exists**: Login user, issue JWT tokens
   - **New**: Create user account, link OAuth account, send welcome email, issue JWT tokens
10. Redirect to frontend with tokens

#### Account Linking Flow (Authenticated Users)

1. User is already logged in with JWT
2. User clicks "Link [Provider] Account"
3. Generate state token with `action: 'link'` and `user_id`
4. Redirect to provider authorization
5. Provider redirects to callback
6. Verify state and user_id match current authenticated user
7. Fetch provider user info
8. Check if provider account already linked to different user:
   - **Yes**: Return error (account already in use)
   - **No**: Create `oauth_accounts` entry, send confirmation email
9. Redirect to frontend with success message

### OAuth Configuration

Each provider requires:

- **Client ID**: Public identifier
- **Client Secret**: Secret key (stored in Pulumi secrets)
- **Redirect URI**: `https://api.yourdomain.com/auth/sso/callback`
- **Scopes**: Requested permissions

### Security Considerations

1. **State Parameter**: Random token to prevent CSRF attacks
2. **PKCE** (Proof Key for Code Exchange): Optional for enhanced security
3. **Token Storage**: Encrypt provider tokens before storing in database
4. **Token Refresh**: Implement refresh token rotation for long-lived access
5. **Account Takeover Prevention**:
   - Verify email matches if linking to existing account
   - Require re-authentication before unlinking last auth method
6. **Rate Limiting**: Limit OAuth callback attempts per IP
7. **Redirect Validation**: Whitelist allowed redirect URIs

---

## OAuth 2.1 Provider Implementation

### Using `@cloudflare/workers-oauth-provider`

**Library**: https://github.com/cloudflare/workers-oauth-provider

This library allows our authentication service to act as an **OAuth 2.1 provider**, enabling third-party applications to authenticate users through our system (similar to "Login with Google" but "Login with YourAuthService").

### Key Features

- **OAuth 2.1 Compliant**: Full implementation of OAuth 2.1 with PKCE support
- **End-to-End Encryption**: Token storage uses hashed secrets, encrypted props
- **Cloudflare-Native**: Built specifically for Workers + KV architecture
- **Dynamic Client Registration**: RFC 7591 support for automated app registration
- **Smart Token Rotation**: Single-use refresh tokens with failure resilience
- **Flexible API Protection**: Wrap existing API routes with OAuth protection

### Architecture Overview

```typescript
// Your auth service becomes BOTH:
// 1. OAuth CLIENT (login WITH Google/GitHub)
// 2. OAuth PROVIDER (let others login WITH your service)

┌─────────────────────────────────────────────────────────────┐
│                    Your Auth Service                        │
│                                                             │
│  ┌─────────────────────┐       ┌───────────────────────┐   │
│  │   OAuth CLIENT      │       │   OAuth PROVIDER      │   │
│  │  (Phase 6 - Part 1) │       │  (Phase 6 - Part 2)   │   │
│  │                     │       │                       │   │
│  │  Login WITH:        │       │  Provide login FOR:   │   │
│  │  • Google           │       │  • Third-party apps   │   │
│  │  • GitHub           │       │  • Partner platforms  │   │
│  │  • Twitter          │       │  • Mobile apps        │   │
│  └─────────────────────┘       │  • Developer APIs     │   │
│                                └───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Pattern

```typescript
// main worker (src/index.ts)
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

export default new OAuthProvider({
  // API routes protected by OAuth
  apiRoute: ["/api/"],

  // Your existing API handler
  apiHandler: ApiHandler,

  // Default handler for auth UI
  defaultHandler: AuthUIHandler,

  // OAuth endpoints
  authorizeEndpoint: "/oauth/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",

  // Supported scopes
  scopesSupported: [
    "profile.read",
    "profile.write",
    "organizations.read",
    "organizations.write",
    "teams.read",
  ],

  // Token TTLs
  refreshTokenTTL: 2592000, // 30 days

  // Security settings
  allowImplicitFlow: false,
  disallowPublicClientRegistration: false,
});
```

### Storage Schema

Requires KV namespace binding: `OAUTH_KV`

Stores:

- Client registrations (client_id, client_secret hash, metadata)
- Authorization grants (user_id, scope, encrypted props)
- Access tokens (hashed, with expiration)
- Refresh tokens (hashed, single-use with rotation)

All secrets stored as hashes. Props encrypted with token as key material.

### Authorization Flow

```typescript
// 1. Third-party app initiates OAuth flow
GET /oauth/authorize?
    response_type=code&
    client_id=abc123&
    redirect_uri=https://app.example.com/callback&
    scope=profile.read+organizations.read&
    state=random_state

// 2. Your authorization UI (you implement)
async function handleAuthorize(request, env) {
  // Parse OAuth request
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);

  // Look up client info
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId);

  // Show consent screen to user (your UI)
  // User grants/denies permissions

  // Complete authorization
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId: currentUser.id,
    scope: grantedScopes,
    props: {
      userId: currentUser.id,
      email: currentUser.email,
      permissions: currentUser.permissions
    }
  });

  // Redirect back to third-party app
  return Response.redirect(redirectTo);
}

// 3. Third-party app exchanges code for tokens
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=auth_code_here&
client_id=abc123&
client_secret=secret&
redirect_uri=https://app.example.com/callback

// Response: { access_token, refresh_token, expires_in }

// 4. Third-party app makes API request
GET /api/user/profile
Authorization: Bearer access_token_here

// Your API handler receives authenticated request with props
```

### Integration with Existing JWT System

**Recommended approach**: Dual authentication system

```typescript
// JWT Authentication (existing, keep for direct users)
GET /v1/auth/login → JWT tokens
GET /v1/auth/me → Requires JWT

// OAuth 2.1 Provider (new, for third-party integrations)
GET /oauth/authorize → OAuth authorization
POST /oauth/token → OAuth token exchange
GET /api/* → Requires OAuth access token
```

Benefits:

- Direct users: Fast, simple JWT auth
- Third-party apps: Standard OAuth 2.1 flows
- Enterprise customers: Industry-standard integration
- Developer APIs: OAuth scopes for granular permissions

### Use Cases

1. **Platform API Access**: Developers build apps on your platform
2. **Enterprise SSO**: Companies use your auth as identity provider
3. **Mobile Apps**: Native apps authenticate users securely
4. **Partner Integrations**: B2B integrations with standard OAuth
5. **White-Label Solutions**: Clients embed your auth in their products

---

## Security Features

### 1. **Rate Limiting**

- Login: 5 attempts per 15 minutes per IP
- Registration: 3 attempts per hour per IP
- Password Reset: 3 requests per hour per email
- Email Verification: 5 resends per hour per user

### 2. **Password Policy**

- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Check against common password lists
- No password reuse (store last 5 hashes)

### 3. **Token Security**

- Access Token: 15-minute expiration
  - Contains full permission payload
  - Size limits: max 50 orgs, 100 teams, 200 repos (use KV cache for overflow)
- Refresh Token: 7-day expiration, single-use rotation
- JWT signed with HS256 or RS256
- JTI (JWT ID) for blacklisting
- Token invalidation on permission changes (org/team/repo role updates)

### 4. **CORS Configuration**

- Allowed origins: Configurable whitelist
- Credentials: true (for cookies)
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Headers: Content-Type, Authorization

### 5. **Cookie Security**

- Refresh token in httpOnly cookie
- Secure flag (HTTPS only)
- SameSite: Strict or Lax
- Path: /auth

### 6. **Additional Protections**

- CSRF tokens for state-changing operations
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention (CSP headers)
- Audit logging for sensitive operations

---

## Pulumi Infrastructure

### Resources to Define

#### 1. **Workers**

```typescript
// Main auth worker
const authWorker = new cloudflare.WorkerScript("auth-worker", {
  name: "auth-service",
  content: workerCode,
  kvNamespaceBindings: [
    /* KV bindings */
  ],
  d1DatabaseBindings: [
    /* D1 bindings */
  ],
  secrets: [
    /* JWT secret, etc. */
  ],
});
```

#### 2. **D1 Database**

```typescript
const authDatabase = new cloudflare.D1Database("auth-db", {
  accountId: cloudflareAccountId,
  name: "auth-database",
});
```

#### 3. **KV Namespaces**

```typescript
const rateLimitKV = new cloudflare.WorkersKvNamespace("rate-limit-kv");
const tokenBlacklistKV = new cloudflare.WorkersKvNamespace(
  "token-blacklist-kv"
);
const cacheKV = new cloudflare.WorkersKvNamespace("cache-kv");
```

#### 4. **Routes**

```typescript
const authRoute = new cloudflare.WorkerRoute("auth-route", {
  zoneId: zoneId,
  pattern: "api.yourdomain.com/auth/*",
  scriptName: authWorker.name,
});
```

#### 5. **Secrets**

```typescript
// JWT signing secret
// Database encryption key
// Email API keys
```

---

## Development Phases

> **Note**: Each phase includes backend implementation AND integration with the Qwik v2 demo application for immediate visual testing and validation.

### Phase 1: Project Setup & Infrastructure

**Backend:**

- [x] Initialize Pulumi project with TypeScript
- [x] Configure Cloudflare provider
- [x] Set up project folder structure
- [x] Install core dependencies (Hono, Jose, Zod, Arctic)
- [x] Configure Wrangler for local development
- [x] Set up D1 database and KV namespaces via Pulumi
- [x] Deploy infrastructure to Cloudflare
- [x] Initialize D1 database with schema (local and remote)
- [x] Configure environment variables and secrets
- [x] Verify health check endpoint
- [x] Merge base and main Pulumi stacks (single deployment)
- [x] Implement Route53 DNS automation (6 records)
- [x] Configure AWS SES with automated setup
- [x] Set up Pulumi ESC for runtime secret injection
- [x] Create simplified setup script (`scripts/setup.sh`)
- [x] Support Route53 hosted zone creation for subdomains
- [x] Configure email domain and bounce domain hierarchy

**Demo App:**

- [x] Initialize Qwik v2 application in `/demo-app`
- [x] Set up basic routing structure
- [x] Configure API client with base URL (using server$)
- [x] Set up development workflow (backend + demo app)
- [x] Create health check page demonstrating backend connectivity
- [x] Implement error handling and loading states
- [x] ~~Create layout components (header, sidebar)~~ - Deferred to Phase 2 (will build with actual navigation)
- [x] ~~Set up auth interceptors for API calls~~ - Deferred to Phase 2 (will build with real JWT tokens)
- [x] ~~Create mock auth context for development~~ - Deferred to Phase 2 (will build with real auth state)

**Status**: Phase 1 Complete ✅ - Infrastructure fully automated with single-stack deployment, Route53 DNS automation, AWS SES setup, and Pulumi ESC integration. Setup reduced from 15+ manual steps to 3 commands. Demo app initialized with working health check.

### Phase 2: Database & Core Authentication

**Backend:**

- [x] Create database migration scripts
- [x] Implement all database tables (users, organizations, permissions, roles, etc.)
- [x] Test local database with Wrangler
- [x] Implement registration handler (`POST /v1/auth/register`)
- [x] Implement login handler (`POST /v1/auth/login`)
- [x] JWT token generation & validation (with permission bitmaps)
- [x] Password hashing utilities (PBKDF2)
- [x] Refresh token rotation (`POST /v1/auth/refresh`)
- [x] Logout endpoint (`POST /v1/auth/logout`)
- [x] Get current user endpoint (`GET /v1/auth/me`)
- [x] Email verification token generation and storage
- [x] Email verification endpoint (`POST /v1/auth/verify-email`)
- [x] Resend verification endpoint (`POST /v1/auth/resend-verification`)
- [x] Email service with MailChannels integration
- [x] HTML email templates for verification

**Demo App:**

- [x] Create login page (`/routes/index.tsx`) with LoginForm component
- [x] Create registration page (`/routes/register/index.tsx`) with RegisterForm component
- [x] Implement auth context with token management (localStorage + memory)
- [x] Create protected route middleware (routeLoader$ pattern)
- [x] Build dashboard landing page (`/routes/dashboard/index.tsx`)
- [x] Add form validation with Zod schemas (routeAction$ pattern)
- [x] Create email verification page (`/routes/verify-email/index.tsx`)
- [x] Display email verification message after registration
- [x] Auto-redirect after successful email verification
- [x] Test complete registration → verify email → login → dashboard flow
- [x] Display user info from `/v1/auth/me` in dashboard

**Status**: Phase 2 Complete ✅ - All authentication endpoints operational, email verification system working end-to-end with AWS SES, demo app fully integrated with Qwik v2 patterns (routeAction$, routeLoader$). Complete registration flow tested and verified: registration → email sent via AWS SES → email verification → redirect to login → dashboard access.

### Phase 3: Email Integration

**Backend:**

- [x] ~~Set up Cloudflare Email Workers~~ - **Updated**: Migrated to AWS SES with Route53
- [x] Configure AWS SES domain identity and verification
- [x] Implement Route53 DNS automation (DKIM, SPF, MX, verification)
- [x] Set up bounce domain hierarchy (subdomain of email domain)
- [x] Configure SNS topics for bounce/complaint notifications
- [x] Implement email service abstraction (development + production modes)
- [x] Email verification flow (token generation, verification endpoint)
- [x] Resend verification endpoint implemented
- [x] Test email delivery end-to-end (development mode: console logging)
- [x] ~~Create MJML email templates~~ - Using inline HTML templates (MJML deferred to later)
- [x] Create shared types file (`src/types/shared.ts`) for frontend/backend/infrastructure data structures
- [x] Export shared types for demo app consumption
- [x] Password reset flow (request, reset, confirmation) - forgot-password and reset-password handlers
- [x] Create password changed notification email
- [ ] Build script to compile MJML to HTML + plain text
- [ ] Configure email rate limiting
- [ ] Test production email sending with AWS SES
- [ ] Implement email bounce/complaint handling

**Demo App:**

- [x] Create email verification page (`/routes/verify-email/index.tsx`)
- [x] Create password reset request page (`/routes/forgot-password/index.tsx`)
- [x] Create password reset form page (`/routes/reset-password/index.tsx`)
- [x] Add "Forgot password?" link to login page
- [x] Fix login redirect with client-side navigation (server-side redirect not working in Qwik v1)
- [x] Create logged-in confirmation page (`/routes/logged-in/index.tsx`)
- [x] Extract and set refresh token from backend Set-Cookie header
- [x] Configure Vite watch with polling for better HMR
- [x] Import shared types from backend (`@/types/shared`)
- [x] Display email verification status in dashboard with badge and conditional styling
- [x] Add "resend verification" functionality to dashboard with feedback messages
- [x] Add password change form to settings page (`/routes/settings/index.tsx`)
- [ ] Show toast notifications for email-related actions
- [ ] Test complete email verification and password reset flows

**Status**: Phase 3 Enhanced (60%) - Email verification working with AWS SES, Route53 DNS fully automated, bounce domain hierarchy configured. Password reset flow and MJML templates pending.

### Phase 4: Permission System

**Backend:**

- [ ] Seed database with base permissions and system roles
- [ ] Implement permission bitmap operations
- [ ] Implement PermissionService (checking, delegation validation)
- [ ] Create permission middleware for authorization
- [ ] Implement permission granting with delegation validation
- [ ] Custom role creation endpoints
- [ ] Permission audit trail and logging
- [ ] Test delegation validation (subset checking)
- [ ] Test permission inheritance and scoping
- [ ] Permission expiration handling

**Demo App:**

- [ ] Create permissions dashboard page (`/routes/dashboard/permissions/index.tsx`)
- [ ] Build PermissionTree component showing hierarchical permissions
- [ ] Create RoleSelector component for assigning roles
- [ ] Add PermissionBadge component for visual permission display
- [ ] Implement permission delegation UI with subset validation
- [ ] Create custom role builder interface
- [ ] Show permission audit trail in user/org settings
- [ ] Visualize permission inheritance chains
- [ ] Test permission granting/revoking with real-time updates

### Phase 5: Organization & Resource Management

**Backend:**

- [ ] Implement organization management endpoints (CRUD)
- [ ] Implement team management endpoints
- [ ] Implement repository endpoints
- [ ] Resource-scoped permission assignment
- [ ] Organization/team invitation emails
- [ ] Permission change notification emails
- [ ] Test complete RBAC workflows

**Demo App:**

- [ ] Create organizations list page (`/routes/dashboard/organizations/index.tsx`)
- [ ] Build organization detail/settings page
- [ ] Create teams management page (`/routes/dashboard/teams/index.tsx`)
- [ ] Add team detail page with member list
- [ ] Implement organization member invitation UI
- [ ] Create repository management interface
- [ ] Add collaborator management for repositories
- [ ] Show organization switcher in header
- [ ] Test org creation → team creation → member invitation flow
- [ ] Display real-time permission updates in UI

### Phase 6: SSO & OAuth Provider Integration

**Backend - OAuth Client (Login WITH providers):**

- [ ] Set up OAuth apps with Google, Twitter, GitHub
- [ ] Implement OAuth service abstraction
- [ ] Create SSO login handlers (`GET /v1/auth/sso/{provider}`)
- [ ] Implement OAuth callback handler (`GET /v1/auth/sso/callback`)
- [ ] Account linking/unlinking endpoints
- [ ] SSO-specific email templates
- [ ] Test OAuth flows end-to-end

**Backend - OAuth 2.1 Provider (BE an OAuth provider):**

- [ ] Install `@cloudflare/workers-oauth-provider` library
- [ ] Set up KV namespace for OAuth token storage (`OAUTH_KV`)
- [ ] Implement OAuth authorization UI endpoint (`/oauth/authorize`)
- [ ] Configure OAuth token endpoint (`/oauth/token`) - handled by library
- [ ] Implement dynamic client registration endpoint (`/oauth/register`) - optional
- [ ] Create API handlers for OAuth-protected endpoints
- [ ] Implement authorization consent flow UI
- [ ] Configure scopes supported by the OAuth provider
- [ ] Set up refresh token TTL and rotation
- [ ] Test OAuth 2.1 flows (authorization code, refresh token)
- [ ] Implement token revocation endpoint
- [ ] Create OAuth client management UI for users
- [ ] Test third-party app integration flows

**Demo App:**

- [ ] Add SSO buttons component to login page
- [ ] Implement OAuth popup/redirect flow
- [ ] Create account linking page in settings (`/routes/settings/accounts/`)
- [ ] Show linked accounts with provider icons
- [ ] Add "Link {Provider}" buttons for each OAuth provider
- [ ] Implement account unlinking confirmation dialog
- [ ] Display SSO login history
- [ ] Test complete SSO login and account linking flows
- [ ] Create OAuth developer dashboard page (`/routes/dashboard/oauth-apps/`)
- [ ] Build OAuth app registration interface
- [ ] Show OAuth app credentials (client_id, client_secret)
- [ ] Display active OAuth grants and scopes
- [ ] Implement OAuth consent screen preview
- [ ] Add OAuth token revocation UI
- [ ] Test authorization flow as third-party app developer

### Phase 7: Security & Additional Features

**Backend:**

- [ ] Implement rate limiting middleware with KV
- [ ] Token blacklisting (logout)
- [ ] CORS middleware
- [ ] Input validation with Zod
- [ ] Audit logging for sensitive operations
- [ ] Suspicious login detection
- [ ] Account status management

**Demo App:**

- [ ] Add security settings page (`/routes/settings/security/index.tsx`)
- [ ] Display active sessions with device/location info
- [ ] Implement "sign out all devices" functionality
- [ ] Show audit log of recent account activity
- [ ] Add suspicious login alerts/notifications
- [ ] Create account status indicators (active, suspended)
- [ ] Test rate limiting with user-friendly error messages
- [ ] Show CORS errors gracefully in development

### Phase 8: Testing

**Backend:**

- [ ] Unit tests for utilities and services
- [ ] Integration tests for all endpoints
- [ ] Permission delegation security tests
- [ ] Load testing
- [ ] Security audit

**Demo App:**

- [ ] E2E tests for authentication flows (Playwright)
- [ ] Component tests for critical UI elements
- [ ] Test permission UI with different role combinations
- [ ] Test responsive design across devices
- [ ] Accessibility audit (WCAG compliance)
- [ ] Performance testing (Lighthouse scores)
- [ ] Cross-browser compatibility testing

### Phase 9: Deployment & Monitoring

**Backend:**

- [x] Pulumi stack configuration (dev stack configured)
- [x] Single-stack deployment architecture
- [x] Automated infrastructure provisioning
- [x] Pulumi ESC for secret management (runtime injection)
- [ ] CI/CD pipeline setup (GitHub Actions with OIDC)
- [ ] Cloudflare Analytics integration
- [ ] Configure custom domain routing
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Deployment guide documentation (in progress)
- [ ] Production stack deployment
- [ ] Performance monitoring and alerting
- [ ] Staging environment setup

**Demo App:**

- [ ] Configure Cloudflare Pages deployment
- [ ] Set up preview deployments for PRs
- [ ] Configure environment variables for prod
- [ ] Add analytics tracking (Cloudflare Analytics)
- [ ] Create user documentation/help pages
- [ ] Set up error tracking and reporting
- [ ] Deploy to production with blue-green strategy
- [ ] Monitor real-user performance metrics

**Infrastructure Improvements Completed:**

- ✅ Merged base and main stacks (single deployment)
- ✅ Route53 DNS automation (6 records)
- ✅ AWS SES with automated setup
- ✅ Pulumi ESC integration
- ✅ OIDC providers for GitHub Actions and Pulumi ESC
- ✅ Simplified setup script (15+ steps → 3 commands)
- ✅ Subdomain hosted zone support
- ✅ Email domain hierarchy (bounce as subdomain)

---

## Configuration

### Environment Variables / Secrets

```env
# JWT
JWT_SECRET=<random-secret>
JWT_ACCESS_EXPIRATION=900 # 15 minutes
JWT_REFRESH_EXPIRATION=604800 # 7 days

# Database
D1_DATABASE_ID=<d1-database-id>

# KV Namespaces
KV_RATE_LIMIT_ID=<kv-namespace-id>
KV_TOKEN_BLACKLIST_ID=<kv-namespace-id>
KV_CACHE_ID=<kv-namespace-id>

# Email
EMAIL_FROM=noreply@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com
EMAIL_API_KEY=<email-provider-api-key>

# OAuth - Google
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/v1/auth/sso/callback

# OAuth - Twitter
TWITTER_CLIENT_ID=<twitter-client-id>
TWITTER_CLIENT_SECRET=<twitter-client-secret>
TWITTER_REDIRECT_URI=https://api.yourdomain.com/v1/auth/sso/callback

# OAuth - GitHub
GITHUB_CLIENT_ID=<github-client-id>
GITHUB_CLIENT_SECRET=<github-client-secret>
GITHUB_REDIRECT_URI=https://api.yourdomain.com/v1/auth/sso/callback

# App
APP_URL=https://app.yourdomain.com
API_URL=https://api.yourdomain.com

# Multi-Domain Support
ENABLE_CUSTOM_DOMAINS=true
DEFAULT_DOMAIN=api.yourdomain.com

# Rate Limiting
RATE_LIMIT_LOGIN=5
RATE_LIMIT_REGISTER=3
RATE_LIMIT_PASSWORD_RESET=3

# Permission Cache
PERMISSION_CACHE_TTL=900 # 15 minutes (matches token expiration)
MAX_ORGS_IN_TOKEN=50
MAX_TEAMS_IN_TOKEN=100
MAX_REPOS_IN_TOKEN=200

# Monitoring
CLOUDFLARE_ANALYTICS_TOKEN=<analytics-token>
ENABLE_ANALYTICS=true
ENABLE_AUDIT_LOGGING=true
```

---

## Dependencies

### Backend Dependencies

```json
{
  "dependencies": {
    "@cloudflare/workers-types": "^4.x",
    "hono": "^3.x", // Lightweight router for Workers
    "jose": "^5.x", // JWT handling
    "zod": "^3.x", // Runtime validation
    "arctic": "^1.x" // OAuth 2.0 client library for multiple providers
  },
  "devDependencies": {
    "@pulumi/pulumi": "^3.x",
    "@pulumi/cloudflare": "^5.x",
    "wrangler": "^3.x",
    "typescript": "^5.x",
    "vitest": "^1.x",
    "mjml": "^4.x", // Email template engine
    "html-to-text": "^9.x" // HTML to plain text converter
  }
}
```

### Demo App Dependencies (`/demo-app/package.json`)

```json
{
  "name": "auth-demo-app",
  "version": "0.1.0",
  "dependencies": {
    "@builder.io/qwik": "^2.0.0-beta",
    "@builder.io/qwik-city": "^2.0.0-beta",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "typescript": "^5.x",
    "vite": "^5.x",
    "@playwright/test": "^1.x",
    "prettier": "^3.x",
    "eslint": "^8.x"
  },
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "playwright test",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Decisions Made

**Architecture & Implementation:**

- ✅ **Permission Model**: Superset/subset delegation model with organization owners as "masters of keys"
- ✅ **Permission Storage**: Bitwise operations with 128-bit bitmaps (expandable to 256)
- ✅ **Token Refresh on Permission Change**: Invalidate tokens, force refresh
- ✅ **Permission Wildcards**: Support in role definitions (e.g., `org.*`)
- ✅ **Permission Caching**: 15-minute TTL matching token expiration
- ✅ **Email Provider**: Cloudflare Email Workers for transactional emails
- ✅ **Email Templates**: MJML for responsive HTML emails (compile to HTML + text fallback)
- ✅ **API Versioning**: Version from the start (`/v1/auth/...`)
- ✅ **Custom Domains**: Support configurable multi-domain routing (per org/team/tenant)
- ✅ **Monitoring**: Cloudflare Analytics for performance and usage tracking

**Future Considerations:**

- 🔮 **Multi-Factor Authentication (2FA)**: Not in initial release, but design system to be extensible
  - Database schema includes placeholder for 2FA settings
  - Authentication flow designed to support additional verification steps
  - Consider TOTP (authenticator apps), SMS, or WebAuthn/passkeys

---

## Infrastructure Improvements (December 2024)

### Automated Setup - From 15+ Steps to 3 Commands

**Previous Setup (Manual):**

1. Create base stack, deploy OIDC providers
2. Manually configure DNS records (6 records)
3. Create SES domain identity
4. Wait for DNS verification
5. Create SNS topics
6. Configure bounce handling
7. Create IAM user/policies
8. Store credentials in Secrets Manager
9. Configure Pulumi ESC
10. Create main stack resources
11. Update wrangler.toml manually
12. Set worker secrets via wrangler
13. Deploy worker
14. Test email delivery
15. Debug DNS issues

**Current Setup (Automated):**

```bash
./scripts/setup.sh      # Interactive configuration
cd infrastructure
pulumi up               # Deploy everything
wrangler deploy         # Deploy worker (secrets auto-injected)
```

### Key Improvements

#### 1. Single-Stack Architecture

- **Before**: Separate base and main stacks requiring two deployments
- **After**: Unified stack with automatic dependency management
- **Benefit**: One `pulumi up` command deploys everything

#### 2. Route53 DNS Automation

- **Before**: Manual DNS record creation in Route53 console
- **After**: Pulumi creates all 6 DNS records automatically
- **Records**: Domain verification TXT, 3x DKIM CNAME, MX, SPF TXT
- **Benefit**: Zero manual DNS configuration, immediate verification

#### 3. Email Domain Hierarchy

- **Before**: Hard-coded `mail.` subdomain prefix
- **After**: Configurable email domain with bounce subdomain
- **Structure**: `emailDomain` → `bounces.emailDomain` (AWS SES requirement)
- **Benefit**: Flexible domain setup, proper hierarchy for SES

#### 4. Pulumi ESC Integration

- **Before**: Manual `wrangler secret put` for each secret
- **After**: Runtime secret injection via OIDC
- **Benefit**: No manual secret management, automatic rotation support

#### 5. Hosted Zone Support

- **Before**: Assumed existing hosted zone
- **After**: Optional hosted zone creation for subdomains
- **Benefit**: Complete subdomain setup (e.g., `auth.example.com`)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Single Pulumi Stack                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Base Resources (OIDC Providers)                       │  │
│  │  • GitHub Actions OIDC                                │  │
│  │  • Pulumi ESC OIDC                                    │  │
│  │  • IAM Roles with Trust Policies                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Email Infrastructure (AWS SES + Route53)              │  │
│  │  • Domain Identity Verification                       │  │
│  │  • 6x DNS Records (automated)                         │  │
│  │  • Bounce Domain (subdomain hierarchy)                │  │
│  │  • SNS Topics (bounce/complaint/delivery)             │  │
│  │  • IAM User + Access Keys                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Cloudflare Resources                                  │  │
│  │  • D1 Database                                        │  │
│  │  • KV Namespaces (3)                                  │  │
│  │  • Worker Script                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Pulumi ESC Environment                                │  │
│  │  • AWS OIDC Login                                     │  │
│  │  • SES Credentials (runtime)                          │  │
│  │  • Secrets Injection                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓
    wrangler deploy (secrets auto-injected)
```

### Files Added/Modified

**New Files:**

- `scripts/setup.sh` - Interactive setup script (unified)
- `infrastructure/email/` - Modular email infrastructure
- `infrastructure/base/` - OIDC providers and IAM
- `SIMPLIFIED_SETUP.md` - Documentation of improvements

**Removed Files:**

- `scripts/setup-aws-ses.sh` - Manual SES setup (obsolete)
- `scripts/setup-email-routing.sh` - Manual routing (obsolete)
- `scripts/cleanup-aws-resources.sh` - Manual cleanup (obsolete)
- `scripts/email-helpers.sh` - Manual helpers (obsolete)
- `infrastructure/setup.md` - Old manual setup docs
- `infrastructure/guide.md` - Outdated guide

**Documentation Cleanup:**

- Removed 14 obsolete documentation files
- Consolidated setup into single source of truth
- Updated all references to new simplified process

### Metrics

- **Setup Time**: 30-45 minutes → 5-10 minutes
- **Manual Steps**: 15+ → 3
- **DNS Configuration**: Manual (error-prone) → Automated (reliable)
- **Secret Management**: Manual rotation → OIDC-based (automatic)
- **Stack Deployments**: 2 → 1
- **Documentation Files**: 25+ → 11 (60% reduction)

---

## Success Criteria

**Phase 1 & 2 (Core Auth) ✅:**

- [x] Users can register with email/password
- [x] Email verification flow works end-to-end
- [x] Users can login and receive JWT tokens
- [x] Token refresh mechanism works correctly
- [x] JWT tokens structured correctly with user data
- [x] Automated infrastructure deployment (single command)
- [x] Route53 DNS fully automated (6 records)
- [x] AWS SES configured and operational
- [x] Pulumi ESC runtime secret injection

**Phase 3 (Email) - In Progress:**

- [ ] Password reset flow works end-to-end
- [ ] All emails are delivered within 30 seconds
- [ ] Email rate limiting configured
- [ ] Bounce/complaint handling implemented

**Phase 4-6 (Advanced Features) - Pending:**

- [ ] Users can login with Google, Twitter, or GitHub
- [ ] Account linking/unlinking works for all SSO providers
- [ ] JWT tokens contain correct permission bitmaps
- [ ] Permission checking works with bitwise operations
- [ ] Delegation validation prevents privilege escalation
- [ ] Organization owners have full permission superset
- [ ] Users can only grant permissions they possess
- [ ] Custom roles can be created and assigned
- [ ] Permission expiration works correctly
- [ ] Organization/team/repository management works correctly
- [ ] Permission inheritance and scoping resolves properly
- [ ] Audit trail tracks all permission changes

**Phase 7-9 (Security & Production) - Pending:**

- [ ] Rate limiting prevents abuse
- [ ] API responds within 200ms (p95)
- [ ] 99.9% uptime SLA
- [ ] Zero security vulnerabilities in production
- [ ] Comprehensive test coverage (>80%)
- [ ] Permission delegation cannot be circumvented

---

## Next Steps

### Immediate (Phase 2 Completion)

1. ✅ Infrastructure fully automated and deployed
2. ✅ Email verification working end-to-end
3. **Next**: Complete password reset flow
4. **Next**: Test complete registration → verify → login → dashboard flow

### Phase 3 (Email Integration - Final Tasks)

1. Implement password reset handlers (forgot/reset)
2. Add password reset pages to demo app
3. Test production email sending with AWS SES
4. Implement email rate limiting
5. Add bounce/complaint handling

### Phase 4 (Permission System - Start)

1. Seed database with base permissions
2. Implement permission bitmap operations
3. Build permission checking middleware
4. Create permissions dashboard UI

### Infrastructure Next Steps

1. Set up CI/CD pipeline with GitHub Actions OIDC
2. Create staging environment
3. Configure production stack
4. Set up monitoring and alerting

---

## Notes

- **Status**: Phase 1 Complete ✅ | Phase 2 Complete ✅ | Phase 3 In Progress (60%)
- **Infrastructure**: Fully automated single-stack deployment
  - Setup time: 5-10 minutes (was 30-45 minutes)
  - Manual steps: 3 commands (was 15+ steps)
  - DNS: Fully automated via Route53
  - Secrets: OIDC-based runtime injection (Pulumi ESC)
- **Demo App**: Qwik v2 application for real-time testing and demonstration
  - Location: `/demo-app`
  - Framework: Qwik v2 (beta) - https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/
  - Integration: Each development phase includes corresponding UI implementation
  - Purpose: Immediate visual feedback and end-to-end testing during development
- **Email Service**: AWS SES with Route53 DNS automation
  - Domain verification: Automated
  - DKIM/SPF/MX records: Automated
  - Bounce domain: Configurable subdomain hierarchy
  - SNS notifications: Bounce, complaint, delivery tracking
- **Documentation**: Consolidated from 25+ files to 11 focused files (60% reduction)
- **Scripts**: Reduced from 8 to 4 essential scripts
- **Deprecated**: `/example-app` HTML/JS prototype (replaced by Qwik v2 demo)
- All code follows TypeScript best practices
- Security is paramount - all auth flows reviewed
- Email templates currently inline HTML (MJML compilation deferred)
- GDPR/privacy requirements to be addressed in Phase 7
- Permission delegation model prevents privilege escalation by design
- Qwik v2 reactive architecture: Use context-centric patterns (see `.github/instructions/`)

---

## Demo Application Stack

### Qwik v2 (Frontend)

**Why Qwik v2:**

- Resumability for instant interactivity
- Fine-grained reactivity system
- Built-in SSR and streaming
- Optimized for edge deployment (Cloudflare Pages)
- Zero-JavaScript by default (progressive enhancement)

**Key Features to Demonstrate:**

1. **Authentication Flows**: Login, register, SSO, email verification
2. **Permission Management**: Visual permission trees, role assignment, delegation
3. **Organization Management**: Multi-tenancy, team collaboration
4. **Real-time Updates**: Token refresh, permission changes
5. **Security Features**: Session management, audit logs, rate limiting feedback

**Development Workflow:**

```bash
# Start backend (from project root)
pnpm run dev:backend  # or: wrangler dev

# Start demo app (from /demo-app)
pnpm run dev

# Both services running:
# - Backend: http://localhost:8787 (Cloudflare Worker)
# - Frontend: http://localhost:5173 (Qwik dev server)
```

**API Integration Pattern:**

```typescript
// /demo-app/src/lib/api.ts
import { server$ } from "@builder.io/qwik-city";

// Server-side API calls (secure, never exposes tokens to client)
export const login$ = server$(async (credentials: LoginCredentials) => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return response.json();
});

// Client-side calls with automatic token injection
export const getCurrentUser = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};
```
