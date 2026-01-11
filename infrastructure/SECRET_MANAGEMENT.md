# Secret Management with Pulumi (Current Setup)

Since you're on Pulumi v3.86.0, we'll use Pulumi's built-in secret management with the existing IAM role for AWS integration.

## Current Architecture

```
┌─────────────────────┐
│   Pulumi Config     │
│  (encrypted)        │
└──────────┬──────────┘
           │
           ├─► Cloudflare Worker Secrets
           │   └─► JWT_SECRET (managed by Pulumi)
           │
           └─► AWS Secrets (via IAM role)
               └─► SES Credentials from Secrets Manager
```

## Step 1: Set JWT Secret in Pulumi

```bash
cd infrastructure

# Set JWT secret (Pulumi will encrypt it)
pulumi config set --secret jwtSecret "YOUR_CURRENT_JWT_SECRET"
```

To get your current JWT secret, you'll need to retrieve it from where it's stored or generate a new one:

```bash
# Option 1: Generate a new one
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 2: If you have the old one, use it for continuity
```

## Step 2: Deploy Infrastructure

```bash
cd infrastructure

# Preview changes (shows JWT secret will be created)
pulumi preview

# Deploy (creates WorkerSecret resource)
pulumi up
```

This will create the `JWT_SECRET` as a Cloudflare Worker Secret, managed by Pulumi.

## Step 3: Remove Manual Secret

Once Pulumi is managing it, you can verify:

```bash
# Check Pulumi created it
pulumi stack output jwtSecretName

# Verify in Cloudflare
wrangler secret list
```

## Step 4: Update Deployment Workflow

### Current Workflow (Manual)

```bash
# Old way - manual secret management
wrangler secret put JWT_SECRET
wrangler deploy
```

### New Workflow (IaC)

```bash
# 1. Update infrastructure (if secrets/resources change)
cd infrastructure
pulumi up

# 2. Deploy code (secrets already set)
cd ..
wrangler deploy
```

## Benefits

✅ **Version Controlled**: Infrastructure code tracks what secrets exist (not values)  
✅ **Encrypted Storage**: Pulumi encrypts secrets in state  
✅ **Automated Deployment**: No manual secret configuration  
✅ **AWS Integration**: IAM role pulls SES creds from Secrets Manager  
✅ **Audit Trail**: Pulumi logs show when secrets are updated

## Secret Rotation

### Rotating JWT Secret

```bash
cd infrastructure

# Generate new secret
NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Update in Pulumi
pulumi config set --secret jwtSecret "$NEW_SECRET"

# Deploy new secret
pulumi up

# Worker automatically gets new secret on next deployment
wrangler deploy
```

### Rotating AWS Credentials

AWS credentials come from Secrets Manager via the IAM role:

```bash
# Update in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id cf-auth/ses-credentials-dev \
  --secret-string '{"AWS_ACCESS_KEY_ID":"...","AWS_SECRET_ACCESS_KEY":"..."}'

# No Pulumi changes needed - role pulls latest automatically
```

## Current Secrets Inventory

### Managed by Pulumi (After Deployment)

- ✅ `JWT_SECRET` - Cloudflare Worker Secret (in code, ready to deploy)
- ✅ AWS IAM Role - For OIDC/Secrets Manager access
- ✅ SES Credentials Secret ARN - Reference to Secrets Manager

### Managed by Wrangler (Current)

- ⏳ `JWT_SECRET` - Will be replaced by Pulumi-managed version

### Retrieved Dynamically

- ✅ SES Credentials - Pulled from AWS Secrets Manager by IAM role

## Environment Variables in Worker

Your worker can access secrets via:

```typescript
// JWT_SECRET (from Pulumi-managed Worker Secret)
const jwtSecret = env.JWT_SECRET;

// AWS credentials (from runtime binding or Pulumi outputs)
const awsAccessKeyId = env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = env.AWS_SECRET_ACCESS_KEY;
```

## Quick Reference Commands

```bash
# Set a secret in Pulumi
pulumi config set --secret <key> "<value>"

# View config (secrets shown as [secret])
pulumi config

# Deploy infrastructure with secrets
pulumi up

# Check what secrets exist
pulumi stack output

# View stack outputs (needs passphrase)
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"
pulumi stack output --json
```

## Next Steps

1. **Set JWT secret in Pulumi**: `pulumi config set --secret jwtSecret "..."`
2. **Deploy infrastructure**: `pulumi up` (creates WorkerSecret)
3. **Deploy worker**: `wrangler deploy` (uses Pulumi-managed secret)
4. **Test**: Verify authentication still works
5. **Document**: Update team on new workflow

## Upgrade Path (Future)

When you upgrade Pulumi (v3.100+), you'll have access to Pulumi ESC with additional features:

- Centralized secret management UI
- OIDC provider integrations
- Dynamic secret generation
- Cross-environment secret sharing
- Enhanced audit logging

For now, this approach gives you:

- ✅ Infrastructure as Code
- ✅ Encrypted secret storage
- ✅ Automated deployment
- ✅ AWS integration via IAM role

Ready to deploy? Let me know if you want me to help set the JWT secret value!
