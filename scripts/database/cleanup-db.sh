#!/bin/bash

# Clean up local D1 database
# This removes all users from the local development database

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🗑️  Cleaning Up Local Database                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if .wrangler directory exists
if [ ! -d ".wrangler" ]; then
    echo "❌ No .wrangler directory found. Database might not exist yet."
    exit 1
fi

# Find the local D1 database file
DB_FILE=$(find .wrangler -name "*.sqlite" -path "*/d1/*" | head -1)

if [ -z "$DB_FILE" ]; then
    echo "❌ No local D1 database found."
    echo "   The database will be created when you first run the backend."
    exit 1
fi

echo "📍 Found database: $DB_FILE"
echo ""

# Count existing users
USER_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
echo "Current user count: $USER_COUNT"
echo ""

if [ "$USER_COUNT" -eq "0" ]; then
    echo "✅ Database is already empty."
    exit 0
fi

# Show users
echo "Current users:"
sqlite3 "$DB_FILE" "SELECT email, email_verified, created_at FROM users;" -header -column

echo ""
read -p "Delete all users? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    sqlite3 "$DB_FILE" "DELETE FROM users;"
    echo ""
    echo "✅ All users deleted!"
    echo ""
    
    # Verify
    REMAINING=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;")
    echo "Remaining users: $REMAINING"
else
    echo ""
    echo "❌ Cancelled. No changes made."
fi

echo ""
