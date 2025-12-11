# Environment Setup

This project uses `.env` files for configuration in two locations:

## Root `.env` (Cloudflare Workers)

**Location**: `/Users/logan.powell/Documents/projects/logan/cf-auth/.env`

**Purpose**: Configuration for the Cloudflare Worker runtime

**Create from example**:

```bash
cp .env.example .env
# Then edit .env with your values
```

**Contains**:

- Email configuration (AWS SES)
- AWS credentials for sending emails
- JWT secrets
- OAuth credentials
- App URLs
- Cloudflare account info

## Infrastructure `.env` (Pulumi)

**Location**: `/Users/logan.powell/Documents/projects/logan/cf-auth/infrastructure/.env`

**Purpose**: Configuration for Pulumi infrastructure deployment

**Create from example**:

```bash
cd infrastructure
cp .env.example .env
# Then edit .env with your values
```

**Contains**:

- Pulumi passphrase (for encrypting secrets)
- AWS credentials (for creating infrastructure)

## Quick Setup

```bash
# 1. Root .env (for Workers)
cp .env.example .env
nano .env  # or vim, code, etc.

# 2. Infrastructure .env (for Pulumi)
cd infrastructure
cp .env.example .env
nano .env
cd ..
```

## Important Notes

- ⚠️ **Never commit `.env` files to git** (already in `.gitignore`)
- 🔑 `.env.example` files are safe to commit (no secrets)
- 🔄 Update `.env.example` when adding new variables
- 👥 Team members create their own `.env` from examples

## AWS SES Setup Flow

1. **Create infrastructure/.env** with Pulumi passphrase
2. **Run setup**: `./scripts/setup-aws-ses.sh`
3. **Get AWS credentials** from Pulumi output
4. **Add to root .env**: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
5. **Set as secrets** (production): `wrangler secret put AWS_ACCESS_KEY_ID`
