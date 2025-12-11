# OAuth 2.1 Provider Integration Guide

**Library**: [`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider)  
**Phase**: Phase 6 (Part 2)  
**Status**: Planned

---

## Overview

This guide covers integrating Cloudflare's OAuth 2.1 Provider library to make our authentication service act as an OAuth provider for third-party applications.

## What This Enables

- **Third-party app integrations**: Developers can build apps that authenticate users through our service
- **Enterprise SSO**: Companies can use our auth as their identity provider
- **API access control**: OAuth scopes for granular permission management
- **Standard OAuth flows**: Industry-standard authorization code + refresh token patterns

## Architecture Decision

### Dual Authentication System (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                 Authentication Layers                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: JWT Authentication (existing)                     │
│  ├─ Use case: Direct users of our platform                  │
│  ├─ Endpoints: /v1/auth/*                                   │
│  └─ Tokens: Custom JWT with permission bitmaps              │
│                                                             │
│  Layer 2: OAuth 2.1 Provider (new)                          │
│  ├─ Use case: Third-party applications                      │
│  ├─ Endpoints: /oauth/*, /api/*                             │
│  └─ Tokens: Standard OAuth access + refresh tokens          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why Keep Both?

1. **Performance**: JWT auth is faster for direct users (no KV lookups)
2. **Simplicity**: Existing apps don't need migration
3. **Standards**: OAuth 2.1 for enterprise/third-party integrations
4. **Flexibility**: Choose appropriate auth method per use case

---

## Installation

```bash
pnpm add @cloudflare/workers-oauth-provider
```

## KV Namespace Setup

Add to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

## Basic Implementation

### 1. Main Worker Configuration

```typescript
// src/index.ts
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { ApiHandler } from "./api-handler";
import { AuthUIHandler } from "./auth-ui-handler";

export default new OAuthProvider({
  // API routes protected by OAuth
  apiRoute: ["/api/", "https://api.yourdomain.com/"],

  // API handler receives authenticated requests
  apiHandler: ApiHandler,

  // Default handler for UI and auth flows
  defaultHandler: AuthUIHandler,

  // OAuth endpoints
  authorizeEndpoint: "https://auth.yourdomain.com/oauth/authorize",
  tokenEndpoint: "https://auth.yourdomain.com/oauth/token",
  clientRegistrationEndpoint: "https://auth.yourdomain.com/oauth/register",

  // Supported OAuth scopes
  scopesSupported: [
    "profile.read",
    "profile.write",
    "email.read",
    "organizations.read",
    "organizations.write",
    "teams.read",
    "teams.write",
    "permissions.read",
  ],

  // Token configuration
  refreshTokenTTL: 2592000, // 30 days
  allowImplicitFlow: false,
  disallowPublicClientRegistration: false,
});
```

### 2. Authorization UI Handler

```typescript
// src/auth-ui-handler.ts
export const AuthUIHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/oauth/authorize") {
      // Parse OAuth authorization request
      const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);

      // Look up client application metadata
      const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId);

      // Get current authenticated user (from JWT or session)
      const user = await getCurrentUser(request, env);

      if (!user) {
        // Redirect to login with return URL
        return Response.redirect(
          `/login?return_to=${encodeURIComponent(request.url)}`
        );
      }

      // Render consent screen
      return renderConsentScreen({
        user,
        client,
        requestedScopes: oauthReq.scope,
        onApprove: async (grantedScopes) => {
          const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization(
            {
              request: oauthReq,
              userId: user.id,
              scope: grantedScopes,
              props: {
                userId: user.id,
                email: user.email,
                displayName: user.displayName,
                permissions: user.permissions,
              },
            }
          );
          return Response.redirect(redirectTo);
        },
        onDeny: () => {
          // Redirect back with error
          const errorUrl = new URL(oauthReq.redirectUri);
          errorUrl.searchParams.set("error", "access_denied");
          errorUrl.searchParams.set("state", oauthReq.state);
          return Response.redirect(errorUrl.toString());
        },
      });
    }

    // Handle other routes...
    return new Response("Not found", { status: 404 });
  },
};
```

### 3. API Handler

```typescript
// src/api-handler.ts
import { WorkerEntrypoint } from "cloudflare:workers";

export class ApiHandler extends WorkerEntrypoint {
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Access authenticated user props from OAuth context
    // this.ctx.props contains the data passed in completeAuthorization()
    const { userId, email, permissions } = this.ctx.props;

    if (url.pathname === "/api/user/profile") {
      // Fetch user data from database
      const user = await this.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(userId)
        .first();

      return Response.json({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      });
    }

    if (url.pathname === "/api/user/organizations") {
      // Check OAuth scope
      if (!this.ctx.props.scopes?.includes("organizations.read")) {
        return Response.json({ error: "Insufficient scope" }, { status: 403 });
      }

      // Return user's organizations
      const orgs = await getUserOrganizations(userId, this.env);
      return Response.json(orgs);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
```

---

## OAuth Client Management

### Dynamic Client Registration (RFC 7591)

Third-party developers can register OAuth apps programmatically:

```typescript
POST /oauth/register
Content-Type: application/json

{
  "client_name": "My Awesome App",
  "redirect_uris": ["https://myapp.com/oauth/callback"],
  "logo_uri": "https://myapp.com/logo.png",
  "client_uri": "https://myapp.com",
  "scope": "profile.read organizations.read"
}

// Response:
{
  "client_id": "abc123xyz",
  "client_secret": "secret_xyz789",
  "client_name": "My Awesome App",
  "redirect_uris": ["https://myapp.com/oauth/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "scope": "profile.read organizations.read"
}
```

### Manual Client Creation

For admin-created clients:

```typescript
// Helper function to create OAuth clients
const clientId = await env.OAUTH_PROVIDER.createClient({
  name: "Partner Platform",
  redirectUris: ["https://partner.com/callback"],
  logoUri: "https://partner.com/logo.png",
  scopes: ["profile.read", "organizations.read"],
  isConfidential: true, // Confidential client (has secret)
});
```

---

## Security Features

### 1. End-to-End Encryption

- **Secrets stored as hashes**: Access tokens, refresh tokens, client secrets
- **Props encrypted**: User data encrypted with token as key material
- **No plaintext secrets in KV**: Even if KV is compromised, tokens cannot be derived

### 2. Single-Use Refresh Tokens (with resilience)

- Each refresh invalidates old token and issues new one
- Supports up to 2 valid refresh tokens to handle transient failures
- Prevents token replay attacks

### 3. PKCE Support

- Proof Key for Code Exchange for public clients
- Protects authorization code interception attacks
- Required for SPAs and mobile apps

### 4. Scope Validation

```typescript
// Define scopes with descriptions
const SCOPES = {
  "profile.read": "Read your basic profile information",
  "profile.write": "Update your profile information",
  "organizations.read": "View your organizations",
  "organizations.write": "Manage your organizations",
  "teams.read": "View team memberships",
  "teams.write": "Manage team memberships",
};

// Validate requested scopes
function validateScopes(requested: string[], clientAllowed: string[]) {
  return requested.every(
    (scope) => clientAllowed.includes(scope) && SCOPES[scope]
  );
}
```

---

## Testing OAuth Flows

### 1. Authorization Code Flow

```bash
# 1. Get authorization code
curl "https://auth.yourdomain.com/oauth/authorize?\
response_type=code&\
client_id=YOUR_CLIENT_ID&\
redirect_uri=https://yourapp.com/callback&\
scope=profile.read+organizations.read&\
state=random_state_string"

# User approves → redirects to:
# https://yourapp.com/callback?code=AUTH_CODE&state=random_state_string

# 2. Exchange code for tokens
curl -X POST https://auth.yourdomain.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://yourapp.com/callback"

# Response:
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_..."
}

# 3. Use access token
curl https://auth.yourdomain.com/api/user/profile \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### 2. Refresh Token Flow

```bash
curl -X POST https://auth.yourdomain.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

---

## UI Components to Build

### 1. OAuth Consent Screen

```tsx
// demo-app/src/routes/oauth/authorize/index.tsx
export default component$(() => {
  const oauthRequest = useOAuthRequest(); // From query params
  const client = useClientInfo(oauthRequest.clientId);

  return (
    <div class="consent-screen">
      <h1>Authorize {client.name}</h1>
      <img src={client.logoUri} alt={client.name} />

      <p>{client.name} is requesting access to your account</p>

      <div class="requested-scopes">
        <h2>This app will be able to:</h2>
        <ul>
          {oauthRequest.scopes.map((scope) => (
            <li key={scope}>
              <Icon name={getScopeIcon(scope)} />
              {getScopeDescription(scope)}
            </li>
          ))}
        </ul>
      </div>

      <div class="actions">
        <button onClick$={handleDeny}>Deny</button>
        <button onClick$={handleApprove}>Authorize</button>
      </div>
    </div>
  );
});
```

### 2. OAuth Apps Dashboard

```tsx
// demo-app/src/routes/dashboard/oauth-apps/index.tsx
export default component$(() => {
  const apps = useOAuthApps(); // User's registered OAuth apps

  return (
    <div class="oauth-apps-dashboard">
      <h1>Your OAuth Applications</h1>

      <button onClick$={createNewApp}>Create New App</button>

      <div class="apps-list">
        {apps.map((app) => (
          <div key={app.clientId} class="app-card">
            <h2>{app.name}</h2>
            <p>Client ID: {app.clientId}</p>
            <p>Created: {app.createdAt}</p>
            <div class="app-actions">
              <button onClick$={() => viewApp(app)}>View</button>
              <button onClick$={() => editApp(app)}>Edit</button>
              <button onClick$={() => deleteApp(app)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
```

### 3. Active OAuth Grants (User Settings)

```tsx
// demo-app/src/routes/settings/authorized-apps/index.tsx
export default component$(() => {
  const grants = useOAuthGrants(); // Apps user has authorized

  return (
    <div class="authorized-apps">
      <h1>Authorized Applications</h1>

      <p>These apps have access to your account:</p>

      {grants.map((grant) => (
        <div key={grant.id} class="grant-card">
          <img src={grant.client.logoUri} alt={grant.client.name} />
          <div>
            <h3>{grant.client.name}</h3>
            <p>Authorized: {grant.createdAt}</p>
            <p>Scopes: {grant.scopes.join(", ")}</p>
          </div>
          <button onClick$={() => revokeGrant(grant.id)}>Revoke Access</button>
        </div>
      ))}
    </div>
  );
});
```

---

## Migration Path

### Phase 6 Part 2 Implementation Order

1. **Install library and set up KV namespace** (Week 1)
2. **Create basic OAuth provider wrapper** (Week 1)
3. **Implement authorization UI** (Week 2)
4. **Build consent screen** (Week 2)
5. **Create OAuth app management UI** (Week 3)
6. **Add scope definitions and validation** (Week 3)
7. **Test with sample third-party app** (Week 4)
8. **Document OAuth API for developers** (Week 4)

---

## Resources

- **Library Repo**: https://github.com/cloudflare/workers-oauth-provider
- **OAuth 2.1 Spec**: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1
- **RFC 7591** (Dynamic Registration): https://tools.ietf.org/html/rfc7591
- **RFC 8414** (Metadata Discovery): https://tools.ietf.org/html/rfc8414
- **PKCE Spec** (RFC 7636): https://tools.ietf.org/html/rfc7636

---

## Next Steps

After Phase 2 completion:

1. ✅ Review this integration plan
2. ⏳ Complete Phase 3 (Email)
3. ⏳ Complete Phase 4 (Permissions)
4. ⏳ Complete Phase 5 (Organizations)
5. ⏳ Start Phase 6 Part 1 (OAuth Client - SSO)
6. ⏳ Implement Phase 6 Part 2 (OAuth Provider - using this library)
