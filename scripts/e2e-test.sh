#!/bin/bash
# End-to-End Testing Script for Multi-Tenant Infrastructure
# Tests all deployed components in production

set -e

BASE_URL="https://auth-service.logan-607.workers.dev"
ADMIN_KEY="sk_live_b3BUwJF8cQHRmGOTNPtAVKvg22UBp:d98730fc6e18df352373d43a7fa0830a3cab3afc0c542139a36c8270813c4805"

echo "🧪 Multi-Tenant Infrastructure E2E Tests"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

run_test() {
  local name=$1
  local url=$2
  local method=${3:-GET}
  local data=$4
  local expected_status=${5:-200}
  
  test_count=$((test_count + 1))
  echo -n "Test $test_count: $name... "
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
      -H "Authorization: Bearer $ADMIN_KEY" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
      -H "Authorization: Bearer $ADMIN_KEY")
  fi
  
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
    pass_count=$((pass_count + 1))
    return 0
  else
    echo -e "${RED}FAIL${NC} (Expected HTTP $expected_status, got $status_code)"
    echo "Response: $body"
    fail_count=$((fail_count + 1))
    return 1
  fi
}

echo "📡 Testing Worker Deployment"
echo "----------------------------"
run_test "Health check" "$BASE_URL/health"
echo ""

echo "🔐 Testing Admin API Authentication"
echo "-----------------------------------"
run_test "List tenants (authenticated)" "$BASE_URL/admin/tenants"
run_test "Get tenant debug info" "$BASE_URL/admin/debug/tenant"
echo ""

echo "🏢 Testing Tenant Management"
echo "---------------------------"
tenant_response=$(curl -s -X POST "$BASE_URL/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-e2e",
    "name": "E2E Test Tenant",
    "plan": "starter"
  }')

# Accept both success (new tenant) and error (tenant exists) as valid
if echo "$tenant_response" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo -e "Test $((test_count + 1)): Create test tenant... ${GREEN}PASS${NC} (created)"
  test_count=$((test_count + 1))
  pass_count=$((pass_count + 1))
elif echo "$tenant_response" | jq -e '.error' | grep -q "already exists" 2>/dev/null; then
  echo -e "Test $((test_count + 1)): Create test tenant... ${GREEN}PASS${NC} (already exists)"
  test_count=$((test_count + 1))
  pass_count=$((pass_count + 1))
  
  # Extract tenant credentials
  TENANT_SECRET=$(echo "$tenant_response" | jq -r '.data.credentials.secretKey.prefix + ":" + .data.credentials.secretKey.secret')
  echo "  Created tenant with secret key"
else
  echo -e "Test $((test_count + 1)): Create test tenant... ${RED}FAIL${NC}"
  test_count=$((test_count + 1))
  fail_count=$((fail_count + 1))
fi

run_test "Get tenant by ID" "$BASE_URL/admin/tenants/tenant:test-e2e"
echo ""

echo "🎯 Testing Durable Objects"
echo "-------------------------"
run_test "Get TenantState (acme-corp)" "$BASE_URL/do/tenant-state/acme-corp"
run_test "Get TenantState (test-e2e)" "$BASE_URL/do/tenant-state/test-e2e"

mutation_data='{"type": "test.event", "payload": {"test": true}}'
run_test "Send mutation to TenantState" "$BASE_URL/do/tenant-state/test-e2e/mutation" "POST" "$mutation_data"

run_test "Get GraphStateCSV state" "$BASE_URL/do/graph-state/test-e2e"

validate_data='{"edges": [{"subject": "user:test", "relation": "member", "object": "org:test"}]}'
run_test "Validate edges (should fail - not initialized)" "$BASE_URL/do/graph-state/test-e2e/validate" "POST" "$validate_data"
echo ""

echo "🔑 Testing API Key Management"
echo "----------------------------"
run_test "List API keys for tenant" "$BASE_URL/admin/tenants/tenant:test-e2e/keys"

key_data='{"name": "Test Key", "type": "secret", "environment": "test", "permissions": ["read:users"]}'
run_test "Create new API key" "$BASE_URL/admin/tenants/tenant:test-e2e/keys" "POST" "$key_data" "201"
echo ""

echo "📊 Testing Metrics & Dashboard"
echo "-----------------------------"
run_test "Get dashboard metrics" "$BASE_URL/admin/dashboard"
echo ""

echo "================================"
echo "🏁 Test Results"
echo "================================"
echo -e "Total Tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
