# Infrastructure Provisioning - Complete Guide

## Overview

This guide walks you through provisioning Cloudflare infrastructure for the auth service:

- ✅ D1 Database (SQLite)
- ✅ 3 KV Namespaces (rate limiting, token blacklist, session cache)

## Prerequisites

- Cloudflare account (free tier works)
- Pulumi CLI installed ✅
- Access to Cloudflare dashboard

---

## Option 1: Automated Setup (Recommended) 🚀

### Step 1: Run Interactive Setup

```bash
cd infrastructure
./setup.sh
```

The script will:

1. Open Cloudflare dashboard in your browser
2. Prompt for your Account ID
3. Open API tokens page
4. Prompt for your API Token
5. Configure Pulumi automatically

### Step 2: Preview Changes

```bash
pulumi preview
```

Review the resources that will be created.

### Step 3: Deploy

```bash
pulumi up
```

Type `yes` when prompted.

### Step 4: Update Configuration

```bash
./update-wrangler.sh
```

This automatically updates `../wrangler.toml` with production resource IDs.

### Step 5: Initialize Database

```bash
cd ..  # Back to project root
pnpm exec wrangler d1 execute auth-db --file=db/schema.sql
```

Verify tables:

```bash
pnpm exec wrangler d1 execute auth-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Step 6: Test

```bash
pnpm run dev
curl http://localhost:8787/health
```

---

## Option 2: Manual Setup

See **[SETUP.md](./SETUP.md)** for detailed manual instructions.

---

## What Gets Created

### D1 Database: `auth-db`

- Production SQLite database on Cloudflare's edge
- Includes all tables from `db/schema.sql`:
  - users
  - organizations
  - teams
  - permissions, roles, user_permissions, user_roles
  - oauth_providers, oauth_accounts
  - email_verification_tokens
  - password_reset_tokens
  - domain_configs
  - audit_logs

### KV Namespaces

1. **Rate Limiter** (`AUTH_RATE_LIMITER`)

   - Request rate limiting per IP/endpoint
   - TTL: 60-900 seconds

2. **Token Blacklist** (`AUTH_TOKEN_BLACKLIST`)

   - Invalidated JWT tokens (logout)
   - TTL: Token expiration time

3. **Session Cache** (`AUTH_CACHE`)
   - User session data
   - Permission caches
   - TTL: 300-3600 seconds

---

## Configuration Reference

### Pulumi Config Values

```bash
# Required
cloudflare:accountId           # Your Cloudflare Account ID
cloudflare:apiToken            # API Token (encrypted)
auth-service:cloudflareAccountId  # Same as accountId

# Optional
auth-service:cloudflareZoneId  # For custom domain routing
```

### View Current Config

```bash
pulumi config
```

### Update Config

```bash
pulumi config set <key> <value>
pulumi config set --secret <key> <value>  # For sensitive values
```

---

## Stack Outputs

After deployment, view outputs:

```bash
pulumi stack output
```

Example output:

```
Current stack outputs (5):
    OUTPUT                  VALUE
    d1DatabaseId            a1b2c3d4-e5f6-7890-abcd-ef1234567890
    outputs                 {...}
    rateLimiterKvId         1234567890abcdef1234567890abcdef
    sessionCacheKvId        fedcba0987654321fedcba0987654321
    tokenBlacklistKvId      abcdef1234567890abcdef1234567890
```

---

## Troubleshooting

### Error: "Account ID not found"

- Make sure you copied the **Account ID**, not a Zone ID
- Find it in Cloudflare dashboard → Workers & Pages → right sidebar

### Error: "Insufficient permissions"

Your API token needs these permissions:

- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > Workers Scripts > Edit

Create a new token at: https://dash.cloudflare.com/profile/api-tokens

### Error: "Resource already exists"

If you manually created resources, import them:

```bash
pulumi import cloudflare:index/d1Database:D1Database auth-db <database-id>
pulumi import cloudflare:index/workersKvNamespace:WorkersKvNamespace rate-limiter-kv <namespace-id>
```

### Error: "No space left on device" (D1)

D1 free tier limits:

- 10 GB storage per database
- 500 GB reads/day
- 50 GB writes/day

You're likely fine for development. If exceeded, upgrade to paid tier.

---

## Useful Commands

```bash
# View all stacks
pulumi stack ls

# Switch stack
pulumi stack select <stack-name>

# View stack info
pulumi stack

# View specific output
pulumi stack output d1DatabaseId

# Refresh state
pulumi refresh

# View resource details
pulumi stack --show-urns

# Export stack state
pulumi stack export > stack-backup.json

# Import stack state
pulumi stack import < stack-backup.json

# Destroy all resources (CAREFUL!)
pulumi destroy
```

---

## Cost Considerations

### Free Tier Limits (Cloudflare)

**D1 Database:**

- 10 GB storage
- 5 million reads/day
- 100,000 writes/day
- **Cost:** FREE (generous limits for development)

**KV Namespaces:**

- 1 GB storage across all namespaces
- 100,000 reads/day
- 1,000 writes/day
- **Cost:** FREE for low volume

**Workers:**

- 100,000 requests/day
- **Cost:** FREE for development

### Paid Tier (if needed)

- Workers Paid: $5/month (10M requests included)
- D1: Pay as you grow (starts at $0)
- KV: $0.50/GB storage + usage

**For this project:** Free tier is sufficient for development and small production deployments.

---

## Next Steps

After infrastructure is provisioned:

1. ✅ D1 database created and initialized
2. ✅ KV namespaces ready
3. ✅ wrangler.toml updated with production IDs
4. 🚀 **Ready for Phase 2: Core Authentication Implementation**

Proceed with:

- User registration handlers
- Login with JWT generation
- Password hashing
- Token refresh/logout
- Permission system implementation

---

## Security Notes

1. **API Token Storage**

   - Stored encrypted in Pulumi state
   - Never commit to Git
   - Rotate periodically

2. **Least Privilege**

   - API token has minimal required permissions
   - Scoped to specific resources

3. **State Management**

   - Pulumi state stored locally in `~/.pulumi/stacks/`
   - For teams, consider Pulumi Cloud or S3 backend

4. **Resource Access**
   - D1 and KV only accessible via Workers
   - No direct public access

---

## Support

- **Pulumi Docs:** https://www.pulumi.com/docs/
- **Cloudflare D1:** https://developers.cloudflare.com/d1/
- **Cloudflare KV:** https://developers.cloudflare.com/kv/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/

For project-specific issues, check:

- `README.md` (project root)
- `PLAN.md` (implementation plan)
- `PHASE1_SUMMARY.md` (phase 1 status)
