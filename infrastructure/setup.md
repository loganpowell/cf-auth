# Cloudflare Infrastructure Setup Guide

## Quick Setup (Interactive Script)

Run the interactive setup script:

```bash
cd infrastructure
./setup.sh
```

This will:

1. Guide you through getting your Cloudflare credentials
2. Configure Pulumi automatically
3. Prepare for infrastructure deployment

---

## Manual Setup

### 1. Get Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select any site or go to **Workers & Pages**
3. Find **Account ID** in the right sidebar
4. Copy the Account ID (32 hex characters)

### 2. Create Cloudflare API Token

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use template **"Edit Cloudflare Workers"** OR create custom with these permissions:
   - **Account > D1 > Edit**
   - **Account > Workers KV Storage > Edit**
   - **Account > Workers Scripts > Edit**
4. Click **Continue to summary** → **Create Token**
5. Copy the token (it won't be shown again!)

### 3. Configure Pulumi

```bash
cd infrastructure

# Set Cloudflare provider credentials
pulumi config set cloudflare:accountId YOUR_ACCOUNT_ID
pulumi config set --secret cloudflare:apiToken YOUR_API_TOKEN

# Set project-specific config
pulumi config set auth-service:cloudflareAccountId YOUR_ACCOUNT_ID
```

**Optional:** If you want to use a custom domain:

```bash
pulumi config set auth-service:cloudflareZoneId YOUR_ZONE_ID
```

### 4. Preview Infrastructure Changes

```bash
pulumi preview
```

This will show you what resources will be created:

- 1 D1 Database (`auth-db`)
- 3 KV Namespaces (rate-limiter, token-blacklist, session-cache)

### 5. Deploy Infrastructure

```bash
pulumi up
```

Review the changes and confirm with `yes`.

### 6. Get Resource IDs

After deployment, get the resource IDs:

```bash
pulumi stack output
```

You'll see output like:

```
d1DatabaseId           : abc123...
rateLimiterKvId        : xyz789...
sessionCacheKvId       : def456...
tokenBlacklistKvId     : ghi012...
```

### 7. Update wrangler.toml

Copy the resource IDs to your `wrangler.toml` in the root directory:

```toml
# Replace database_id
[[d1_databases]]
binding = "DB"
database_name = "auth-db"
database_id = "abc123..."  # From pulumi stack output

# Replace KV namespace IDs
[[kv_namespaces]]
binding = "RATE_LIMITER"
id = "xyz789..."  # From pulumi stack output

[[kv_namespaces]]
binding = "TOKEN_BLACKLIST"
id = "ghi012..."  # From pulumi stack output

[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "def456..."  # From pulumi stack output
```

### 8. Initialize D1 Database

```bash
cd ..  # Back to root directory
pnpm exec wrangler d1 execute auth-db --file=db/schema.sql
```

Verify tables were created:

```bash
pnpm exec wrangler d1 execute auth-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 9. Test Production Configuration

```bash
pnpm run dev
```

---

## Troubleshooting

### "Account ID not found"

Make sure you copied the Account ID from the Cloudflare dashboard, not a Zone ID.

### "Insufficient permissions"

Your API token needs these scopes:

- Account > D1 > Edit
- Account > Workers KV Storage > Edit
- Account > Workers Scripts > Edit

### "Resource already exists"

If you've previously created resources, you can import them:

```bash
pulumi import cloudflare:index/d1Database:D1Database auth-db YOUR_DATABASE_ID
```

---

## Next Steps

After infrastructure is provisioned:

1. ✅ D1 database initialized with schema
2. ✅ KV namespaces ready for use
3. ✅ wrangler.toml updated with production resource IDs
4. 🚀 Ready for Phase 2: Core Authentication Implementation

---

## Useful Commands

```bash
# View current stack outputs
pulumi stack output

# View specific output
pulumi stack output d1DatabaseId

# Update a config value
pulumi config set auth-service:cloudflareAccountId NEW_VALUE

# View all config
pulumi config

# Destroy all resources (careful!)
pulumi destroy
```
