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

# Email Routing configuration (required for sending emails)
pulumi config set auth-service:emailFromAddress noreply@yourdomain.com
pulumi config set auth-service:emailFromName "Auth Service"

# Optional: Set Zone ID for custom domains
# pulumi config set auth-service:cloudflareZoneId YOUR_ZONE_ID
```

### 2. Enable Email Routing (Required for Email Sending)

**Before deploying**, you must enable Email Routing in Cloudflare:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain
3. Navigate to **Email** → **Email Routing**
4. Click **Enable Email Routing**
5. Verify your sender email address (must match `emailFromAddress` config)

See [EMAIL_ROUTING_SETUP.md](../docs/EMAIL_ROUTING_SETUP.md) for detailed instructions.

### 3. Preview Infrastructure

```bash
pulumi preview
```

This will show you what resources will be created:

- D1 Database (`auth-db`)
- KV Namespace: Rate Limiter
- KV Namespace: Token Blacklist
- KV Namespace: Session Cache
- Email Routing Settings (configuration only)

### 4. Deploy Infrastructure

```bash
pulumi up
```

Review the changes and confirm to provision the resources.

### 5. Update wrangler.toml

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

**Email settings** are already in wrangler.toml via the `[[send_email]]` binding.

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

| Resource      | Purpose                        | Binding Name      |
| ------------- | ------------------------------ | ----------------- |
| D1 Database   | SQLite database for auth data  | `DB`              |
| KV Namespace  | Rate limiting counters         | `RATE_LIMITER`    |
| KV Namespace  | Blacklisted JWTs on logout     | `TOKEN_BLACKLIST` |
| KV Namespace  | Session and permission caching | `SESSION_CACHE`   |
| Email Routing | Transactional email sending    | `SEND_EMAIL`      |

**Note**: Email Routing requires manual setup in Cloudflare Dashboard before deployment.

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

### Email Sending Not Working

1. Verify Email Routing is enabled in Cloudflare Dashboard
2. Check sender email address is verified
3. Confirm `EMAIL_FROM` in wrangler.toml matches verified address
4. See [EMAIL_ROUTING_SETUP.md](../docs/EMAIL_ROUTING_SETUP.md) for troubleshooting

### State File Location

Local state is stored in: `~/.pulumi/stacks/`

## Next Steps

After infrastructure is provisioned:

1. **Enable Email Routing** (if not done): See [EMAIL_ROUTING_SETUP.md](../docs/EMAIL_ROUTING_SETUP.md)
2. Update `../wrangler.toml` with resource IDs from `pulumi stack output`
3. Initialize D1 database: `wrangler d1 execute auth-db --file=../db/schema.sql`
4. Configure email settings in wrangler.toml (EMAIL_FROM, FROM_NAME)
5. Start local development: `pnpm run dev` (from project root)

## Email Routing Migration

**Note**: As of August 31, 2024, MailChannels sunset their free service. This infrastructure now uses **Cloudflare Email Routing**, which is:

- ✅ Native Cloudflare integration
- ✅ No API keys needed (uses Worker bindings)
- ✅ Built-in DMARC/SPF/DKIM support
- ✅ Free tier: 100 emails/day

See [EMAIL_ROUTING_SETUP.md](../docs/EMAIL_ROUTING_SETUP.md) for complete setup instructions.
