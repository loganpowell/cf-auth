# Quick Reference Card

## 🚀 Production URLs

```
Worker:         https://auth-service.logan-607.workers.dev
Health:         https://auth-service.logan-607.workers.dev/health
Admin API:      https://auth-service.logan-607.workers.dev/admin/*
Durable Objects: https://auth-service.logan-607.workers.dev/do/*
```

## 🔑 Admin API Key

```bash
export ADMIN_KEY="sk_live_b3BUwJF8cQHRmGOTNPtAVKvg22UBp:d98730fc6e18df352373d43a7fa0830a3cab3afc0c542139a36c8270813c4805"
```

## 📡 Common API Calls

```bash
# Health check
curl https://auth-service.logan-607.workers.dev/health | jq .

# List tenants
curl https://auth-service.logan-607.workers.dev/admin/tenants \
  -H "Authorization: Bearer $ADMIN_KEY" | jq .

# Create tenant
curl -X POST https://auth-service.logan-607.workers.dev/admin/tenants \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test","name":"Test Co","plan":"starter"}' | jq .

# Get TenantState
curl https://auth-service.logan-607.workers.dev/do/tenant-state/acme-corp | jq .

# Send mutation
curl -X POST https://auth-service.logan-607.workers.dev/do/tenant-state/acme-corp/mutation \
  -H "Content-Type: application/json" \
  -d '{"type":"test.event","payload":{"test":true}}' | jq .
```

## 🧪 Testing Commands

```bash
# Run all tests
npm test -- --run

# Run E2E production tests
./scripts/e2e-test.sh

# TypeScript check
npx tsc --noEmit

# Watch mode tests
npm test
```

## 🚢 Deployment Commands

```bash
# Deploy to production
npx wrangler deploy

# View logs
npx wrangler tail

# Run migrations
npx wrangler d1 migrations apply auth-db-dev --remote
```

## 🗄️ Database Commands

```bash
# List all tenants
npx wrangler d1 execute auth-db-dev --remote \
  --command "SELECT id, slug, name, status FROM tenants"

# List API keys
npx wrangler d1 execute auth-db-dev --remote \
  --command "SELECT id, tenant_id, key_prefix, type, environment FROM api_keys"

# Check table schema
npx wrangler d1 execute auth-db-dev --remote \
  --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='tenants'"
```

## 🔧 Utility Scripts

```bash
# Generate new admin API key
npx tsx scripts/create-admin-key.ts

# Update wrangler bindings
./scripts/update-wrangler.sh
```

## 📊 Status Check

```bash
# Quick health check
curl -s https://auth-service.logan-607.workers.dev/health | jq -r '.status'

# Test authentication
curl -s https://auth-service.logan-607.workers.dev/admin/debug/tenant \
  -H "Authorization: Bearer $ADMIN_KEY" | jq -r '.isValid'

# Count tenants
curl -s https://auth-service.logan-607.workers.dev/admin/tenants \
  -H "Authorization: Bearer $ADMIN_KEY" | jq '.data | length'
```

## 🐛 Troubleshooting

```bash
# Check worker logs (real-time)
npx wrangler tail --format pretty

# Verify D1 connection
npx wrangler d1 execute auth-db-dev --remote --command "SELECT 1"

# Test Durable Objects
curl https://auth-service.logan-607.workers.dev/do/tenant-state/test

# Check TypeScript errors
npx tsc --noEmit 2>&1 | head -n 20
```

## 📁 Important Files

```
./ADMIN_API_KEY.md              Admin API key documentation
./TESTING_GUIDE.md              Testing procedures
./scripts/e2e-test.sh           E2E test automation
./wrangler.toml                 Worker configuration
./drizzle/migrations/           Database migrations
../docs/multi-tenant-migration/WEEK_2_COMPLETE_SUMMARY.md
```

## 🆘 Quick Help

```bash
# Full help
npx wrangler --help

# D1 help
npx wrangler d1 --help

# Deploy help
npx wrangler deploy --help

# Test help
npm test -- --help
```

## ⚠️ Remember

- ✅ Always test locally before deploying: `npm test -- --run`
- ✅ Check TypeScript compilation: `npx tsc --noEmit`
- ✅ Run E2E tests after deploy: `./scripts/e2e-test.sh`
- ✅ Keep ADMIN_API_KEY.md secure (in .gitignore)
- ⚠️ R2 bucket needs API token permissions update
