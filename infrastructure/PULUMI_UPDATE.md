# Pulumi Infrastructure Update - JWT Secret

## Summary

The JWT_SECRET has been **added to Pulumi infrastructure management** but needs to be deployed.

## What Changed

### Code Changes

**File: `infrastructure/index.ts`**

- ✅ Added `import * as crypto from "crypto"`
- ✅ Added `cloudflare.WorkerSecret` resource for JWT_SECRET
- ✅ Auto-generates secure secret if not provided
- ✅ Exports `jwtSecretName` for reference
- ✅ Added to outputs section

## Current State

### Manual (Temporary)

- JWT_SECRET currently set via: `wrangler secret put JWT_SECRET`
- Value: `W4KTFCGVBfcSW4biS6v3Bp+rO222HS60tFCWXiS4jCA=`

### Pulumi (Once Deployed)

- JWT_SECRET will be managed by Pulumi
- Can be set with: `pulumi config set jwtSecret <value> --secret`
- Or auto-generated on first deploy

## Next Steps

### To Deploy This Change

```bash
cd infrastructure

# Option 1: Keep existing secret value
pulumi config set jwtSecret "W4KTFCGVBfcSW4biS6v3Bp+rO222HS60tFCWXiS4jCA=" --secret

# Option 2: Let Pulumi generate new one (will invalidate existing sessions)
# Just run pulumi up and it will auto-generate

# Deploy
pulumi up
```

### After Deployment

The JWT_SECRET will be:

- ✅ Managed in Pulumi state
- ✅ Automatically synced to Cloudflare Workers
- ✅ Version controlled (encrypted)
- ✅ Consistent across deployments

### Migration Path

1. **Current**: Manual secret via wrangler ✅ (deployed)
2. **Next**: Deploy Pulumi change to formalize management
3. **Future**: All secrets via Pulumi/ESC

## Infrastructure Files Updated

1. **infrastructure/index.ts** - Added JWT secret resource
2. **infrastructure/INFRASTRUCTURE_WORKFLOW.md** - Complete workflow documentation
3. **infrastructure/PULUMI_UPDATE.md** - This file

## Testing

After deploying the Pulumi change:

```bash
# Verify secret exists
pulumi stack output jwtSecretName

# Test authentication still works
curl -X POST "https://auth-service.logan-607.workers.dev/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_000" \
  -d '{"email": "test@example.com", "password": "SecurePass123"}' | jq .
```

## Benefits

- **Infrastructure as Code**: Secret definition in version control
- **Consistency**: Same secret across all deployments
- **Security**: Encrypted in Pulumi state
- **Automation**: No manual wrangler commands
- **Auditability**: Changes tracked in Pulumi history

## Notes

- Existing JWT tokens will remain valid
- No service disruption when deploying
- Secret value remains unchanged (if you set it explicitly)
- Can rotate by updating config and re-deploying
