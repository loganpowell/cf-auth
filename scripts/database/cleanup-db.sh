#!/bin/bash

################################################################################
# Database Cleanup Script
#
# Completely cleans the local D1 database and Wrangler state, then regenerates
# migrations and applies them. Use this when schema changes require a fresh start.
#
# Usage:
#   ./scripts/database/cleanup-db.sh [--seed]
#
# Options:
#   --seed    Also run seed data script after migrations
#
################################################################################

set -e  # Exit on error

# Parse arguments
SEED_DATA=false
if [ "$1" = "--seed" ]; then
  SEED_DATA=true
fi

echo ""
echo "================================================================"
echo "         Database Cleanup & Fresh Migration"
echo "================================================================"
echo ""

# Step 1: Clean Wrangler state
echo "[1/5] Cleaning Wrangler state..."
if [ -d ".wrangler/state/v3/d1" ]; then
  rm -rf .wrangler/state/v3/d1
  echo "✓ Deleted .wrangler/state/v3/d1"
else
  echo "ℹ No existing D1 state found"
fi

# Step 2: Clean old migrations
echo ""
echo "[2/5] Cleaning old migrations..."
if [ -d "drizzle/migrations" ]; then
  rm -rf drizzle/migrations
  echo "✓ Deleted drizzle/migrations"
else
  echo "ℹ No existing migrations found"
fi

# Step 3: Generate fresh migration
echo ""
echo "[3/5] Generating fresh migration from schema..."
pnpm drizzle-kit generate
echo "✓ Migration generated"

# Step 4: Apply migration to local database
echo ""
echo "[4/5] Applying migration to local database..."
wrangler d1 migrations apply auth-db --local
echo "✓ Migration applied"

# Step 5: Verify tables
echo ""
echo "[5/5] Verifying database tables..."
echo ""
wrangler d1 execute auth-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
echo ""

# Optional: Seed data
if [ "$SEED_DATA" = true ]; then
  echo ""
  echo "[SEED] Applying seed data..."
  
  # Generate seed SQL to temp file
  TEMP_SEED="/tmp/cf-auth-seed-$(date +%s).sql"
  pnpm tsx scripts/database/seed-data.ts > "$TEMP_SEED"
  
  # Apply seed data
  wrangler d1 execute auth-db --local --file="$TEMP_SEED"
  
  # Clean up temp file
  rm "$TEMP_SEED"
  
  echo "✓ Seed data applied"
  echo ""
  echo "Database contents:"
  wrangler d1 execute auth-db --local --command "SELECT name, description, is_system FROM roles ORDER BY name;"
  echo ""
  wrangler d1 execute auth-db --local --command "SELECT email, display_name, email_verified, status FROM users ORDER BY email;"
fi

# Summary
echo ""
echo "================================================================"
echo "                 Cleanup Complete!"
echo "================================================================"
echo ""
echo "Next steps:"
echo "  1. Start backend:  pnpm run dev"
echo "  2. Start demo app: cd demo-app && pnpm run dev"

if [ "$SEED_DATA" = false ]; then
  echo ""
  echo "Note: Run with --seed flag to also populate initial roles"
  echo "  ./scripts/database/cleanup-db.sh --seed"
fi

echo ""
