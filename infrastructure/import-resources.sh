#!/bin/bash
# Import existing Cloudflare resources into Pulumi
# This script imports resources that were created manually via wrangler

set -e

echo "🔄 Importing existing Cloudflare resources into Pulumi..."
echo ""

# Cloudflare Account ID
ACCOUNT_ID="6078f37766de72dca3f0bc4b301891b8"

# =============================================================================
# D1 Database
# =============================================================================
echo "📦 Importing D1 Database: auth-db-dev"
pulumi import cloudflare:index/d1Database:D1Database auth-db \
  "$ACCOUNT_ID/e213ec49-0d7e-4821-a62e-c2cdd0a3f512" \
  --skip-preview --yes || echo "  ⚠️  D1 import failed or already exists"

# =============================================================================
# KV Namespaces (4 used by worker)
# =============================================================================
echo ""
echo "📦 Importing KV Namespace: RATE_LIMITER"
pulumi import cloudflare:index/workersKvNamespace:WorkersKvNamespace rate-limiter-kv \
  "$ACCOUNT_ID/b34f18f445984da38c54f92477b58212" \
  --skip-preview --yes || echo "  ⚠️  KV import failed or already exists"

echo ""
echo "📦 Importing KV Namespace: TOKEN_BLACKLIST"
pulumi import cloudflare:index/workersKvNamespace:WorkersKvNamespace token-blacklist-kv \
  "$ACCOUNT_ID/808f4bf8980145cb83bc5bf152e9b976" \
  --skip-preview --yes || echo "  ⚠️  KV import failed or already exists"

echo ""
echo "📦 Importing KV Namespace: SESSION_CACHE"
pulumi import cloudflare:index/workersKvNamespace:WorkersKvNamespace session-cache-kv \
  "$ACCOUNT_ID/df4847c009a94363bf7cfdad791268cf" \
  --skip-preview --yes || echo "  ⚠️  KV import failed or already exists"

echo ""
echo "📦 Importing KV Namespace: MUTATION_LOG"
pulumi import cloudflare:index/workersKvNamespace:WorkersKvNamespace mutation-log-kv \
  "$ACCOUNT_ID/113b41fd1ab445eda25f2cda8944f8b5" \
  --skip-preview --yes || echo "  ⚠️  KV import failed or already exists"

# =============================================================================
# R2 Bucket
# =============================================================================
echo ""
echo "📦 Importing R2 Bucket: tenant-data-dev"
pulumi import cloudflare:index/r2Bucket:R2Bucket tenant-data-bucket \
  "$ACCOUNT_ID/tenant-data-dev" \
  --skip-preview --yes || echo "  ⚠️  R2 import failed or already exists"

# =============================================================================
# Worker Script (if needed)
# =============================================================================
# Note: Workers are typically deployed via wrangler, not Pulumi
# We only manage the script via Pulumi if we want full IaC control
# For now, we'll continue using wrangler deploy for the worker code

echo ""
echo "✅ Import complete!"
echo ""
echo "Next steps:"
echo "  1. Run: pulumi preview"
echo "  2. Verify no unwanted changes"
echo "  3. Run: pulumi up (should show no changes)"
echo ""
