#!/bin/bash

# Load environment variables and configure Pulumi
# Usage: ./configure-from-env.sh

set -e

# Load .env file
if [ ! -f "../.env" ]; then
  echo "Error: .env file not found in project root"
  echo "Copy .env.example to .env and fill in your values"
  exit 1
fi

echo "Loading environment variables from .env..."
source ../.env

# Export Pulumi passphrase if set
if [ -n "$PULUMI_CONFIG_PASSPHRASE" ]; then
  export PULUMI_CONFIG_PASSPHRASE
  echo "✓ Pulumi passphrase loaded from .env"
fi

# Validate required variables
if [ -z "$CF_ACCOUNT_ID" ]; then
  echo "Error: CF_ACCOUNT_ID not set in .env"
  exit 1
fi

if [ -z "$CF_API_TOKEN" ]; then
  echo "Error: CF_API_TOKEN not set in .env"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   CONFIGURING PULUMI FROM ENVIRONMENT VARIABLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Account ID: ${CF_ACCOUNT_ID:0:8}...${CF_ACCOUNT_ID: -8}"
echo "API Token:  ${CF_API_TOKEN:0:8}...***"
echo ""

# Set Pulumi config
echo "Setting Pulumi configuration..."
pulumi config set --secret cloudflare:apiToken "$CF_API_TOKEN"
pulumi config set auth-service:cloudflareAccountId "$CF_ACCOUNT_ID"

# Set optional zone ID if provided
if [ -n "$CF_ZONE_ID" ]; then
  echo "Setting Zone ID..."
  pulumi config set auth-service:cloudflareZoneId "$CF_ZONE_ID"
fi

echo ""
echo "✅ Pulumi configuration complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Preview infrastructure changes:"
echo "   pulumi preview"
echo ""
echo "2. Deploy infrastructure:"
echo "   pulumi up"
echo ""
echo "3. Update wrangler.toml:"
echo "   ./update-wrangler.sh"
echo ""
echo "4. Initialize database:"
echo "   cd .."
echo "   pnpm exec wrangler d1 execute auth-db --file=db/schema.sql"
echo ""
