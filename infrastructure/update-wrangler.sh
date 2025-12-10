#!/bin/bash

# Script to update wrangler.toml with Pulumi stack outputs
# Run this after: pulumi up

set -e

# Load .env for passphrase
if [ -f "../.env" ]; then
  source ../.env
  export PULUMI_CONFIG_PASSPHRASE
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   UPDATE WRANGLER.TOML WITH PRODUCTION RESOURCE IDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make sure we're in the infrastructure directory
cd "$(dirname "$0")"

# Get stack outputs
echo "Fetching Pulumi stack outputs..."
D1_DB_ID=$(pulumi stack output d1DatabaseId)
RATE_LIMITER_ID=$(pulumi stack output rateLimiterKvId)
TOKEN_BLACKLIST_ID=$(pulumi stack output tokenBlacklistKvId)
SESSION_CACHE_ID=$(pulumi stack output sessionCacheKvId)

echo ""
echo "Retrieved resource IDs:"
echo "  D1 Database:      $D1_DB_ID"
echo "  Rate Limiter KV:  $RATE_LIMITER_ID"
echo "  Token Blacklist:  $TOKEN_BLACKLIST_ID"
echo "  Session Cache:    $SESSION_CACHE_ID"
echo ""

# Update wrangler.toml
WRANGLER_TOML="../wrangler.toml"

if [ ! -f "$WRANGLER_TOML" ]; then
  echo "Error: wrangler.toml not found at $WRANGLER_TOML"
  exit 1
fi

echo "Updating $WRANGLER_TOML..."

# Backup original
cp "$WRANGLER_TOML" "$WRANGLER_TOML.backup"
echo "  ✓ Created backup: $WRANGLER_TOML.backup"

# Update D1 database_id
sed -i.tmp "s/database_id = \"local\"/database_id = \"$D1_DB_ID\"/" "$WRANGLER_TOML"

# Update KV namespace IDs
sed -i.tmp "s/id = \"local-rate-limiter\"/id = \"$RATE_LIMITER_ID\"/" "$WRANGLER_TOML"
sed -i.tmp "s/id = \"local-token-blacklist\"/id = \"$TOKEN_BLACKLIST_ID\"/" "$WRANGLER_TOML"
sed -i.tmp "s/id = \"local-session-cache\"/id = \"$SESSION_CACHE_ID\"/" "$WRANGLER_TOML"

# Remove temporary file
rm -f "$WRANGLER_TOML.tmp"

echo "  ✓ Updated D1 database ID"
echo "  ✓ Updated KV namespace IDs"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Initialize D1 database with schema:"
echo "   cd .."
echo "   pnpm exec wrangler d1 execute auth-db --file=db/schema.sql"
echo ""
echo "2. Verify tables were created:"
echo "   pnpm exec wrangler d1 execute auth-db --command=\"SELECT name FROM sqlite_master WHERE type='table'\""
echo ""
echo "3. Test production configuration:"
echo "   pnpm run dev"
echo ""
echo "To revert changes, restore from backup:"
echo "   cp $WRANGLER_TOML.backup $WRANGLER_TOML"
echo ""
