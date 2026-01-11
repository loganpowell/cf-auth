# Pulumi ESC Setup Guide

Pulumi ESC (Environments, Secrets, and Configuration) provides centralized secret management with OIDC integration.

## Benefits

- ✅ **Centralized Secrets**: One place for all secrets (AWS, Cloudflare, JWT, etc.)
- ✅ **OIDC Integration**: No long-lived credentials needed
- ✅ **Dynamic Secrets**: Pull from AWS Secrets Manager, Vault, etc.
- ✅ **Version Control**: Track secret structure (not values) in git
- ✅ **Access Control**: Fine-grained permissions per environment
- ✅ **Audit Trail**: See who accessed secrets and when

## Architecture

```
┌─────────────────────┐
│   Pulumi ESC        │
│  (sungod-ai/auth)   │
└──────────┬──────────┘
           │
           ├─► AWS Secrets Manager (via OIDC)
           │   └─► SES Credentials
           │
           ├─► Direct Secrets (encrypted)
           │   └─► JWT_SECRET
           │
           └─► Cloudflare Worker
               └─► Injects secrets at deploy
```

## Initial Setup

### 1. Upgrade Pulumi CLI

ESC features require Pulumi v3.100+:

```bash
# Upgrade via Homebrew (macOS)
brew upgrade pulumi

# Verify version
pulumi version  # Should be 3.100+
```

### 2. Login to Pulumi Cloud

ESC requires Pulumi Cloud (not local file backend):

```bash
# Logout of local backend if needed
pulumi logout

# Login to Pulumi Cloud (opens browser)
pulumi login
```

### 3. Create Pulumi ESC Environment

```bash
cd infrastructure

# Create environment (use your org name)
pulumi env init loganpowell/cf-auth/dev

# Verify it was created
pulumi env ls
```

### 4. Configure Environment with VS Code

The easiest way to edit ESC environments is using VS Code:

```bash
# Open ESC environment in VS Code
EDITOR="code --wait" pulumi env edit loganpowell/cf-auth/dev
```

This will:

1. Create a temporary YAML file
2. Open it in VS Code
3. Wait for you to save and close
4. Upload the configuration to Pulumi Cloud

**Paste this starter configuration:**

```yaml
values:
  # Direct Secrets (encrypted by ESC)
  secrets:
    jwtSecret:
      fn::secret: "YOUR_JWT_SECRET"

  # Cloudflare Configuration
  cloudflare:
    accountId: "6078f37766de72dca3f0bc4b301891b8"
    apiToken:
      fn::secret: "YOUR_CLOUDFLARE_TOKEN"

  # Export as Pulumi config
  pulumiConfig:
    cloudflare:apiToken: ${cloudflare.apiToken}
    aws:region: us-east-2

  # Export as environment variables for worker
  environmentVariables:
    ENVIRONMENT: dev
    AWS_REGION: us-east-2
    JWT_SECRET: ${secrets.jwtSecret}
    CLOUDFLARE_API_TOKEN: ${cloudflare.apiToken}
```

**Generate a JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Get your Cloudflare token from `.env`:**

```bash
grep CLOUDFLARE_API_TOKEN .env
```

Then save and close the file - Pulumi will upload the configuration.

### 5. Verify Environment

```bash
# View environment (shows values without secrets)
pulumi env open loganpowell/cf-auth/dev

# Should show the structure with [secret] placeholders
```

### 2. Configure Environment (Alternative: Web UI)

You can also edit via the web UI at:
`https://app.pulumi.com/<your-org>/cf-auth-infrastructure/dev`

The template is in `esc-environment.yaml`. Configuration format:

```yaml
values:
  environmentVariables:
    ENVIRONMENT: dev
    AWS_REGION: us-east-2

  # AWS OIDC Login
  aws:
    login:
      fn::open::aws-login:
        oidc:
          roleArn: arn:aws:iam::YOUR_ACCOUNT:role/pulumi-esc-cf-auth-dev
          sessionName: pulumi-esc-session

  # AWS Secrets Manager
  sesCredentials:
    fn::open::aws-secrets:
      region: us-east-2
      login: \${aws.login}
      get:
        ses-creds:
          secretId: cf-auth/ses-credentials-dev

  # Application Secrets
  secrets:
    jwtSecret:
      fn::secret: "YOUR_JWT_SECRET_HERE"

  # Cloudflare Config
  cloudflare:
    accountId: "6078f37766de72dca3f0bc4b301891b8"
    apiToken:
      fn::secret: "YOUR_CLOUDFLARE_TOKEN"

  # Exports
  pulumiConfig:
    cloudflare:apiToken: \${cloudflare.apiToken}
    aws:region: \${environmentVariables.AWS_REGION}

  environmentVariables:
    JWT_SECRET: \${secrets.jwtSecret}
    AWS_ACCESS_KEY_ID: \${sesCredentials.ses-creds.AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: \${sesCredentials.ses-creds.AWS_SECRET_ACCESS_KEY}
```

### 3. Get Values from Current Setup

```bash
# Get Pulumi ESC Role ARN
cd infrastructure
pulumi stack output pulumiEscRoleArn

# Get SES Secret ARN
pulumi stack output sesCredentialsSecretArn

# Get current JWT secret
wrangler secret list | grep JWT_SECRET
# Or from your deployment
echo "W4KTFCGVBfcSW4biS6v3Bp+rO222HS60tFCWXiS4jCA="
```

## Usage

### In Pulumi Programs

```bash
# Use the environment
cd infrastructure
pulumi up --env sungod-ai/cf-auth/dev

# Secrets automatically available as config
# No need to manually set cloudflare:apiToken, etc.
```

### In CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy Infrastructure
        uses: pulumi/actions@v5
        with:
          command: up
          stack-name: sungod-ai/cf-auth/dev
          work-dir: infrastructure
        env:
          PULUMI_ACCESS_TOKEN: \${{ secrets.PULUMI_ACCESS_TOKEN }}
          # ESC handles all secrets via OIDC

      - name: Deploy Worker
        run: |
          # Get secrets from ESC
          pulumi env run sungod-ai/cf-auth/dev -- \
            wrangler deploy
```

### Locally for Development

```bash
# Open a shell with secrets
pulumi env run sungod-ai/cf-auth/dev -- bash

# Now all secrets are available as env vars
echo $JWT_SECRET
echo $AWS_ACCESS_KEY_ID

# Deploy worker with secrets
wrangler deploy
```

## Migration Plan

### Phase 1: Setup ESC (No Breaking Changes)

1. Create Pulumi ESC environment
2. Add secrets to ESC
3. Test with `pulumi env run`
4. Keep existing secrets in place

### Phase 2: Migrate Pulumi

Update `infrastructure/index.ts`:

```typescript
// Remove manual secret management
// const jwtSecret = new cloudflare.WorkerSecret(...)

// Instead, ESC provides via environment
// Secrets injected at runtime via PULUMI_CONFIG_PASSPHRASE
```

### Phase 3: Migrate Wrangler

Update deployment to use ESC:

```bash
# Old way
wrangler secret put JWT_SECRET

# New way (ESC injects secrets)
pulumi env run sungod-ai/cf-auth/dev -- wrangler secret put JWT_SECRET
```

### Phase 4: Update CI/CD

Update GitHub Actions to use ESC for all secret injection.

## Secret Management

### Adding New Secrets

```bash
# Edit environment
pulumi env edit sungod-ai/cf-auth/dev

# Add new secret
values:
  secrets:
    newSecret:
      fn::secret: "secret-value"
```

### Rotating Secrets

```bash
# Update secret value
pulumi env set sungod-ai/cf-auth/dev secrets.jwtSecret "new-secret-value"

# Redeploy
pulumi up --env sungod-ai/cf-auth/dev
```

### Viewing Secrets

```bash
# Open secrets (requires auth)
pulumi env open sungod-ai/cf-auth/dev

# Get specific value
pulumi env get sungod-ai/cf-auth/dev secrets.jwtSecret
```

## Security

### Access Control

```bash
# Grant user access to environment
pulumi env access grant sungod-ai/cf-auth/dev user@example.com read

# Grant team access
pulumi env access grant sungod-ai/cf-auth/dev myteam write
```

### Audit Trail

All secret access is logged in Pulumi Cloud:

- Who accessed secrets
- When they were accessed
- What values were retrieved

### OIDC Benefits

- No long-lived AWS credentials
- Automatic credential rotation
- Limited session duration
- Traceable via CloudTrail

## Current Secret Inventory

### Managed by Wrangler (Current)

- `JWT_SECRET` - JWT token signing
- (SES credentials via Pulumi outputs)

### Should Move to ESC

- ✅ `JWT_SECRET` - Centralized secret management
- ✅ `CLOUDFLARE_API_TOKEN` - No more local config
- ✅ `AWS_ACCESS_KEY_ID` - Via OIDC from Secrets Manager
- ✅ `AWS_SECRET_ACCESS_KEY` - Via OIDC from Secrets Manager
- 🔮 `ENCRYPTION_KEY` - Future database encryption
- 🔮 `OAUTH_CLIENT_IDS` - Future OAuth providers

## Environments

### Recommended Structure

```
sungod-ai/cf-auth/
  ├── dev          # Development (current setup)
  ├── staging      # Pre-production testing
  └── prod         # Production
```

Each environment has:

- Separate secrets
- Separate AWS roles
- Separate Cloudflare resources
- Separate access controls

## Quick Reference

```bash
# List environments
pulumi env ls

# Create environment
pulumi env init <org>/<project>/<env>

# Edit environment
pulumi env edit <org>/<project>/<env>

# View environment
pulumi env open <org>/<project>/<env>

# Run command with secrets
pulumi env run <org>/<project>/<env> -- <command>

# Get specific value
pulumi env get <org>/<project>/<env> path.to.value

# Set value
pulumi env set <org>/<project>/<env> path.to.value "new-value"
```

## Next Steps

1. **Create ESC environment**: `pulumi env init sungod-ai/cf-auth/dev`
2. **Configure secrets**: Use values from current setup
3. **Test locally**: `pulumi env run sungod-ai/cf-auth/dev -- bash`
4. **Update deployments**: Use ESC in CI/CD
5. **Migrate secrets**: Move from wrangler to ESC gradually

## Benefits Summary

| Current (Wrangler)       | With ESC            |
| ------------------------ | ------------------- |
| Manual secret management | Centralized         |
| Long-lived tokens        | OIDC short-lived    |
| Local config files       | Cloud-based         |
| No audit trail           | Full audit log      |
| Per-service secrets      | Shared across stack |
| Manual rotation          | Automated rotation  |

Ready to set it up? Let me know if you want help with any step!
