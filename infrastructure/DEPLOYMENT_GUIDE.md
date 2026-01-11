# Deployment Guide

## Prerequisites

Before deploying the infrastructure, you need to configure the following credentials and settings.

## Step 1: Set Up Environment

Create a `.env` file in the `infrastructure/` directory:

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
# Generate a secure passphrase
PULUMI_CONFIG_PASSPHRASE=$(openssl rand -base64 24)
```

## Step 2: Configure Pulumi Secrets

```bash
cd infrastructure
export PULUMI_CONFIG_PASSPHRASE="your-passphrase-from-env"

# Cloudflare Configuration
pulumi config set cloudflareAccountId "your-cloudflare-account-id"
pulumi config set --secret cloudflareApiToken "your-cloudflare-api-token"

# GitHub Repository (for OIDC)
pulumi config set githubRepository "your-org/your-repo"

# AWS Region
pulumi config set aws:region "us-east-1"

# Optional: Cloudflare Zone (for custom domains)
pulumi config set cloudflareZoneId "your-zone-id"  # Optional
```

### Finding Your Cloudflare Credentials

1. **Account ID**:

   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Click on any site or Workers & Pages
   - Account ID is in the right sidebar

2. **API Token**:
   - Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Create Token → Use template "Edit Cloudflare Workers"
   - Required permissions:
     - Account → D1 → Edit
     - Account → Workers KV Storage → Edit
     - Account → Workers R2 Storage → Edit
     - Account → Cloudflare Workers → Edit

## Step 3: Verify AWS Credentials

Ensure AWS CLI is configured:

```bash
aws configure list
# Should show credentials from ~/.aws/credentials
```

Or set environment variables:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

## Step 4: Install Dependencies

```bash
cd infrastructure
npm install
```

## Step 5: Preview Deployment

```bash
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"
pulumi preview
```

This will show you what resources will be created without actually creating them.

## Step 6: Deploy Infrastructure

```bash
pulumi up
```

Review the changes and confirm with "yes".

**Expected Resources:**

- ✅ AWS OIDC Provider (GitHub Actions)
- ✅ AWS IAM Roles (Platform Admin, Deployment)
- ✅ AWS SES Email Service
- ✅ Cloudflare D1 Database
- ✅ Cloudflare KV Namespaces (4)
- ✅ Cloudflare R2 Bucket
- ✅ Pulumi Stack Outputs (for wrangler.toml sync)

## Step 7: Sync Resource IDs to wrangler.toml

```bash
./update-wrangler.sh
```

This script:

1. Fetches resource IDs from Pulumi stack outputs
2. Updates `../wrangler.toml` with production IDs
3. Replaces placeholder values with real resource IDs

## Step 8: Apply D1 Migration (Production)

```bash
cd ..
npx wrangler d1 migrations apply auth-db --remote
```

**Tables Created:**

- tenants
- api_keys
- platform_admins
- accounts
- sessions
- tenant_data_schemas
- usage_metrics
- platform_admin_tenant_permissions
- verification_tokens

## Step 9: Deploy Worker with Durable Objects

```bash
npx wrangler deploy
```

This deploys:

- Auth Worker with Admin Dashboard API
- Durable Object classes: TenantState, GraphStateCSV
- All bindings: D1, KV (4), R2, DO (2)

## Step 10: Verify Deployment

```bash
# Check worker status
npx wrangler deployments list

# Get worker URL
npx wrangler deployments view

# Test health endpoint
curl https://your-worker.workers.dev/health
```

## Step 11: Create First Tenant

```bash
# First, create a platform admin API key
# This should be done via D1 directly for bootstrap

npx wrangler d1 execute auth-db --remote \
  --command "INSERT INTO platform_admins (id, email, name, role, created_at)
             VALUES ('admin_bootstrap', 'admin@example.com', 'Bootstrap Admin', 'super_admin', datetime('now'))"

npx wrangler d1 execute auth-db --remote \
  --command "INSERT INTO api_keys (id, key_id, key_prefix, key_hash, key_type, owner_type, owner_id, name, created_at)
             VALUES ('key_bootstrap', 'pk_live_...', 'sk_secret_', 'hash...', 'secret', 'platform_admin', 'admin_bootstrap', 'Bootstrap Key', datetime('now'))"

# Now use the API to create your first tenant
curl -X POST https://your-worker.workers.dev/admin/tenants \
  -H "Authorization: Bearer sk_secret_..." \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "acme-corp",
    "name": "ACME Corporation",
    "plan": "pro"
  }'
```

## Step 12: Upload CSV Files

Create initial CSV files for your first tenant:

```bash
# Create local CSV files
mkdir -p data/acme-corp

# member_of.csv
cat > data/acme-corp/member_of.csv << 'EOF'
id,source,target,type,permission,revoked_at
edge_001,user_alice,group_engineering,member_of,,
edge_002,user_bob,group_admin,member_of,,
EOF

# user_permissions.csv
cat > data/acme-corp/user_permissions.csv << 'EOF'
id,source,target,type,permission,revoked_at
edge_101,user_alice,resource_project_x,user_permission,read,
edge_102,user_bob,resource_admin_panel,user_permission,admin,
EOF

# Upload to R2
npx wrangler r2 object put tenant-data/acme-corp/member_of.csv \
  --file data/acme-corp/member_of.csv

npx wrangler r2 object put tenant-data/acme-corp/user_permissions.csv \
  --file data/acme-corp/user_permissions.csv
```

## Step 13: Test Durable Objects

```bash
# Get TenantState
curl https://your-worker.workers.dev/tenant-state/acme-corp

# Reload GraphStateCSV from R2
curl -X POST https://your-worker.workers.dev/graph-state/acme-corp/reload \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "acme-corp"}'

# Validate edge proof
curl -X POST https://your-worker.workers.dev/graph-state/acme-corp/validate \
  -H "Content-Type: application/json" \
  -d '{
    "edgeIds": ["edge_001", "edge_101"],
    "userId": "user_alice",
    "resourceId": "resource_project_x"
  }'
```

## Troubleshooting

### Error: "Missing required configuration"

```bash
pulumi config set <key> <value>
```

### Error: "Invalid Cloudflare credentials"

Regenerate API token with correct permissions:

- Account → D1 → Edit
- Account → Workers KV Storage → Edit
- Account → Workers R2 Storage → Edit

### Error: "D1 database not found"

Run `./update-wrangler.sh` to sync resource IDs.

### Error: "Durable Object class not found"

Ensure `src/index.ts` exports DO classes:

```typescript
export { TenantState } from "./durable-objects/TenantState";
export { GraphStateCSV } from "./durable-objects/GraphStateCSV";
```

## Clean Up (Optional)

To destroy all infrastructure:

```bash
cd infrastructure
pulumi destroy
```

⚠️ **Warning**: This will delete all data, databases, and resources. Cannot be undone.

## Next Steps

Once deployed:

1. Build Admin Dashboard UI (Next.js frontend)
2. Set up monitoring (Cloudflare Analytics, custom metrics)
3. Configure alerting (email/Slack notifications)
4. Add CI/CD pipeline (GitHub Actions)
5. Set up staging environment (separate Pulumi stack)

## Support

- [Pulumi Docs](https://www.pulumi.com/docs/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
