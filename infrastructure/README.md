# Infrastructure Setup

This directory contains the Pulumi Infrastructure as Code (IaC) for the auth service.

## 🚀 Quick Start (Automated)

**Recommended:** Use the interactive setup script:

```bash
cd infrastructure
./setup.sh
```

This will guide you through:

1. Getting your Cloudflare Account ID
2. Creating an API Token
3. Configuring Pulumi automatically

Then deploy:

```bash
pulumi up
./update-wrangler.sh  # Automatically updates wrangler.toml
```

For detailed manual setup, see **[SETUP.md](./SETUP.md)**

---

## Manual Quick Start

### 1. Configure Cloudflare Credentials

Get your Cloudflare Account ID from the Cloudflare dashboard (right sidebar).

```bash
cd infrastructure

# Set Cloudflare provider credentials
pulumi config set cloudflare:accountId YOUR_ACCOUNT_ID
pulumi config set --secret cloudflare:apiToken YOUR_API_TOKEN

# Set project-specific config
pulumi config set auth-service:cloudflareAccountId YOUR_ACCOUNT_ID

# Optional: Set Zone ID for custom domains
# pulumi config set auth-service:cloudflareZoneId YOUR_ZONE_ID
```

### 2. Preview Infrastructure

```bash
pulumi preview
```

This will show you what resources will be created:

- D1 Database (`auth-db`)
- KV Namespace: Rate Limiter
- KV Namespace: Token Blacklist
- KV Namespace: Session Cache

### 3. Deploy Infrastructure

```bash
pulumi up
```

Review the changes and confirm to provision the resources.

### 4. Update wrangler.toml

Automatically update wrangler.toml with production resource IDs:

```bash
./update-wrangler.sh
```

Or manually copy IDs from:

```bash
pulumi stack output
```

Copy these IDs to update `../wrangler.toml`:

- `d1DatabaseId` → D1 database binding
- `rateLimiterKvId` → RATE_LIMITER KV binding
- `tokenBlacklistKvId` → TOKEN_BLACKLIST KV binding
- `sessionCacheKvId` → SESSION_CACHE KV binding

## Stack Management

### View Current Stack

```bash
pulumi stack
```

### Switch Stacks

```bash
# Create production stack
pulumi stack init prod

# Switch between stacks
pulumi stack select dev
pulumi stack select prod
```

### Destroy Resources

```bash
pulumi destroy
```

## Configuration

All configuration is stored in `Pulumi.{stack}.yaml` files:

- `Pulumi.dev.yaml` - Development environment
- `Pulumi.prod.yaml` - Production environment (create when needed)

Secrets are encrypted and stored locally in the Pulumi state file.

## Resources Provisioned

| Resource     | Purpose                        | Binding Name      |
| ------------ | ------------------------------ | ----------------- |
| D1 Database  | SQLite database for auth data  | `DB`              |
| KV Namespace | Rate limiting counters         | `RATE_LIMITER`    |
| KV Namespace | Blacklisted JWTs on logout     | `TOKEN_BLACKLIST` |
| KV Namespace | Session and permission caching | `SESSION_CACHE`   |

## Troubleshooting

### Missing Passphrase

If you lose your Pulumi passphrase, you'll need to:

1. Destroy the stack: `pulumi destroy`
2. Remove the stack: `pulumi stack rm dev`
3. Recreate: `pulumi stack init dev`

### TypeScript Errors

```bash
pnpm install
```

### State File Location

Local state is stored in: `~/.pulumi/stacks/`

## Next Steps

After infrastructure is provisioned:

1. Update `../wrangler.toml` with resource IDs from `pulumi stack output`
2. Initialize D1 database: `wrangler d1 execute auth-db --file=../db/schema.sql`
3. Start local development: `pnpm run dev` (from project root)
