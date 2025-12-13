#!/bin/bash

# Test AWS SES Email Sending
# This script tests actual email delivery via AWS SES

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  📧 Testing AWS SES Email Delivery                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get email from user
read -p "Enter your email address to receive test email: " EMAIL

echo ""
echo -e "${YELLOW}⚠️  This will temporarily enable production mode to test AWS SES${NC}"
echo -e "${YELLOW}   Make sure your backend is NOT running before continuing.${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Backup wrangler.toml
cp wrangler.toml wrangler.toml.backup-test

# Update ENVIRONMENT to production
sed -i.bak 's/ENVIRONMENT = "development"/ENVIRONMENT = "production"/' wrangler.toml
rm wrangler.toml.bak

echo ""
echo -e "${BLUE}Starting backend with AWS SES enabled...${NC}"
echo ""

# Start backend in background
pnpm run dev > /tmp/ses-test.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Configuration
BACKEND_URL="http://localhost:8787"
API_BASE="${BACKEND_URL}/v1/auth"

# Register user
echo -e "${BLUE}📝 Registering test user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${API_BASE}/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"TestPassword123!\",
    \"displayName\": \"SES Test User\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

# Check if successful
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id // empty')
if [ -n "$USER_ID" ]; then
    echo ""
    echo -e "${GREEN}✅ Registration successful!${NC}"
    echo -e "${GREEN}📧 Verification email should be sent to: $EMAIL${NC}"
    echo ""
    echo -e "${YELLOW}Check your email inbox (and spam folder) for the verification email.${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Registration failed${NC}"
    ERROR=$(echo "$REGISTER_RESPONSE" | jq -r '.error // .message // "Unknown error"')
    
    if [[ "$ERROR" == *"already registered"* ]]; then
        echo -e "${YELLOW}Email already registered. Trying to resend verification...${NC}"
        echo ""
        
        # Try to resend verification
        RESEND_RESPONSE=$(curl -s -X POST "${API_BASE}/resend-verification" \
          -H "Content-Type: application/json" \
          -d "{\"email\": \"$EMAIL\"}")
        
        echo "$RESEND_RESPONSE" | jq '.'
        
        RESEND_SUCCESS=$(echo "$RESEND_RESPONSE" | jq -r '.success // false')
        if [ "$RESEND_SUCCESS" = "true" ]; then
            echo ""
            echo -e "${GREEN}✅ Verification email resent!${NC}"
            echo -e "${GREEN}📧 Check your email inbox: $EMAIL${NC}"
            echo ""
        else
            echo ""
            echo -e "${RED}❌ Failed to resend verification${NC}"
        fi
    fi
fi

# Check backend logs for any errors
echo ""
echo -e "${BLUE}Backend logs (last 20 lines):${NC}"
tail -20 /tmp/ses-test.log

# Cleanup
echo ""
echo -e "${YELLOW}Cleaning up...${NC}"
kill $BACKEND_PID 2>/dev/null || true
mv wrangler.toml.backup-test wrangler.toml

echo ""
echo -e "${GREEN}✅ Test complete!${NC}"
echo -e "${YELLOW}   wrangler.toml restored to development mode${NC}"
echo ""
