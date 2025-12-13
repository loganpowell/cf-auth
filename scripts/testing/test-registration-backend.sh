#!/bin/bash

# Test Registration Backend with Real Email
# This script tests the backend API endpoints directly without needing the demo app

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8787}"
API_BASE="${BACKEND_URL}/v1/auth"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🧪 Testing Backend Registration Flow with Real Email         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get email from user
read -p "Enter your email address: " EMAIL
read -p "Enter your name: " NAME
PASSWORD="SecurePass123!"

echo ""
echo -e "${BLUE}Test Configuration:${NC}"
echo "  Email: $EMAIL"
echo "  Name: $NAME"
echo "  Password: $PASSWORD"
echo "  Backend: $BACKEND_URL"
echo ""

# Check if backend is running
echo -e "${BLUE}▶ Checking if backend is running...${NC}"
if curl -sf "${BACKEND_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running on ${BACKEND_URL}${NC}"
    echo ""
    echo "Please start the backend with: pnpm run dev"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Register
echo -e "${BLUE}📝 Step 1: Registering user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${API_BASE}/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"displayName\": \"$NAME\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id')
if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
    echo -e "${GREEN}✓ User registered successfully${NC}"
    echo -e "${YELLOW}  User ID: $USER_ID${NC}"
elif echo "$REGISTER_RESPONSE" | jq -e '.error' > /dev/null && echo "$REGISTER_RESPONSE" | jq -r '.error' | grep -q "already registered"; then
    echo -e "${YELLOW}⚠ Email already registered. Attempting to resend verification...${NC}"
    echo ""
    
    # Try to resend verification email
    RESEND_RESPONSE=$(curl -s -X POST "${API_BASE}/resend-verification" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$EMAIL\"}")
    
    echo "$RESEND_RESPONSE" | jq '.'
    
    RESEND_SUCCESS=$(echo "$RESEND_RESPONSE" | jq -r '.success')
    if [ "$RESEND_SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ Verification email resent${NC}"
        USER_ID=$(echo "$RESEND_RESPONSE" | jq -r '.userId // empty')
    else
        echo -e "${RED}✗ Failed to resend verification${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Registration failed${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 2: Check email for verification token
echo -e "${YELLOW}📧 Step 2: Check your email for the verification link${NC}"
echo ""

# Check if running in production mode (AWS SES)
# Get the script directory and find .env in parent
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if grep -q "^ENVIRONMENT=production" "$PROJECT_ROOT/.env" 2>/dev/null; then
    echo -e "${GREEN}📧 Running in PRODUCTION mode - Real email sent via AWS SES${NC}"
    echo -e "${YELLOW}Check your email inbox (and spam folder): $EMAIL${NC}"
    echo ""
    echo "Look for an email from: auth@mail.rel.sh"
    echo "Subject: Verify Your Email Address"
    echo ""
    echo "Click the verification link in the email, then come back here."
else
    echo -e "${BLUE}📧 Running in DEVELOPMENT mode - Email logged to console${NC}"
    echo -e "${YELLOW}Check the backend terminal output for the verification token.${NC}"
    echo ""
    echo "Look for output like:"
    echo "  📧 Email (Dev Mode - Not Sent):"
    echo "  To: $EMAIL"
    echo "  Subject: Verify Your Email Address"
fi
echo ""
read -p "Enter the verification token from the URL: " VERIFICATION_TOKEN

if [ -z "$VERIFICATION_TOKEN" ]; then
    echo -e "${RED}✗ No verification token provided${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 3: Verify email
echo -e "${BLUE}✅ Step 3: Verifying email...${NC}"
VERIFY_RESPONSE=$(curl -s -X POST "${API_BASE}/verify-email" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$VERIFICATION_TOKEN\"}")

echo "$VERIFY_RESPONSE" | jq '.'

VERIFY_SUCCESS=$(echo "$VERIFY_RESPONSE" | jq -r '.success')
if [ "$VERIFY_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Email verified successfully${NC}"
else
    echo -e "${RED}✗ Email verification failed${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 4: Login
echo -e "${BLUE}🔑 Step 4: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // .tokens.access_token')
if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo -e "${YELLOW}  Access Token: ${ACCESS_TOKEN:0:20}...${NC}"
else
    echo -e "${RED}✗ Login failed${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 5: Get user profile
echo -e "${BLUE}👤 Step 5: Getting user profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "${API_BASE}/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$PROFILE_RESPONSE" | jq '.'

PROFILE_EMAIL=$(echo "$PROFILE_RESPONSE" | jq -r '.user.email // .email')
EMAIL_VERIFIED=$(echo "$PROFILE_RESPONSE" | jq -r '.user.emailVerified // .email_verified')

if [ "$PROFILE_EMAIL" = "$EMAIL" ] && [ "$EMAIL_VERIFIED" = "true" ]; then
    echo -e "${GREEN}✓ Profile retrieved successfully${NC}"
    echo -e "${GREEN}✓ Email verified status confirmed${NC}"
else
    echo -e "${RED}✗ Profile check failed${NC}"
    echo -e "${YELLOW}  Expected email: $EMAIL${NC}"
    echo -e "${YELLOW}  Got email: $PROFILE_EMAIL${NC}"
    echo -e "${YELLOW}  Email verified: $EMAIL_VERIFIED${NC}"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ All Tests Passed!                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Complete flow tested successfully:${NC}"
echo "  1. ✓ User registration"
echo "  2. ✓ Email sent via AWS SES"
echo "  3. ✓ Email verification confirmation"
echo "  4. ✓ User login with JWT tokens"
echo "  5. ✓ Authenticated profile access"
echo ""
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${GREEN}✓ Production mode: Real emails sent via AWS SES${NC}"
else
    echo -e "${YELLOW}Note: Development mode - emails logged to console.${NC}"
fi
echo ""
