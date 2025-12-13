#!/bin/bash

# Delete a specific user by email from local D1 database

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <email>"
    echo "Example: $0 logan@hyperlocals.com"
    exit 1
fi

EMAIL="$1"

# Find the local D1 database file
DB_FILE=$(find .wrangler -name "*.sqlite" -path "*/d1/*" | head -1)

if [ -z "$DB_FILE" ]; then
    echo "❌ No local D1 database found."
    exit 1
fi

echo "🔍 Looking for user: $EMAIL"
echo ""

# Check if user exists
USER_EXISTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users WHERE email = '$EMAIL';")

if [ "$USER_EXISTS" -eq "0" ]; then
    echo "✅ User not found. Database is clean."
    exit 0
fi

# Show user info
echo "Found user:"
sqlite3 "$DB_FILE" "SELECT id, email, email_verified, created_at FROM users WHERE email = '$EMAIL';" -header -column
echo ""

# Delete user and related tokens
sqlite3 "$DB_FILE" "DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email = '$EMAIL');"
sqlite3 "$DB_FILE" "DELETE FROM users WHERE email = '$EMAIL';"

echo "✅ User deleted: $EMAIL"
echo ""
