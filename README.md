# Auth Service

Production-ready authentication and authorization service built on Cloudflare's edge platform.

## 🎉 Current Status

**Phase 2: COMPLETE ✅** (with bonus email verification from Phase 3)

- ✅ Full JWT authentication system operational
- ✅ Email verification with AWS SES
- ✅ Qwik v2 demo application with all auth flows
- ✅ 10 authentication endpoints working
- ✅ Local development environment ready

See [PHASE2_COMPLETE.md](docs/PHASE2_COMPLETE.md) for detailed accomplishments.

> **Note**: Email sending now uses AWS SES for production-grade delivery. See [AWS_SES_SETUP.md](docs/AWS_SES_SETUP.md) for setup instructions.

## ✨ Features

### Currently Working

- 🔐 JWT-based authentication with refresh tokens
- 📧 Email verification with token-based flow
- 🎨 Qwik v2 demo application with reactive UI
- 🔒 Secure password hashing (PBKDF2)
- 💾 D1 database with proper schema
- 🚀 Edge-native on Cloudflare Workers

### Planned (Phase 3+)

- 👥 OAuth integration (GitHub, Google, Twitter)
- 🏢 Multi-tenant organizations with hierarchical permissions
- � MJML email templates
- 🌐 Multi-domain support
- � OAuth 2.1 Provider (be an OAuth provider yourself)

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
