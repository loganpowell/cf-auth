# Infrastructure Management Workflow

This document explains how infrastructure is managed with Pulumi and what requires manual steps.

## 🏗️ Infrastructure Overview

### Managed by Pulumi (IaC)

All infrastructure resources are defined in `infrastructure/index.ts`:

**AWS Resources:**

- ✅ GitHub Actions OIDC Provider
- ✅ Pulumi ESC OIDC Provider
- ✅ IAM Roles and Policies
- ✅ AWS SES (Email service)
- ✅ Route53 DNS records (automated)
- ✅ Secrets Manager (SES credentials)

**Cloudflare Resources:**

- ✅ D1 Database (`auth-db-dev`)
- ✅ KV Namespaces (4):
  - RATE_LIMITER
  - TOKEN_BLACKLIST
  - SESSION_CACHE
  - MUTATION_LOG
- ✅ R2 Bucket (`tenant-data-dev`)
- ✅ Worker Secrets (`JWT_SECRET`)

**Worker Code:**

- ✅ Durable Objects (defined in wrangler.toml):
  - TenantState
  - GraphStateCSV

### NOT Managed by Pulumi

These require manual management:

**Database Migrations:**

- Managed by Drizzle ORM + wrangler
- Located in: `drizzle/migrations/`
- Applied with: `wrangler d1 execute auth-db-dev --remote --file=drizzle/migrations/*.sql`

**R2 Data:**

- CSV authorization files
- Uploaded manually or via CI/CD
- Example: `wrangler r2 object put tenant-data-dev/tenants/{id}/graph.csv --file=data.csv --remote`

**Worker Deployment:**

- Managed by wrangler CLI
- Deployed with: `wrangler deploy`

## 🚀 Deployment Workflow

### Initial Infrastructure Setup

```bash
cd infrastructure

# Configure Pulumi
pulumi config set cloudflareAccountId <your-account-id>
pulumi config set cloudflareApiToken <your-token> --secret
pulumi config set githubRepository <org>/<repo>

# Optional: Set custom JWT secret (otherwise auto-generated)
pulumi config set jwtSecret <your-secret> --secret

# Deploy infrastructure
pulumi up
```

This creates:

- All AWS resources (SES, IAM, OIDC)
- All Cloudflare resources (D1, KV, R2, Worker Secrets)
- DNS records automatically via Route53

### Database Schema Changes

When you modify `src/db/schema.ts`:

```bash
# Generate migration
npx drizzle-kit generate

# Apply to production
npx wrangler d1 execute auth-db-dev --remote --file=drizzle/migrations/XXXX_new_migration.sql
```

**Migration Files:**

- `0000_tranquil_hannibal_king.sql` - Initial schema (9 tables)
- `0001_youthful_gabe_jones.sql` - Tenant users and sessions (2 tables)

### Worker Code Deployment

```bash
# Deploy worker code
npx wrangler deploy

# Worker automatically uses:
# - D1 database from Pulumi
# - KV namespaces from Pulumi
# - R2 bucket from Pulumi
# - JWT_SECRET from Pulumi
```

### R2 CSV Data Upload

```bash
# Upload authorization graphs
npx wrangler r2 object put tenant-data-dev/tenants/tenant_000/graph.csv \
  --file=sample-data/graph-tenant_000.csv \
  --remote

# Reload graph in Durable Object
curl -X POST https://auth-service.logan-607.workers.dev/do/graph-state/tenant_000/reload
```

## 🔄 Update Workflow

### Infrastructure Changes (Pulumi)

1. **Update `infrastructure/index.ts`**

   - Add/modify resources
   - Update exports

2. **Deploy changes:**

   ```bash
   cd infrastructure
   pulumi up
   ```

3. **Update wrangler.toml if needed:**
   - Resource IDs are exported by Pulumi
   - Copy from `pulumi stack output`

### Application Changes (Code)

1. **Update source code** (`src/**`)

2. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

### Schema Changes (Database)

1. **Update schema:** `src/db/schema.ts`

2. **Generate migration:**

   ```bash
   npx drizzle-kit generate
   ```

3. **Review migration:** `drizzle/migrations/XXXX_*.sql`

4. **Apply to dev (local):**

   ```bash
   npx wrangler d1 execute auth-db-dev --local --file=drizzle/migrations/XXXX_*.sql
   ```

5. **Test locally:**

   ```bash
   npm run dev
   ```

6. **Apply to production:**
   ```bash
   npx wrangler d1 execute auth-db-dev --remote --file=drizzle/migrations/XXXX_*.sql
   ```

## 📋 Current Infrastructure State

### Pulumi Resources (Deployed)

```
Stack: dev
Cloudflare Account: logan-607
Worker: auth-service
URL: https://auth-service.logan-607.workers.dev
```

**Resources:**

- D1 Database: `e213ec49-0d7e-4821-a62e-c2cdd0a3f512`
- KV Namespaces: 4 (all bound to worker)
- R2 Bucket: `tenant-data-dev`
- JWT Secret: Configured via Pulumi

### Database Schema (11 Tables)

**Platform Infrastructure (7 tables):**

1. tenants
2. platform_admins
3. platform_admin_tenant_permissions
4. api_keys
5. tenant_data_schemas
6. usage_metrics
7. verification_tokens

**End-User Auth (2 tables):** 8. tenant_users 9. tenant_user_sessions

**Auth.js Adapter (2 tables):** 10. accounts 11. sessions

### Durable Objects (2)

Defined in `wrangler.toml`:

1. **TenantState** - Per-tenant state and WebSocket connections
2. **GraphStateCSV** - Authorization graph state from CSV

### R2 Data

Currently uploaded:

- `tenants/tenant_000/graph.csv` (17 edges)
- `tenants/acme-corp/graph.csv` (19 edges)

## 🔐 Secrets Management

### Via Pulumi

- **JWT_SECRET**: Managed by Pulumi WorkerSecret
  - Auto-generated if not provided
  - Set custom: `pulumi config set jwtSecret <value> --secret`

### Via Pulumi ESC (Future)

For CI/CD, use Pulumi ESC to inject secrets:

- AWS_ACCESS_KEY_ID (for SES)
- AWS_SECRET_ACCESS_KEY (for SES)
- CLOUDFLARE_API_TOKEN (for deployments)

## 🧪 Testing

```bash
# Unit/Integration tests
npm test -- --run

# E2E production tests
./scripts/e2e-test.sh
```

## 📚 Reference Commands

```bash
# Pulumi
pulumi up              # Deploy infrastructure
pulumi preview         # Preview changes
pulumi stack output    # View all outputs
pulumi destroy         # Tear down (careful!)

# Wrangler
wrangler deploy                    # Deploy worker
wrangler d1 execute                # Run SQL
wrangler r2 object put             # Upload to R2
wrangler secret put JWT_SECRET     # Manual secret (now via Pulumi!)

# Drizzle
npx drizzle-kit generate           # Generate migration
npx drizzle-kit studio             # Visual DB browser
```

## 🎯 Best Practices

1. **Always use Pulumi for infrastructure**

   - Don't manually create resources in Cloudflare dashboard
   - Import existing resources if needed

2. **Version control migrations**

   - Commit all migration files
   - Never edit applied migrations
   - Use Drizzle for schema changes

3. **Test before production**

   - Use `--local` flag for D1 migrations
   - Run E2E tests after deployment
   - Keep staging and prod separate

4. **Document manual steps**
   - CSV uploads
   - One-time configuration
   - Operational procedures

## 🔮 Future Improvements

- [ ] Automate CSV uploads via CI/CD
- [ ] Add staging environment
- [ ] Implement blue-green deployments
- [ ] Add rollback procedures
- [ ] Monitor infrastructure drift
- [ ] Add Pulumi ESC integration for all secrets
