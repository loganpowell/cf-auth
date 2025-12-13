#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

echo ""
print_warning "This will delete existing AWS and Cloudflare resources that conflict with Pulumi deployment:"
echo ""
echo "AWS Resources:"
echo "  - IAM User: auth-service-ses-user"
echo "  - IAM Policy: auth-service-ses-send-policy"
echo "  - SES Configuration Set: auth-service-emails"
echo "  - SNS Topic: auth-service-email-bounces"
echo "  - SNS Topic: auth-service-email-complaints"
echo "  - SNS Topic: auth-service-email-deliveries"
echo ""
echo "Cloudflare Resources:"
echo "  - D1 Database: auth-db"
echo "  - KV Namespace: token-blacklist-kv"
echo "  - KV Namespace: rate-limiter-kv"
echo "  - KV Namespace: session-cache-kv"
echo ""
read -p "Are you sure you want to delete these resources? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
    print_info "Aborted. No resources were deleted."
    exit 0
fi

echo ""
print_info "Deleting AWS resources..."

# Delete IAM User (need to delete access keys first)
if aws iam get-user --user-name auth-service-ses-user --no-cli-pager &>/dev/null 2>&1; then
    print_info "Deleting IAM user access keys..."
    aws iam list-access-keys --user-name auth-service-ses-user --no-cli-pager --query 'AccessKeyMetadata[].AccessKeyId' --output text | while read key; do
        aws iam delete-access-key --user-name auth-service-ses-user --access-key-id "$key" --no-cli-pager 2>/dev/null || true
    done
    
    print_info "Deleting IAM user policies..."
    aws iam list-user-policies --user-name auth-service-ses-user --no-cli-pager --query 'PolicyNames[]' --output text | while read policy; do
        aws iam delete-user-policy --user-name auth-service-ses-user --policy-name "$policy" --no-cli-pager 2>/dev/null || true
    done
    
    print_info "Deleting IAM user..."
    aws iam delete-user --user-name auth-service-ses-user --no-cli-pager 2>/dev/null && print_success "Deleted IAM user" || print_warning "Could not delete IAM user (may not exist)"
else
    print_info "IAM user does not exist, skipping"
fi

# Delete SES Configuration Set
if aws ses describe-configuration-set --configuration-set-name auth-service-emails --no-cli-pager &>/dev/null 2>&1; then
    print_info "Deleting SES configuration set..."
    aws ses delete-configuration-set --configuration-set-name auth-service-emails --no-cli-pager 2>/dev/null && print_success "Deleted SES configuration set" || print_warning "Could not delete configuration set"
else
    print_info "SES configuration set does not exist, skipping"
fi

# Delete SNS Topics
BOUNCE_TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `auth-service-email-bounces`)].TopicArn' --output text --no-cli-pager 2>/dev/null || echo "")
if [[ -n "$BOUNCE_TOPIC_ARN" ]]; then
    print_info "Deleting bounce notification topic..."
    aws sns delete-topic --topic-arn "$BOUNCE_TOPIC_ARN" --no-cli-pager 2>/dev/null && print_success "Deleted bounce topic" || print_warning "Could not delete bounce topic"
else
    print_info "Bounce topic does not exist, skipping"
fi

COMPLAINT_TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `auth-service-email-complaints`)].TopicArn' --output text --no-cli-pager 2>/dev/null || echo "")
if [[ -n "$COMPLAINT_TOPIC_ARN" ]]; then
    print_info "Deleting complaint notification topic..."
    aws sns delete-topic --topic-arn "$COMPLAINT_TOPIC_ARN" --no-cli-pager 2>/dev/null && print_success "Deleted complaint topic" || print_warning "Could not delete complaint topic"
else
    print_info "Complaint topic does not exist, skipping"
fi

DELIVERY_TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `auth-service-email-deliveries`)].TopicArn' --output text --no-cli-pager 2>/dev/null || echo "")
if [[ -n "$DELIVERY_TOPIC_ARN" ]]; then
    print_info "Deleting delivery notification topic..."
    aws sns delete-topic --topic-arn "$DELIVERY_TOPIC_ARN" --no-cli-pager 2>/dev/null && print_success "Deleted delivery topic" || print_warning "Could not delete delivery topic"
else
    print_info "Delivery topic does not exist, skipping"
fi

# Delete IAM Policy
POLICY_ARN=$(aws iam list-policies --query 'Policies[?PolicyName==`auth-service-ses-send-policy`].Arn' --output text --no-cli-pager 2>/dev/null || echo "")
if [[ -n "$POLICY_ARN" ]]; then
    print_info "Deleting IAM policy..."
    aws iam delete-policy --policy-arn "$POLICY_ARN" --no-cli-pager 2>/dev/null && print_success "Deleted IAM policy" || print_warning "Could not delete IAM policy"
else
    print_info "IAM policy does not exist, skipping"
fi

# Delete Cloudflare resources
if command -v wrangler &> /dev/null; then
    print_info "Deleting Cloudflare resources..."
    
    # Delete D1 database
    if wrangler d1 list 2>/dev/null | grep -q "auth-db"; then
        print_info "Deleting D1 database..."
        wrangler d1 delete auth-db --skip-confirmation 2>/dev/null && print_success "Deleted D1 database" || print_warning "Could not delete D1 database"
    else
        print_info "D1 database does not exist, skipping"
    fi
    
    # Delete KV namespaces
    for kv_name in "token-blacklist-kv" "rate-limiter-kv" "session-cache-kv"; do
        KV_ID=$(wrangler kv:namespace list 2>/dev/null | grep "$kv_name" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")
        if [[ -n "$KV_ID" ]]; then
            print_info "Deleting KV namespace: $kv_name..."
            wrangler kv:namespace delete --namespace-id="$KV_ID" 2>/dev/null && print_success "Deleted $kv_name" || print_warning "Could not delete $kv_name"
        else
            print_info "KV namespace $kv_name does not exist, skipping"
        fi
    done
else
    print_warning "Wrangler CLI not found, skipping Cloudflare resource cleanup"
    print_info "Install with: npm install -g wrangler"
fi

echo ""
print_success "Cleanup complete!"
echo ""
print_info "You can now run the setup script:"
echo "  ./scripts/setup.sh"
