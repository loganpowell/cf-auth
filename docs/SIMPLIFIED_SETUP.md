# Simplified Setup Instructions

## Infrastructure Improvements Implemented ✅

### 1. Automated DNS Records via Route53

- ✅ Domain verification TXT record
- ✅ DKIM CNAME records (3 records)
- ✅ Mail FROM MX record
- ✅ SPF TXT record
- **No manual DNS configuration needed!**

### 2. Merged Base and Main Stacks

- ✅ Single `pulumi up` command
- ✅ OIDC providers included in main stack
- ✅ Automatic dependency management
- ✅ Faster, simpler deployment

### 3. Pulumi ESC for Secrets

- ✅ SES credentials stored in AWS Secrets Manager
- ✅ Pulumi ESC reads secrets at runtime
- ✅ No manual `wrangler secret put` commands
- ✅ Worker gets secrets automatically

## New Deployment Flow

### Prerequisites

- AWS CLI configured
- Pulumi CLI installed and logged in
- GitHub CLI installed and authenticated
- Domain hosted in Route53

### One-Command Setup

```bash
cd infrastructure
pulumi stack init dev
pulumi config set cloudflareAccountId <your-account-id>
pulumi config set githubRepository loganpowell/cf-auth
pulumi config set emailDomain rel.sh
pulumi config set emailFrom noreply@rel.sh
pulumi config set emailFromName "Your App"
pulumi up
```

### What Happens Automatically

1. Creates OIDC providers (GitHub Actions, Pulumi ESC)
2. Creates IAM roles with appropriate permissions
3. Creates D1 database and KV namespaces
4. Creates SES domain identity
5. **Adds all DNS records to Route53**
6. Creates SNS topics for notifications
7. Stores SES credentials in Secrets Manager
8. Configures Pulumi ESC to read secrets

### Worker Deployment

```bash
# Pulumi ESC injects secrets at runtime
wrangler deploy
```

## Benefits

### Before

- **15+ manual steps**
- Manual DNS configuration
- Manual secret management
- Two separate `pulumi up` commands
- Prone to human error

### After

- **3 commands total**
- DNS automated
- Secrets automated
- Single deployment
- Idempotent and reliable

## Pulumi ESC Configuration

The ESC environment (`loganpowell/cf-auth-prod`) provides:

```yaml
values:
  aws:
    login:
      fn::open::aws-login:
        oidc:
          roleArn: <pulumi-esc-role-arn>
          sessionName: pulumi-esc-session
          duration: 1h

  secrets:
    fn::open::aws-secrets:
      region: us-east-2
      login: ${aws.login}
      get:
        sesCredentials:
          secretId: cf-auth/ses-credentials-dev

  environmentVariables:
    AWS_REGION: us-east-2
    AWS_ACCESS_KEY_ID: ${secrets.sesCredentials.awsAccessKeyId}
    AWS_SECRET_ACCESS_KEY: ${secrets.sesCredentials.awsSecretAccessKey}
    JWT_SECRET: ${secrets.sesCredentials.jwtSecret}

  pulumiConfig:
    aws:region: us-east-2
```

## Migration from Old Setup

If you already have the old infrastructure:

```bash
# Option 1: Clean slate (recommended)
cd infrastructure/base
pulumi destroy
cd ..
pulumi destroy

# Then run new setup
pulumi up

# Option 2: Import existing resources
# (More complex, contact for assistance)
```

## Verification

After deployment:

```bash
# Check DNS records are created
pulumi stack output dnsRecordsCreated  # Should be true

# Check SES domain is verified (may take a few minutes)
aws ses get-identity-verification-attributes --identities rel.sh

# Test Pulumi ESC
pulumi env open loganpowell/cf-auth-prod

# Deploy worker
wrangler deploy
```

## Troubleshooting

### DNS Records Not Creating

**Issue**: Route53 hosted zone not found
**Solution**: Ensure `rel.sh` is hosted in Route53 in the same AWS account

### Pulumi ESC Not Working

**Issue**: OIDC authentication failing
**Solution**: Verify OIDC provider is created and role ARN is correct

### SES Still in Sandbox

**Issue**: Can only send to verified emails
**Solution**: Request production access in AWS Console (normal AWS process)

## Next Steps

1. ✅ Deploy infrastructure: `pulumi up`
2. ✅ Wait for DNS propagation (usually < 10 minutes)
3. ✅ Deploy worker: `wrangler deploy`
4. 🎯 Test email sending
5. 🎯 Request SES production access
