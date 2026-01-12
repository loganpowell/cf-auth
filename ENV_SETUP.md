# Environment Variables Setup

This project uses a `.env` file for local development configuration. **Never commit `.env` to git** - it's already in `.gitignore`.

## Quick Setup

1. **Copy the example file:**

   ```bash
   cp .env.example .env
   ```

2. **Get your admin API key** from the database:

   ```bash
   # Option 1: Query D1 database directly
   npx wrangler d1 execute auth-db --command "SELECT * FROM api_keys WHERE permissions = '*'"

   # Option 2: Use admin script (if available)
   npm run admin:get-key
   ```

3. **Update `.env` with your values:**
   ```bash
   ADMIN_API_KEY=rk_live_YOUR_PREFIX:YOUR_SECRET_HASH
   BASE_URL=https://your-worker.workers.dev
   ```

## Required Variables

### Development

```bash
# Admin API Key (for testing)
ADMIN_API_KEY=rk_live_...

# Base URL for your deployed worker
BASE_URL=https://auth-service.your-workers.dev
```

### Production

For production, use Wrangler secrets instead:

```bash
wrangler secret put JWT_SECRET
wrangler secret put AWS_ACCESS_KEY_ID
wrangler secret put AWS_SECRET_ACCESS_KEY
```

## Scripts That Use .env

- **`scripts/e2e-test.sh`** - End-to-end testing (auto-loads .env)
- **Local development** - Wrangler reads .env for [vars]
- **Admin operations** - Any admin scripts

## Security Notes

✅ **Good Practices:**

- `.env` is in `.gitignore` (never commit it)
- Use `.env.example` for documentation
- Rotate keys regularly
- Use different keys for dev/staging/prod

❌ **Never:**

- Commit `.env` to git
- Share your `.env` file
- Use production keys in development
- Hardcode keys in scripts or docs

## Troubleshooting

**"ADMIN_API_KEY not found"**

- Make sure you copied `.env.example` to `.env`
- Verify the key exists in your database
- Check that `.env` is in the project root

**"Permission denied"**

- Make sure your API key has the correct permissions
- Check that it's not expired/revoked
- Verify the key format: `rk_live_PREFIX:SECRET`

**Scripts not loading .env**

- Some scripts auto-load (e.g., `e2e-test.sh`)
- For manual commands, use: `source .env` first
- Or prefix: `export $(grep -v '^#' .env | xargs)`

## Example .env File

```bash
# Copy this to .env and fill in your values

# Admin API
ADMIN_API_KEY=rk_live_abc123:def456789...
BASE_URL=https://auth-service.logan-607.workers.dev

# Development
ENVIRONMENT=development

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-key-here

# Email
EMAIL_FROM=noreply@yourdomain.com
AWS_REGION=us-east-1

# App URLs
APP_URL=http://localhost:5174
API_URL=http://localhost:8787
```

## Related Documentation

- [ADMIN_API_KEY.md](./ADMIN_API_KEY.md) - Admin API key usage
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing with API keys
- [.env.example](./.env.example) - Full example with all variables
