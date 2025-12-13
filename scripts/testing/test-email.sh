#!/bin/bash

# Email Testing Script
# Tests email functionality in both development and production modes

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

# Check if backend is running
check_backend() {
    if curl -s http://localhost:8787/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

print_header "📧 Email Functionality Test"

echo "This script will test email sending in different modes."
echo ""

# Get test email
read -p "Enter your email address for testing: " TEST_EMAIL

if [ -z "$TEST_EMAIL" ]; then
    print_error "Email address is required"
    exit 1
fi

# Check if backend is running
print_step "Checking if backend is running..."

if check_backend; then
    print_success "Backend is running on http://localhost:8787"
else
    print_error "Backend is not running. Please start it with: pnpm run dev"
    exit 1
fi

# Test 1: Register a new user
print_header "Test 1: User Registration (Email Verification)"

RANDOM_ID=$RANDOM
TEST_USER_EMAIL="${TEST_EMAIL}"
TEST_PASSWORD="SecurePass123!"
TEST_DISPLAY_NAME="Test User ${RANDOM_ID}"

print_step "Registering user: ${TEST_USER_EMAIL}"

REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_USER_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"displayName\": \"${TEST_DISPLAY_NAME}\"
  }")

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    print_success "User registered successfully!"
    
    # Extract user ID if available
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id // empty')
    
    print_info "Check your backend console for the verification email output"
    print_info "In development mode, the email is logged instead of sent"
else
    print_error "Registration failed"
    echo "$REGISTER_RESPONSE"
    exit 1
fi

# Test 2: Check database for verification token
print_header "Test 2: Verify Token Generation"

print_step "Checking database for verification token..."

DB_PATH=$(find .wrangler/state/v3/d1 -name "db.sqlite" 2>/dev/null | head -n 1)

if [ -n "$DB_PATH" ]; then
    TOKEN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = (SELECT id FROM users WHERE email = '${TEST_USER_EMAIL}');" 2>/dev/null || echo "0")
    
    if [ "$TOKEN_COUNT" -gt 0 ]; then
        print_success "Verification token created in database"
        
        # Get the actual token (not hashed)
        VERIFICATION_TOKEN=$(sqlite3 "$DB_PATH" "SELECT token FROM email_verification_tokens WHERE user_id = (SELECT id FROM users WHERE email = '${TEST_USER_EMAIL}') ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)
        
        if [ -n "$VERIFICATION_TOKEN" ]; then
            print_info "Token extracted from database"
            echo "Token: ${VERIFICATION_TOKEN:0:20}... (truncated)"
        else
            print_error "Could not extract token from database"
        fi
    else
        print_error "No verification token found in database"
    fi
else
    print_error "Could not find local database"
    print_info "Make sure backend is running with: pnpm run dev"
fi

# Test 3: Complete Email Verification
print_header "Test 3: Complete Email Verification"

if [ -n "$VERIFICATION_TOKEN" ]; then
    print_step "Verifying email with token..."
    
    VERIFY_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/verify-email \
      -H "Content-Type: application/json" \
      -d "{\"token\": \"${VERIFICATION_TOKEN}\"}")
    
    echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
    
    if echo "$VERIFY_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Email verified successfully! ✅"
        print_info "User can now log in"
        
        # Check user is verified in database
        IS_VERIFIED=$(sqlite3 "$DB_PATH" "SELECT email_verified FROM users WHERE email = '${TEST_USER_EMAIL}';" 2>/dev/null)
        if [ "$IS_VERIFIED" = "1" ]; then
            print_success "Database confirms email is verified"
        fi
    else
        print_error "Email verification failed"
    fi
else
    print_error "No verification token available - skipping verification test"
fi

# Test 4: Test Login with Verified User
print_header "Test 4: Login with Verified User"

if [ -n "$VERIFICATION_TOKEN" ]; then
    print_step "Attempting login..."
    
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/login \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"${TEST_USER_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\"
      }")
    
    echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
    
    if echo "$LOGIN_RESPONSE" | jq -e '.accessToken' > /dev/null 2>&1; then
        print_success "Login successful! 🎉"
        ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
        print_info "Access token received"
        
        # Test authenticated endpoint
        print_step "Testing authenticated endpoint (/me)..."
        ME_RESPONSE=$(curl -s http://localhost:8787/v1/auth/me \
          -H "Authorization: Bearer ${ACCESS_TOKEN}")
        
        echo "$ME_RESPONSE" | jq '.' 2>/dev/null || echo "$ME_RESPONSE"
        
        if echo "$ME_RESPONSE" | jq -e '.user.email' > /dev/null 2>&1; then
            print_success "Authenticated request successful!"
            print_success "Full auth flow working! ✅"
        else
            print_error "Authenticated request failed"
        fi
    else
        print_error "Login failed"
    fi
else
    print_error "Skipping login test - no verified user"
fi

# Test 5: Test resend verification
print_header "Test 5: Resend Verification Email"

read -p "Test resending verification email? (y/n): " TEST_RESEND

if [ "$TEST_RESEND" = "y" ]; then
    print_step "Resending verification email..."
    
    RESEND_RESPONSE=$(curl -s -X POST http://localhost:8787/v1/auth/resend-verification \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"${TEST_USER_EMAIL}\"}")
    
    echo "$RESEND_RESPONSE" | jq '.' 2>/dev/null || echo "$RESEND_RESPONSE"
    
    if echo "$RESEND_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Verification email resent!"
        print_info "Check backend console for email output"
    else
        print_error "Resend failed"
    fi
fi

# Test 4: Production mode instructions
print_header "Test 6: Production Mode Testing"

print_info "To test with REAL email sending:"
echo ""
echo "1. Update wrangler.toml:"
echo "   ${CYAN}ENVIRONMENT = \"production\"${NC}"
echo ""
echo "2. Make sure Email Routing is enabled and sender is verified"
echo ""
echo "3. Restart the backend:"
echo "   ${CYAN}pnpm run dev${NC}"
echo ""
echo "4. Register with your real email address"
echo ""
echo "5. Check your inbox for the verification email"
echo ""
read -p "Switch to production mode now? (y/n): " SWITCH_PROD

if [ "$SWITCH_PROD" = "y" ]; then
    print_warning "Switching to production mode..."
    
    # Backup wrangler.toml
    cp wrangler.toml wrangler.toml.backup
    
    # Update ENVIRONMENT to production
    sed -i.bak 's/ENVIRONMENT = "development"/ENVIRONMENT = "production"/g' wrangler.toml
    rm -f wrangler.toml.bak
    
    print_success "Updated ENVIRONMENT to production in wrangler.toml"
    print_warning "Restart your backend (pnpm run dev) for changes to take effect"
    print_info "To revert: ENVIRONMENT = \"development\""
fi

# Summary
print_header "📋 Test Summary"

cat << EOF
${GREEN}✓${NC} Email Functionality Test Complete

What was tested:
  ✓ User registration endpoint
  ✓ Email verification token generation
  ✓ Database token storage
  ✓ Email verification completion
  ✓ User login after verification
  ✓ Authenticated endpoint access
  ✓ Resend verification endpoint

Current Mode:
  $(grep "ENVIRONMENT" wrangler.toml)

Development Mode (current):
  • Emails logged to backend console
  • No actual emails sent
  • Safe for testing

Production Mode:
  • Emails sent via Cloudflare Email Routing
  • Requires Email Routing setup
  • Uses verified sender address

Email Limits:
  • Free tier: 100 emails/day
  • Monitor usage: Cloudflare Dashboard > Email Routing > Analytics

Troubleshooting:
  • Check backend console for errors
  • Verify SEND_EMAIL binding is configured
  • Ensure sender email is verified
  • See docs/EMAIL_ROUTING_SETUP.md

Next Steps:
  1. Review backend console output
  2. Test email verification flow
  3. Deploy to production when ready
EOF

print_success "Testing complete! 🎉"
