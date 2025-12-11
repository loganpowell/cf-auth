# Base Infrastructure Stack

Provisions shared resources for the cf-auth project:

## Resources

- **OIDC Providers**: GitHub Actions and Pulumi ESC
- **IAM Roles**: For keyless authentication
- **Secrets Manager**: Centralized secret storage
- **Policies**: Fine-grained permissions

## Setup

```bash
cd infrastructure/base

# Install dependencies (from parent directory)
cd .. && pnpm install && cd base

# Configure
pulumi config set aws:region us-east-1
pulumi config set base:githubRepository loganpowell/cf-auth

# Deploy
source ../.env  # Load PULUMI_CONFIG_PASSPHRASE
pulumi up
```

## Outputs

- `github_oidc_provider_arn` - For GitHub Actions authentication
- `pulumi_esc_role_arn` - For Pulumi ESC to manage secrets
- `github_actions_role_arn` - For CI/CD workflows
- `ses_credentials_secret_arn` - Where SES credentials are stored

## Used By

- Main email infrastructure stack (references OIDC providers)
- Pulumi ESC environment (assumes ESC role)
- GitHub Actions workflows (assumes Actions role)
