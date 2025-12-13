#!/bin/bash

# Test Registration Flow
# Tests the complete registration → verify email → login → dashboard flow

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_step() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

# Generate random email for testing
TIMESTAMP=$(date +%s)
TEST_EMAIL="test-user-${TIMESTAMP}@example.com"
TEST_PASSWORD="SecurePass123!"
TEST_NAME="Test User"

print_header "🧪 Testing Registration Flow"

echo "Test Credentials:"
echo "  Email: ${TEST_EMAIL}"
echo "  Password: ${TEST_PASSWORD}"
echo "  Name: ${TEST_NAME}"
echo ""

# Check if backend is running
print_step "Checking if backend is running..."
if ! curl -s http://localhost:8787/health > /dev/null 2>&1; then
    print_error "Backend is not running on http://localhost:8787"
    echo ""
    print_info "Start the backend with: cd /path/to/cf-auth && pnpm run dev"
    exit 1
fi
print_success "Backend is running"

# Check if demo app is running
print_step "Checking if demo app is running..."
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    print_error "Demo app is not running on http://localhost:5173"
    echo ""
    print_info "Start the demo app with: cd demo-app && pnpm run dev"
    exit 1
fi
print_success "Demo app is running"

echo ""
print_header "📝 Step 1: Register New User"

REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"displayName\": \"${TEST_NAME}\"
  }")

echo "Response:"
echo "$REGISTER_RESPONSE" | jq '.'

if echo "$REGISTER_RESPONSE" | jq -e '.user' > /dev/null 2>&1; then
    print_success "Registration successful"
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id')
    print_info "User ID: ${USER_ID}"
else
    print_error "Registration failed"
    exit 1
fi

echo ""
print_header "📧 Step 2: Check Email Verification Token"
print_info "In development mode, check the console logs for the verification link"
print_info "The token should be printed in the backend logs"
echo ""
echo -e "${YELLOW}⚠ Manual Step Required:${NC}"
echo "1. Check your backend terminal for the verification email"
echo "2. Look for: 'Email Verification Link: http://localhost:5173/verify-email?token=...'"
echo "3. Copy the token from the URL"
echo ""
read -p "Enter the verification token: " VERIFICATION_TOKEN

if [ -z "$VERIFICATION_TOKEN" ]; then
    print_error "No token provided"
    exit 1
fi

echo ""
print_header "✅ Step 3: Verify Email"

VERIFY_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"${VERIFICATION_TOKEN}\"}")

echo "Response:"
echo "$VERIFY_RESPONSE" | jq '.'

if echo "$VERIFY_RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
    print_success "Email verified successfully"
else
    print_error "Email verification failed"
    exit 1
fi

echo ""
print_header "🔑 Step 4: Login with Verified Account"

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\"
  }")

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.'

if echo "$LOGIN_RESPONSE" | jq -e '.accessToken' > /dev/null 2>&1; then
    print_success "Login successful"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
    print_info "Access token received (${#ACCESS_TOKEN} characters)"
else
    print_error "Login failed"
    exit 1
fi

echo ""
print_header "👤 Step 5: Access Dashboard (GET /v1/auth/me)"

ME_RESPONSE=$(curl -s http://localhost:8787/v1/auth/me \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Response:"
echo "$ME_RESPONSE" | jq '.'

if echo "$ME_RESPONSE" | jq -e '.user' > /dev/null 2>&1; then
    print_success "Dashboard access successful"
    VERIFIED=$(echo "$ME_RESPONSE" | jq -r '.user.emailVerified')
    if [ "$VERIFIED" == "true" ]; then
        print_success "Email is verified: ${VERIFIED}"
    else
        print_error "Email verification status: ${VERIFIED}"
    fi
else
    print_error "Failed to access user info"
    exit 1
fi

echo ""
print_header "🎉 Test Complete!"
echo ""
print_success "All steps completed successfully:"
echo "  1. ✓ User registered"
echo "  2. ✓ Email verification token generated"
echo "  3. ✓ Email verified"
echo "  4. ✓ Login successful"
echo "  5. ✓ Dashboard accessible"
echo ""
print_info "Test user credentials:"
echo "  Email: ${TEST_EMAIL}"
echo "  Password: ${TEST_PASSWORD}"
echo ""
print_info "Next steps:"
echo "  • Test the flow in the browser at http://localhost:5173"
echo "  • Try the resend verification flow"
echo "  • Test logout and re-login"
echo ""
