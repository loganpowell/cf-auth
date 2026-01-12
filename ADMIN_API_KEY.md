# Admin API Key

## ✅ API Key Authentication Working

The admin API key authentication has been fixed and is now working correctly!

### Bootstrap Admin API Key

**Setup:**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your admin API key from the database:
   ```bash
   npm run admin:get-key
   # Or query your D1 database directly
   ```

3. Add to `.env`:
   ```bash
   ADMIN_API_KEY=rk_live_YOUR_PREFIX:YOUR_SECRET_HASH
   BASE_URL=https://auth-service.your-workers.dev
   ```

**Example Key Structure:**
```
Full Key: rk_live_EXAMPLE_KEY_PREFIX:EXAMPLE_SECRET_HASH
Key ID: key_0b678e44ec2e6341
Tenant: tenant_000 (relish-platform)
Type: secret
Environment: live
Permissions: ["*"]
```

⚠️ **Security:** Never commit `.env` to git (it's in `.gitignore`)

### Usage

**Authorization Header Format:**

```
Authorization: Bearer {keyPrefix}:{keySecret}
```

**Example Request:**

```bash
curl -X GET "https://auth-service.example.workers.dev/admin/tenants" \
  -H "Authorization: Bearer rk_live_YOUR_KEY_PREFIX:YOUR_SECRET_HASH"
```

### API Key Format

- **Public Keys:** `pk_{env}_{random32}` - No secret component
- **Secret Keys:** `sk_{env}_{random32}:{secret64}` - Requires secret component
- **Restricted Keys:** `rk_{env}_{random32}` - No secret component, limited permissions

### Fixes Applied

1. **Generated proper secret key** following format `sk_live_xxx:secret`
2. **Fixed tenant extraction** to check Authorization header before subdomain
3. **Added workers.dev domains** to main domain list to bypass subdomain extraction
4. **Fixed secret validation** to parse and validate the secret component
5. **Fixed requireKeyType middleware** to access `c.env.DB` instead of `c.db`
6. **Applied tenant middleware** to admin router for API key extraction

### Test Results

✅ Tenant context extraction from API key
✅ Secret key validation (SHA-256 hash comparison)
✅ Admin API authentication
✅ GET /admin/tenants returns tenant list
✅ requireKeyType("secret") middleware working

### Next Steps

1. ✅ Fix API Key Authentication
2. 🔄 Re-enable R2 Bucket (needs API token with R2 permissions)
3. ⏳ Test Durable Objects with CSV loading
4. ⏳ Create additional test tenants via Admin API
5. ⏳ Test TenantState WebSocket connections
