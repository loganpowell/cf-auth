# Admin Dashboard API

Complete platform administration interface for managing tenants, API keys, and usage metrics across the multi-tenant system.

## Overview

The Admin Dashboard API provides platform administrators with comprehensive tools to:

- **Tenant Management**: Create, read, update, and soft-delete tenants
- **API Key Management**: Generate, list, and revoke API keys for each tenant
- **Usage Metrics**: View real-time platform usage and per-tenant metrics
- **Hierarchical Tenants**: Support for multi-level tenant structures (up to 5 levels deep)
- **Audit Trail**: Complete logging of all administrative operations

## Authentication

All Admin Dashboard endpoints require **platform admin API key** with:
- Type: `secret`
- Tenant: `relish-platform` (system tenant)
- Environment: `live` or `test`

```bash
curl -H "Authorization: Bearer sk_secret_..." \
  https://api.yourdomain.com/admin/dashboard
```

## Endpoints

### Dashboard Metrics

#### GET /admin/dashboard

Get platform overview with key metrics.

**Response:**
```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "metrics": {
    "activeTenants": 42,
    "activeAPIKeys": 156,
    "totalUsers": 1200,
    "environment": "production"
  }
}
```

### Tenant Management

#### POST /admin/tenants

Create a new tenant with auto-generated API keys.

**Request:**
```json
{
  "slug": "acme-corp",
  "name": "ACME Corporation",
  "plan": "pro",
  "parent_id": null
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "tenant": {
      "id": "tenant:acme-corp",
      "slug": "acme-corp",
      "name": "ACME Corporation",
      "plan": "pro",
      "status": "active",
      "depth": 0,
      "parent_id": null
    },
    "credentials": {
      "publicKey": {
        "prefix": "pk_live_abc123"
      },
      "secretKey": {
        "prefix": "sk_live_def456",
        "secret": "sk_live_def456_xyzabc123...xxxxx"
      }
    }
  }
}
```

**Field Validation:**
- `slug`: Lowercase alphanumeric + hyphens, 3-50 chars, must be unique
- `name`: 1-200 characters
- `plan`: One of `free`, `pro`, `enterprise`
- `parent_id`: Optional, for creating sub-tenants

**Hierarchy Rules:**
- Maximum depth: 5 levels
- Sub-tenant inherits some permissions from parent
- Each level adds 1 to depth counter

---

#### GET /admin/tenants

List all tenants with pagination and filtering.

**Query Parameters:**
- `page` (default: 1) - Page number for pagination
- `limit` (default: 20) - Results per page
- `status` (default: "active") - Filter by status: `active`, `deleted`, `suspended`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "tenant:acme-corp",
      "slug": "acme-corp",
      "name": "ACME Corporation",
      "plan": "pro",
      "status": "active",
      "created_at": 1705315200,
      "updated_at": 1705315200
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  }
}
```

---

#### GET /admin/tenants/:id

Get detailed information about a specific tenant.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "tenant:acme-corp",
    "slug": "acme-corp",
    "name": "ACME Corporation",
    "plan": "pro",
    "status": "active",
    "created_at": 1705315200,
    "updated_at": 1705315200,
    "stats": {
      "apiKeys": 5,
      "users": 230
    }
  }
}
```

---

#### PUT /admin/tenants/:id

Update tenant properties (plan, branding, limits).

**Request:**
```json
{
  "plan": "enterprise",
  "branding": {
    "logo_url": "https://example.com/logo.png",
    "color": "#FF0000"
  },
  "limits": {
    "requests_per_month": 1000000,
    "concurrent_users": 500
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tenant updated"
}
```

---

#### DELETE /admin/tenants/:id

Soft delete a tenant (preserves data for audit trail).

**Response:**
```json
{
  "status": "success",
  "message": "Tenant deleted"
}
```

**Note:** Data remains in database, status changes to "deleted". Can be restored by updating status back to "active".

### API Key Management

#### GET /admin/tenants/:id/keys

List all API keys for a specific tenant.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "key:uuid",
      "tenant_id": "tenant:acme-corp",
      "name": "Production API Key",
      "key_prefix": "sk_live_abc123",
      "type": "secret",
      "environment": "live",
      "created_at": 1705315200,
      "revoked_at": null
    },
    {
      "id": "key:uuid2",
      "tenant_id": "tenant:acme-corp",
      "name": "Test API Key",
      "key_prefix": "sk_test_def456",
      "type": "secret",
      "environment": "test",
      "created_at": 1705401600,
      "revoked_at": null
    }
  ]
}
```

**Important:** `key_hash` and `secret` are never included in list responses - these are secrets!

---

#### POST /admin/tenants/:id/keys

Create a new API key for a tenant.

**Request:**
```json
{
  "type": "secret",
  "environment": "live",
  "name": "Webhook Processor",
  "permissions": ["read:data", "write:logs"]
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": "key:uuid",
    "prefix": "sk_live_abc123",
    "secret": "sk_live_abc123_xyzdef123...xxxxx",
    "type": "secret",
    "environment": "live"
  }
}
```

**Important:** The `secret` is only shown once in the creation response. Store it securely. It cannot be retrieved later.

**Key Type Reference:**
| Type | Usage | Permissions |
|------|-------|-------------|
| `public` | Client-side (browsers) | Limited (read-only typically) |
| `secret` | Backend servers | Full access |

**Environments:**
- `live`: Production environment
- `test`: Testing environment (higher rate limits, sandbox features)

### Usage Metrics

#### GET /admin/metrics

Get platform-wide usage metrics grouped by type.

**Response:**
```json
{
  "status": "success",
  "data": {
    "api_requests": [
      {
        "tenant_id": "tenant:acme-corp",
        "metric_type": "api_requests",
        "value": 15420,
        "period": "2024-01-15",
        "recorded_at": 1705315200
      }
    ],
    "bandwidth_used": [
      {
        "tenant_id": "tenant:acme-corp",
        "metric_type": "bandwidth_used",
        "value": 524288000,
        "unit": "bytes",
        "period": "2024-01-15",
        "recorded_at": 1705315200
      }
    ],
    "users_active": [
      {
        "tenant_id": "tenant:acme-corp",
        "metric_type": "users_active",
        "value": 156,
        "period": "2024-01-15",
        "recorded_at": 1705315200
      }
    ]
  }
}
```

## Error Responses

All errors follow standard format:

```json
{
  "status": "error",
  "error": "Descriptive error message"
}
```

**Common Error Codes:**

| Code | Reason | Action |
|------|--------|--------|
| 400 | Invalid request (validation failure) | Check request format and values |
| 401 | Missing or invalid API key | Verify authentication header |
| 403 | Insufficient permissions | Use platform admin key only |
| 404 | Resource not found | Verify resource ID exists |
| 409 | Conflict (e.g., duplicate slug) | Change the conflicting value |
| 500 | Server error | Contact support, check logs |

**Example Error Response:**
```json
{
  "status": "error",
  "error": "slug already exists"
}
```

## Security Considerations

### API Key Security

- **Never log API secrets** - Only log prefixes (e.g., `sk_live_abc123...`)
- **Show secret once** - Secrets are only displayed in creation response
- **Hash storage** - Secrets hashed with argon2 before storage
- **Revocation** - Revoked keys cannot be used immediately but data is preserved

### Tenant Isolation

- All requests are tenant-scoped using API key
- Platform admin key has access across all tenants
- Tenant keys cannot access other tenants' data
- Namespace prefixes prevent data leakage at database level

### Rate Limiting

Admin endpoints have lenient rate limits (designed for occasional administrative tasks):
- 100 requests/minute per API key
- Burst allowance: 20 requests/second

Regular API requests (using user API keys) have stricter limits per plan.

## Examples

### Create Sub-tenant Structure

```bash
# Create main tenant
curl -X POST https://api.yourdomain.com/admin/tenants \
  -H "Authorization: Bearer sk_secret_..." \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "acme",
    "name": "ACME Corporation",
    "plan": "enterprise"
  }'

# Response includes tenant ID: "tenant:acme"

# Create department sub-tenant
curl -X POST https://api.yourdomain.com/admin/tenants \
  -H "Authorization: Bearer sk_secret_..." \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "acme-engineering",
    "name": "ACME Engineering Dept",
    "plan": "pro",
    "parent_id": "tenant:acme"
  }'
```

### Generate API Keys

```bash
# Create secret key for backend service
curl -X POST https://api.yourdomain.com/admin/tenants/tenant:acme/keys \
  -H "Authorization: Bearer sk_secret_..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "secret",
    "environment": "live",
    "name": "Backend Service"
  }'

# Create public key for frontend
curl -X POST https://api.yourdomain.com/admin/tenants/tenant:acme/keys \
  -H "Authorization: Bearer sk_secret_..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "public",
    "environment": "live",
    "name": "Frontend Web App"
  }'
```

### View Tenant Metrics

```bash
# Get dashboard overview
curl https://api.yourdomain.com/admin/dashboard \
  -H "Authorization: Bearer sk_secret_..."

# List all tenants
curl "https://api.yourdomain.com/admin/tenants?page=1&limit=50&status=active" \
  -H "Authorization: Bearer sk_secret_..."

# View specific tenant
curl https://api.yourdomain.com/admin/tenants/tenant:acme \
  -H "Authorization: Bearer sk_secret_..."
```

## Integration with Other Systems

### Tenant Router Middleware

The Admin API integrates with the tenant router middleware:
- Creates tenants that become available for routing
- API keys stored in database for lookup during request validation
- Tenant context automatically injected into request handlers

### Database Schema

Uses D1 tables:
- `tenants` - Tenant records with hierarchy info
- `api_keys` - API keys with type and permissions
- `accounts` - User accounts linked to tenants
- `usage_metrics` - Aggregated usage data per tenant per period

## Best Practices

### Key Rotation

1. Generate new API key before expiration
2. Update client configuration with new key
3. Revoke old key after grace period
4. Monitor revoked key usage to detect issues

### Sub-tenant Organization

- Use hierarchical structure for large organizations
- Department-level tenants inherit billing from parent
- Project-level tenants under departments
- Maximum 5 levels deep

### Monitoring

- Regularly check dashboard metrics
- Set up alerts for usage anomalies
- Review audit trail for security events
- Monitor API key creation/revocation patterns

## Testing

Run Admin Dashboard API tests:

```bash
npm run test -- admin-dashboard.test.ts
```

Tests verify:
- Tenant CRUD operations
- API key generation and security
- Input validation
- Hierarchical tenant creation
- Error handling
- Authentication and authorization

## Related Documentation

- [Authentication System](../../../docs/auth-architecture.md)
- [Multi-tenant Architecture](../../../docs/multi-tenant-migration/MULTI_TENANT_ARCHITECTURE.md)
- [API Key Management](./api-keys.md)
- [Tenant Routing](../middleware/tenant-router.ts)

## Support

For issues or questions about the Admin Dashboard API:
1. Check test cases for usage examples
2. Review error messages and codes above
3. Check auth logs for authentication failures
4. Contact platform team for access issues
