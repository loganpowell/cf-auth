#!/bin/bash

# Cleanup script for conflicting AWS and Cloudflare resources
# This removes old resources that don't have stack-based naming

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

echo ""
print_warning "This will delete existing AWS and Cloudflare resources that conflict with Pulumi deployment:"
echo ""
echo "AWS Resources (OLD - without stack suffix):"
echo "  - IAM User: auth-service-ses-user"
echo "  - IAM Policy: auth-service-ses-send-policy"
echo "  - SES Configuration Set: auth-service-emails"
echo "  - SNS Topic: auth-service-email-bounces"
echo "  - SNS Topic: auth-service-email-complaints"
echo "  - SNS Topic: auth-service-email-deliveries"
echo ""
echo "Cloudflare Resources (OLD - without stack suffix):"
echo "  - D1 Database: auth-db"
echo "  - KV Namespace: token-blacklist-kv"
echo "  - KV Namespace: rate-limiter-kv"
echo "  - KV Namespace: session-cache-kv"
echo ""
print_info "New resources will be created with '-dev' suffix (e.g., auth-db-dev)"
echo ""
read -p "Are you sure you want to delete these OLD resources? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
    print_error "Cleanup cancelled"
    exit 1
fi

print_info "Starting cleanup of OLD resources (without stack suffix)..."
echo ""

# ============================================
# AWS Resources Cleanup
# ============================================

# Delete IAM User and associated resources
USER_EXISTS=$(aws iam get-user --user-name auth-service-ses-user --no-cli-pager 2>/dev/null && echo "yes" || echo "no")
if [[ "$USER_EXISTS" == "yes" ]]; then
    print_info "Deleting IAM user and associated resources..."
    
    # Delete access keys first
    ACCESS_KEYS=$(aws iam list-access-keys --user-name auth-service-ses-user --query 'AccessKeyMetadata[].AccessKeyId' --output text --no-cli-pager 2>/dev/null || echo "")
    if [[ -n "$ACCESS_KEYS" ]]; then
        for key in $ACCESS_KEYS; do
            print_info "Deleting access key: $key"
            aws iam delete-access-key --user-name auth-service-ses-user --access-key-id "$key" --no-cli-pager 2>/dev/null
        done
    fi
    
    # Detach policies
    ATTACHED_POLICIES=$(aws iam list-attached-user-policies --user-name auth-service-ses-user --query 'AttachedPolicies[].PolicyArn' --output text --no-cli-pager 2>/dev/null || echo "")
    if [[ -n "$ATTACHED_POLICIES" ]]; then
        for policy in $ATTACHED_POLICIES; do
            print_info "Detaching policy: $policy"
            aws iam detach-user-policy --user-name auth-service-ses-user --policy-arn "$policy" --no-cli-pager 2>/dev/null
        done
    fi
    
    # Delete inline policies
    INLINE_POLICIES=$(aws iam list-user-policies --user-name auth-service-ses-user --query 'PolicyNames[]' --output text --no-cli-pager 2>/dev/null || echo "")
    if [[ -n "$INLINE_POLICIES" ]]; then
        for policy in $INLINE_POLICIES; do
            print_info "Deleting inline policy: $policy"
            aws iam delete-user-policy --user-name auth-service-ses-user --policy-name "$policy" --no-cli-pager 2>/dev/null
        done
    fi
    
    # Finally delete the user
    aws iam delete-user --user-name auth-service-ses-user --no-cli-pager 2>/dev/null && print_success "Deleted IAM user" || print_warning "Could not delete IAM user"
else
    print_info "IAM user does not exist, skipping"
fi

# Delete IAM Policy (check if it exists and has no attachments)
POLICY_ARN=$(aws iam list-policies --query 'Policies[?PolicyName==`auth-service-ses-send-policy`].Arn' --output text --no-cli-pager 2>/dev/null || echo "")
if [[ -n "$POLICY_ARN" ]]; then
    print_info "Deleting IAM policy..."
    
    # Check for policy versions
    POLICY_VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?!IsDefaultVersion].VersionId' --output text --no-cli-pager 2>/dev/null || echo "")
    if [[ -n "$POLICY_VERSIONS" ]]; then
        for version in $POLICY_VERSIONS; do
            print_info "Deleting policy version: $version"
            aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$version" --no-cli-pager 2>/dev/null
        done
    fi
    
    aws iam delete-policy --policy-arn "$POLICY_ARN" --no-cli-pager 2>/dev/null && print_success "Deleted IAM policy" || print_warning "Could not delete IAM policy (may still be attached)"
else
    print_info "IAM policy does not exist, skipping"
fi

# Delete SES Configuration Set
CONFIG_SET_EXISTS=$(aws ses describe-configuration-set --configuration-set-name auth-service-emails --no-cli-pager 2>/dev/null && echo "yes" || echo "no")
if [[ "$CONFIG_SET_EXISTS" == "yes" ]]; then
    print_info "Deleting SES configuration set..."
    
    # Delete event destinations first
    EVENT_DESTINATIONS=$(aws ses describe-configuration-set --configuration-set-name auth-service-emails --query 'EventDestinations[].Name' --output text --no-cli-pager 2>/dev/null || echo "")
    if [[ -n "$EVENT_DESTINATIONS" ]]; then
        for dest in $EVENT_DESTINATIONS; do
            print_info "Deleting event destination: $dest"
            aws ses delete-configuration-set-event-destination --configuration-set-name auth-service-emails --event-destination-name "$dest" --no-cli-pager 2>/dev/null
        done
    fi
    
    aws ses delete-configuration-set --configuration-set-name auth-service-emails --no-cli-pager 2>/dev/null && print_success "Deleted SES configuration set" || print_warning "Could not delete SES configuration set"
else
    print_info "SES configuration set does not exist, skipping"
fi

# Delete SNS Topics
for topic_name in "auth-service-email-bounces" "auth-service-email-complaints" "auth-service-email-deliveries"; do
    TOPIC_ARN=$(aws sns list-topics --query "Topics[?contains(TopicArn, \`${topic_name}\`)].TopicArn" --output text --no-cli-pager 2>/dev/null || echo "")
    if [[ -n "$TOPIC_ARN" ]]; then
        print_info "Deleting SNS topic: $topic_name..."
        aws sns delete-topic --topic-arn "$TOPIC_ARN" --no-cli-pager 2>/dev/null && print_success "Deleted $topic_name" || print_warning "Could not delete $topic_name"
    else
        print_info "SNS topic $topic_name does not exist, skipping"
    fi
done

echo ""
print_success "AWS cleanup complete!"
echo ""

# ============================================
# Cloudflare Resources Cleanup
# ============================================

if ! command -v wrangler &> /dev/null; then
    print_warning "Wrangler CLI not found, skipping Cloudflare resource cleanup"
    print_info "Install with: npm install -g wrangler"
    exit 0
fi

print_info "Cleaning up Cloudflare resources..."

# Source environment for Cloudflare credentials
if [[ -f ".env" ]]; then
    export $(grep -v '^#' .env | xargs)
fi

# Delete D1 database (OLD name without suffix)
print_info "Checking for D1 database: auth-db"
if wrangler d1 list 2>/dev/null | grep -q '"auth-db"'; then
    print_info "Deleting D1 database: auth-db..."
    wrangler d1 delete auth-db --skip-confirmation 2>/dev/null && print_success "Deleted auth-db" || print_warning "Could not delete auth-db"
else
    print_info "D1 database 'auth-db' does not exist, skipping"
fi

# Delete KV namespaces (OLD names without suffix)
for kv_name in "token-blacklist-kv" "rate-limiter-kv" "session-cache-kv"; do
    print_info "Checking for KV namespace: $kv_name"
    
    # Get namespace ID
    KV_ID=$(wrangler kv namespace list 2>/dev/null | grep "\"$kv_name\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [[ -n "$KV_ID" ]]; then
        print_info "Deleting KV namespace: $kv_name (ID: $KV_ID)..."
        wrangler kv namespace delete --namespace-id="$KV_ID" --force 2>/dev/null && print_success "Deleted $kv_name" || print_warning "Could not delete $kv_name"
    else
        print_info "KV namespace '$kv_name' does not exist, skipping"
    fi
done

echo ""
print_success "Cloudflare cleanup complete!"
echo ""
print_success "All OLD resources cleaned up! You can now run: pulumi up"
echo ""
