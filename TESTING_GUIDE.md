# Testing Guide for Multi-Tenant Infrastructure

## ✅ Completed

### 1. API Key Authentication - WORKING

The admin API key authentication is fully functional.

**Admin API Key Setup:**

1. Copy environment template:

   ```bash
   cp .env.example .env
   ```

2. Set your admin key in `.env`:

   ```bash
   ADMIN_API_KEY=rk_live_YOUR_KEY:YOUR_SECRET
   BASE_URL=https://auth-service.your-workers.dev
   ```

3. Scripts will automatically load from `.env`

⚠️ **Note:** Get your actual admin key from the database. Never commit `.env`.

**Test Commands:**

```bash
# Load environment variables
source .env

# List all tenants
curl -s "$BASE_URL/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq .

# Create a new tenant
curl -s -X POST "$BASE_URL/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-tenant",
    "name": "Test Tenant",
    "plan": "pro"
  }' | jq .

# Get tenant details
curl -s "https://auth-service.logan-607.workers.dev/admin/tenants/tenant:acme-corp" \
  -H "Authorization: Bearer sk_live_b3BUwJF8cQHRmGOTNPtAVKvg22UBp:d98730fc6e18df352373d43a7fa0830a3cab3afc0c542139a36c8270813c4805" | jq .
```

**Verified:**

- ✅ API key format and hashing (SHA-256)
- ✅ Secret key validation
- ✅ Tenant context extraction from Authorization header
- ✅ `requireKeyType("secret")` middleware
- ✅ Admin Dashboard API endpoints
- ✅ Tenant creation via API
- ✅ Automatic API key generation for new tenants

**Existing Tenants:**

1. `tenant_000` (relish-platform) - Platform admin
2. `tenant:acme-corp` (acme-corp) - Test tenant created via API

## ⏳ Pending

### 2. R2 Bucket Configuration

**Status:** R2 bucket exists but binding is disabled in wrangler.toml

**Issue:** Cloudflare API token lacks R2 read/write permissions

**Steps to Enable:**

1. Update Cloudflare API token with R2 permissions
2. Uncomment R2 binding in wrangler.toml:
   ```toml
   [[r2_buckets]]
   binding = "TENANT_DATA"
   bucket_name = "tenant-data-dev"
   ```
3. Redeploy: `npx wrangler deploy`
4. Re-enable 21 skipped tests in durable-objects.test.ts

### 3. Durable Objects Testing

**Status:** Durable Objects deployed but no HTTP endpoints configured

**TenantState DO:**

- Per-tenant WebSocket hub for real-time updates
- Mutation broadcasting
- KV-backed persistence (MUTATION_LOG)

**GraphStateCSV DO:**

- CSV-based authorization graph from R2
- In-memory edge map for fast validation
- Requires R2 binding to function

**Testing Plan:**

1. Create HTTP endpoints for Durable Objects
2. Test TenantState:
   - WebSocket connections
   - Mutation broadcasting
   - State persistence
3. Test GraphStateCSV (after R2 enabled):
   - Upload CSV file to R2
   - Reload state from CSV
   - Validate edge chains
   - Test authorization queries

### 4. CSV File Upload for Authorization

**Format:** See [docs/authorization/csv-graph-format.md](docs/authorization/csv-graph-format.md)

**Example:**

```csv
subject,relation,object
org:acme,member,user:alice
org:acme,owner,user:bob
folder:docs,parent,org:acme
folder:docs,viewer,org:acme#member
file:budget,parent,folder:docs
```

**Upload Steps:**

1. Create CSV file with authorization graph
2. Upload to R2: `wrangler r2 object put tenant-data-dev/tenants/{tenant_id}/graph.csv --file graph.csv`
3. Trigger reload via GraphStateCSV DO
4. Test authorization queries

## 📊 Infrastructure Status

| Component         | Status      | Notes                                                      |
| ----------------- | ----------- | ---------------------------------------------------------- |
| D1 Database       | ✅ Live     | 9 tables migrated, bootstrap data loaded                   |
| KV Namespaces (4) | ✅ Live     | MUTATION_LOG, RATE_LIMITER, SESSION_CACHE, TOKEN_BLACKLIST |
| R2 Bucket         | ⚠️ Exists   | Binding disabled (API token issue)                         |
| TenantState DO    | ✅ Deployed | No HTTP endpoints yet                                      |
| GraphStateCSV DO  | ✅ Deployed | Requires R2 binding                                        |
| Worker            | ✅ Live     | https://auth-service.logan-607.workers.dev                 |
| Health Check      | ✅ Working  | /health endpoint                                           |
| Admin API         | ✅ Working  | Authentication fixed                                       |

## 🧪 Test Coverage

**Unit Tests:** 109 passing, 21 skipped (R2-dependent)
**Integration Tests:** ✅ All passing
**Admin API Tests:** ✅ Manual tests passing

**Test Execution:**

```bash
npm test -- --run
```

## 🔧 Troubleshooting

### API Key Not Working

- Verify format: `sk_live_xxx:secret` for secret keys
- Check Authorization header: `Bearer {key}`
- Verify key exists in D1: `SELECT * FROM api_keys WHERE key_prefix = 'sk_live_xxx'`
- Check key hash matches

### Subdomain Extraction Issues

- workers.dev domains bypass subdomain extraction
- Use Authorization header for API access
- Custom domains can use subdomain routing

### Durable Objects Not Accessible

- Ensure bindings are configured in wrangler.toml
- Check worker deployment logs
- Verify DO classes are exported from src/index.ts

### Durable Objects Storage Cleanup Warning

**Issue**: Tests show "Failed to pop isolated storage stack frame" error after running.

**Status**: This is a **known cosmetic issue** with `@cloudflare/vitest-pool-workers@0.12.1`.

**Details**:

- All 24 DO tests actually pass (marked with `·`)
- Error occurs during test cleanup, not during test execution
- Does not affect test results or functionality
- Cloudflare is aware: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage

**Workaround**: None needed - tests are passing correctly. The error can be safely ignored.

**Future**: Will be fixed in future vitest-pool-workers release.

## 📝 Next Development Phase

**Week 2 Goals (Current):**

- ✅ Multi-tenant infrastructure deployed
- ✅ Admin Dashboard API working
- ⏳ R2 bucket integration
- ⏳ Durable Objects testing
- ⏳ CSV-based authorization

**Week 3 Goals (Upcoming):**

- End-user authentication flows
- Session management
- Email verification
- Password reset
- Account endpoints
