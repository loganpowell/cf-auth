# CF-Auth: Multi-Tenant Authorization Service

**Status**: ✅ Production - Week 2 Complete  
**URL**: https://auth-service.logan-607.workers.dev  
**Version**: 0.4.0

## 🎉 Current Status

**Phase 1 Week 2: COMPLETE ✅**

- ✅ Multi-tenant infrastructure deployed to production
- ✅ D1 database with 9 tables migrated
- ✅ Admin Dashboard API fully operational
- ✅ API key authentication fixed and working
- ✅ Durable Objects deployed with HTTP endpoints
- ✅ 109/130 tests passing (21 skipped for R2)
- ✅ E2E test automation complete

See [WEEK_2_COMPLETE_SUMMARY.md](../docs/multi-tenant-migration/WEEK_2_COMPLETE_SUMMARY.md) for detailed accomplishments.

> **Note**: Multi-tenant architecture with CSV-based authorization graph. KuzuDB WASM integration planned for Week 4+.

## ✨ Features

### Currently Working (Week 2) ✅

- 🏢 Multi-tenant hierarchy with namespace isolation
- 🔑 API key authentication (public, secret, restricted)
- 👨‍💼 Admin Dashboard API for tenant management
- 💾 D1 database with tenant data, API keys, sessions
- 🎯 Durable Objects for real-time state (TenantState, GraphStateCSV)
- 🗂️ KV namespaces (rate limiting, sessions, cache, mutation log)
- 🚀 Edge-native on Cloudflare Workers

### Planned (Week 3+)

- 👥 End-user authentication (registration, login, sessions)
- 📧 Email verification with AWS SES
- 🔐 OAuth integration (GitHub, Google)
- 📊 CSV-based authorization graph from R2
- 🔍 KuzuDB WASM for client-side authorization queries (<1ms)
- 🌐 WebSocket real-time updates

## 🎯 Quick Start

### Email Service

**Using AWS SES** for production-grade transactional emails:

- 50,000 emails/day (free tier)
- Advanced deliverability and analytics
- Bounce and complaint handling
- Email templates support

Quick setup:

```bash
./scripts/setup-aws-ses.sh
```

See [AWS SES Setup Guide](docs/AWS_SES_SETUP.md) for detailed instructions.

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account
- AWS account (for email sending)
- Pulumi CLI (for infrastructure)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your Cloudflare credentials
```

### 3. Set Up Email Routing (For Email Verification)

Run the interactive setup script:

```bash
./scripts/setup-email-routing.sh
```

Or see [LOCAL_EMAIL_SETUP.md](docs/LOCAL_EMAIL_SETUP.md) for detailed instructions.

> **Note**: Development mode logs emails to console (no setup needed). Production mode requires Email Routing configuration in Cloudflare Dashboard.

### 4. Deploy Infrastructure

```bash
cd infrastructure
source ../.env && export PULUMI_CONFIG_PASSPHRASE
pulumi up
```

### 5. Initialize Database

```bash
pnpm exec wrangler d1 execute auth-db --remote --file=db/schema.sql
```

### 6. Start Development Server

```bash
pnpm run dev
```

Visit `http://localhost:8787/health` to verify it's running.

### 7. Test Email Functionality (Optional)

```bash
# Test email verification flow
./scripts/test-email.sh
```

See [LOCAL_EMAIL_SETUP.md](docs/LOCAL_EMAIL_SETUP.md) for comprehensive testing guide.

## 📁 Project Structure

```
cf-auth/
├── src/               # Worker source code
│   ├── handlers/      # Route handlers (register, login, verify-email, etc.)
│   ├── services/      # Business logic (user, token, email services)
│   ├── middleware/    # Auth, CORS, rate limiting
│   ├── utils/         # Crypto utilities
│   └── db/            # Database queries
├── demo-app/          # Qwik v2 demonstration application ✨
│   ├── src/routes/    # Login, register, dashboard, verify-email pages
│   ├── src/components/# Auth forms and UI components
│   └── src/lib/       # Auth context and utilities
├── infrastructure/    # Pulumi IaC (Cloudflare Workers, D1, KV)
├── db/                # SQL schemas
├── docs/              # Documentation (plan, summaries, guides)
└── tests/             # Unit & integration tests
```

## 📚 Documentation

- **[PHASE 2 COMPLETE](docs/PHASE2_COMPLETE.md)** - ✅ Phase 2 accomplishments and metrics
- **[Implementation Plan](docs/plan.md)** - Complete development roadmap with all phases
- **[OAuth Provider Integration](docs/oauth-provider-integration.md)** - Phase 6 OAuth 2.1 provider guide
- **[Permission Model](docs/permission-model.md)** - Hierarchical permission system design
- **[Phase 1 Summary](docs/phase1-summary.md)** - Infrastructure setup status
- **[Infrastructure Setup](infrastructure/README.md)** - Deployment guide

## 🏗️ Architecture

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Framework**: Hono
- **Auth**: Jose (JWT), Arctic (OAuth)
- **IaC**: Pulumi

## 🛠️ Development

```bash
# Run dev server
pnpm run dev

# Run tests
pnpm test

# Build
pnpm run build

# Deploy
pnpm run deploy
```

### Generate OpenAPI Spec & SDK

1. Drizzle schema (schema.ts) →
2. drizzle-zod generates Zod schemas →
3. Zod schemas (db-schemas.ts) →
4. OpenAPI routes (auth.schema.ts) →
5. OpenAPI JSON (openapi.json) →
6. TypeScript SDK types (api-client.d.ts)

After modifying API schemas or routes, regenerate the OpenAPI spec and TypeScript SDK for the demo app:

```bash
# Generate OpenAPI spec + demo app SDK types
pnpm run generate:sdk

# Or just generate the OpenAPI spec
pnpm run generate:openapi
```

This creates:

- `openapi.json` - OpenAPI 3.1 spec with all endpoints
- `demo-app/src/lib/api-client.d.ts` - TypeScript types for the frontend

## 📖 API Endpoints

- `GET /health` - Health check
- `POST /v1/auth/register` - User registration
- `POST /v1/auth/login` - User login
- `POST /v1/auth/refresh` - Refresh token
- `POST /v1/auth/logout` - Logout
- `GET /v1/auth/me` - Current user info

See [docs/plan.md](docs/plan.md) for complete API documentation.

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome!

## 📄 License

MIT
├── wrangler.toml # Cloudflare Workers config
├── Pulumi.yaml # Pulumi project config
└── package.json

````

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Cloudflare account
- Pulumi account (for IaC)

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
````

2. **Configure Pulumi:**

   ```bash
   cd infrastructure
   pulumi login
   pulumi stack init dev
   pulumi config set cloudflareAccountId YOUR_ACCOUNT_ID
   ```

3. **Provision infrastructure:**

   ```bash
   pnpm run pulumi:up
   ```

   This creates:

   - D1 database (`auth-db`)
   - KV namespaces (rate limiter, token blacklist, session cache)

4. **Update wrangler.toml** with Pulumi outputs:

   - Copy D1 database ID
   - Copy KV namespace IDs

5. **Initialize D1 database:**

   ```bash
   wrangler d1 execute auth-db --file=db/schema.sql
   ```

6. **Set secrets:**

   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put ENCRYPTION_KEY
   wrangler secret put OAUTH_GITHUB_CLIENT_ID
   wrangler secret put OAUTH_GITHUB_CLIENT_SECRET
   # ... etc
   ```

7. **Run locally:**
   ```bash
   pnpm run dev
   ```

### Demo Application

A Qwik v2 demo application is included for visual testing:

```bash
cd demo-app
pnpm install
pnpm run dev
```

The demo app provides UI for:

- Registration/login flows
- OAuth integrations
- Organization/team management
- Permission testing
- Email preview

## Development

### Commands

```bash
pnpm run dev          # Start local dev server (wrangler)
pnpm run build        # Build for production
pnpm test             # Run tests
pnpm run test:unit    # Unit tests only
pnpm run test:integration  # Integration tests only
pnpm run pulumi:preview    # Preview infrastructure changes
pnpm run pulumi:up         # Apply infrastructure changes
pnpm run deploy       # Deploy to Cloudflare (requires wrangler login)
```

### Email Templates

Email templates use MJML for responsive design:

1. Edit templates in `src/templates/mjml/`
2. Compile with `pnpm run build:emails`
3. Outputs go to `src/templates/compiled/`

### Permission Model

Permissions use a **superset approach**:

- Organization owners can grant permissions they possess
- Permissions are scoped hierarchically: Global → Org → Team
- Bitmaps stored as integers for efficient checks

Example permission bits:

```typescript
PermissionBitmap.GLOBAL.MANAGE_USERS; // Global: manage all users
PermissionBitmap.ORG.INVITE_USERS; // Org: invite users to org
PermissionBitmap.TEAM.VIEW_MEMBERS; // Team: view team members
```

## API Endpoints

All endpoints are versioned (`/v1/*`):

### Authentication

- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - Login with email/password
- `POST /v1/auth/refresh` - Refresh access token
- `POST /v1/auth/logout` - Logout (blacklist token)
- `GET /v1/auth/me` - Get current user info

### OAuth

- `GET /v1/auth/oauth/:provider` - Initiate OAuth flow
- `GET /v1/auth/oauth/:provider/callback` - OAuth callback

### Organizations

- `POST /v1/organizations` - Create organization
- `GET /v1/organizations` - List user's organizations
- `GET /v1/organizations/:id` - Get organization details
- `PATCH /v1/organizations/:id` - Update organization
- `DELETE /v1/organizations/:id` - Delete organization

### Teams

- `POST /v1/organizations/:orgId/teams` - Create team
- `GET /v1/organizations/:orgId/teams` - List teams
- `PATCH /v1/teams/:id` - Update team
- `DELETE /v1/teams/:id` - Delete team

### Users & Permissions

- `POST /v1/organizations/:orgId/users` - Invite user to org
- `PATCH /v1/organizations/:orgId/users/:userId` - Update user permissions
- `DELETE /v1/organizations/:orgId/users/:userId` - Remove user from org

## Multi-Domain Support

Organizations can configure custom domains with branding:

```typescript
// domain_configs table
{
  organization_id: "org-123",
  domain: "auth.company.com",
  logo_url: "https://cdn.company.com/logo.png",
  primary_color: "#FF6B35",
  company_name: "Acme Corp",
  from_email: "noreply@company.com",
  cors_origins: ["https://app.company.com"]
}
```

## Deployment

### Production Deployment

1. **Deploy infrastructure:**

   ```bash
   pulumi stack select prod
   pnpm run pulumi:up
   ```

2. **Set production secrets** (via wrangler or Cloudflare dashboard)

3. **Deploy worker:**

   ```bash
   pnpm run deploy
   ```

4. **Configure custom domain** in Cloudflare dashboard

### CI/CD

GitHub Actions workflow example:

```yaml
- name: Deploy to Cloudflare
  run: |
    pnpm run pulumi:up -- --yes
    pnpm run deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

## Testing

- **Unit tests**: Test individual functions/services
- **Integration tests**: Test API endpoints end-to-end
- **Demo app**: Manual testing with visual UI

```bash
pnpm test              # Run all tests
pnpm run test:coverage # Generate coverage report
```

## Security Considerations

- JWT secrets stored in Cloudflare secrets (encrypted at rest)
- Passwords hashed with Argon2id
- Rate limiting on authentication endpoints
- Token blacklist for logout invalidation
- CORS configured per domain
- SQL injection prevention via parameterized queries
- Audit logging for security events

## Performance

- **Edge deployment**: Sub-50ms response times globally
- **D1 database**: SQLite on Cloudflare's edge
- **KV caching**: Session data cached at edge
- **Zero cold starts**: V8 isolates vs containers

## License

MIT

## Contributing

See PLAN.md for development phases and roadmap.

## Support

For issues or questions, please open a GitHub issue.
