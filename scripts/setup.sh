#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}==========================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}==========================================================${NC}\n"
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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    local missing=0
    
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) not installed"
        echo "  Install: brew install gh"
        missing=1
    fi
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not installed"
        echo "  Install: brew install awscli"
        missing=1
    fi
    
    if ! command -v pulumi &> /dev/null; then
        print_error "Pulumi CLI not installed"
        echo "  Install: brew install pulumi/tap/pulumi"
        missing=1
    fi
    
    if [[ $missing -eq 1 ]]; then
        exit 1
    fi
    
    # Check authentication
    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi
    
    if ! aws sts get-caller-identity --no-cli-pager &> /dev/null; then
        print_error "AWS CLI not configured. Run: aws configure"
        exit 1
    fi
    
    if ! pulumi whoami &> /dev/null; then
        print_error "Not logged in to Pulumi. Run: pulumi login"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Get GitHub repository
get_github_repo() {
    local remote_url=$(git config --get remote.origin.url 2>/dev/null || echo "")
    
    if [[ -n "$remote_url" ]] && [[ "$remote_url" =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
        echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    else
        echo ""
    fi
}

print_header "Simplified Infrastructure Setup for cf-auth"

echo "This script will:"
echo "  ✓ Deploy complete infrastructure with one command"
echo "  ✓ Create OIDC providers (GitHub Actions, Pulumi ESC)"
echo "  ✓ Create AWS SES with automated DNS (Route53)"
echo "  ✓ Create Cloudflare resources (D1, KV namespaces)"
echo "  ✓ Configure GitHub repository secrets"
echo "  ✓ Set up Pulumi ESC environment for secrets"
echo ""

read -p "Press Enter to continue..."

# Step 1: Prerequisites
print_header "Step 1: Checking Prerequisites"
check_prerequisites

# Step 2: Gather configuration
print_header "Step 2: Configuration"

# GitHub repository
GITHUB_REPO=$(get_github_repo)
if [[ -z "$GITHUB_REPO" ]]; then
    read -p "GitHub repository (owner/repo): " GITHUB_REPO
else
    print_info "Detected repository: $GITHUB_REPO"
    read -p "Is this correct? (Y/n): " confirm
    confirm=${confirm:-Y}
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        read -p "Enter GitHub repository (owner/repo): " GITHUB_REPO
    fi
fi

GITHUB_OWNER=$(echo "$GITHUB_REPO" | cut -d'/' -f1)
print_success "Using repository: $GITHUB_REPO"

# AWS Region
AWS_REGION=$(aws configure get region --no-cli-pager 2>/dev/null || echo "us-east-1")
print_info "Detected AWS region: $AWS_REGION"
read -p "Use this region? (Y/n): " use_region
use_region=${use_region:-Y}
if [[ "$use_region" != "y" && "$use_region" != "Y" ]]; then
    read -p "Enter AWS region: " AWS_REGION
fi
print_success "Using AWS region: $AWS_REGION"

# Cloudflare Account ID
read -p "Cloudflare Account ID: " CF_ACCOUNT_ID

# Email configuration
echo ""
print_info "Email Configuration"
echo "Configure the domain(s) for sending and receiving email bounces."
echo ""
read -p "Apex domain (e.g., example.com): " APEX_DOMAIN

echo ""
print_info "Email sending domain (optional subdomain)"
echo "This is where you'll send emails FROM."
echo "Examples:"
echo "  - Leave empty for apex: example.com"
echo "  - Use subdomain: auth (becomes auth.example.com)"
echo ""
read -p "Email subdomain (optional, press Enter for apex): " EMAIL_SUBDOMAIN

if [[ -n "$EMAIL_SUBDOMAIN" ]]; then
    EMAIL_DOMAIN="${EMAIL_SUBDOMAIN}.${APEX_DOMAIN}"
    print_success "Email domain: $EMAIL_DOMAIN"
else
    EMAIL_DOMAIN="$APEX_DOMAIN"
    print_success "Email domain: $EMAIL_DOMAIN (apex)"
fi

echo ""
read -p "Email FROM address (e.g., noreply@$EMAIL_DOMAIN): " EMAIL_FROM
EMAIL_FROM=${EMAIL_FROM:-noreply@$EMAIL_DOMAIN}
read -p "Email FROM name (e.g., Your App): " EMAIL_FROM_NAME
EMAIL_FROM_NAME=${EMAIL_FROM_NAME:-"Auth Service"}

# Mail FROM domain (for bounce handling)
echo ""
print_info "Bounce handling domain configuration"
echo "AWS SES requires the bounce domain to be a SUBDOMAIN of your email domain."
echo "Current email domain: $EMAIL_DOMAIN"
echo ""
echo "Examples:"
echo "  - bounces.$EMAIL_DOMAIN (default)"
echo "  - mail.$EMAIL_DOMAIN"
echo "  - feedback.$EMAIL_DOMAIN"
echo ""
read -p "Bounce subdomain prefix (default: bounces): " BOUNCE_PREFIX
BOUNCE_PREFIX=${BOUNCE_PREFIX:-bounces}

MAIL_FROM_DOMAIN="${BOUNCE_PREFIX}.${EMAIL_DOMAIN}"
print_success "Bounce domain: $MAIL_FROM_DOMAIN"

# Route53 hosted zone
echo ""
print_info "Route53 DNS Configuration"
echo "For automated DNS setup, you need a Route53 hosted zone."
echo ""
read -p "Do you have an existing Route53 hosted zone for $EMAIL_DOMAIN? (y/N): " has_zone
has_zone=${has_zone:-N}

if [[ "$has_zone" != "y" && "$has_zone" != "Y" ]]; then
    print_warning "No existing hosted zone found"
    echo "A new Route53 hosted zone will be created for $EMAIL_DOMAIN"
    echo ""
    read -p "Create hosted zone for $EMAIL_DOMAIN? (Y/n): " create_zone
    create_zone=${create_zone:-Y}
    
    if [[ "$create_zone" == "y" || "$create_zone" == "Y" ]]; then
        CREATE_HOSTED_ZONE="true"
        print_info "After deployment, you'll need to update your parent domain's NS records"
    else
        CREATE_HOSTED_ZONE="false"
        print_warning "DNS will NOT be automated. You'll need to configure DNS records manually."
    fi
else
    CREATE_HOSTED_ZONE="false"
    print_success "Will use existing Route53 hosted zone"
fi

# Pulumi passphrase
if [[ ! -f "infrastructure/.env" ]]; then
    print_warning "infrastructure/.env not found"
    read -p "Pulumi config passphrase: " PULUMI_PASSPHRASE
    echo "PULUMI_CONFIG_PASSPHRASE=$PULUMI_PASSPHRASE" > infrastructure/.env
    print_success "Created infrastructure/.env"
else
    print_success "infrastructure/.env exists"
fi

source infrastructure/.env
export PULUMI_CONFIG_PASSPHRASE

# Step 3: Deploy infrastructure
print_header "Step 3: Deploy Infrastructure"

cd infrastructure

# Check if stack exists
if ! pulumi stack select dev 2>/dev/null; then
    print_info "Creating new stack: dev"
    pulumi stack init dev
fi

# Set configuration
print_info "Configuring Pulumi stack..."
pulumi config set aws:region "$AWS_REGION"
pulumi config set cloudflareAccountId "$CF_ACCOUNT_ID"
pulumi config set githubRepository "$GITHUB_REPO"
pulumi config set emailDomain "$EMAIL_DOMAIN"
pulumi config set emailFrom "$EMAIL_FROM"
pulumi config set emailFromName "$EMAIL_FROM_NAME"

# Set bounce domain (always set since it's required by AWS SES)
pulumi config set emailBounceDomain "$MAIL_FROM_DOMAIN"

# Set createHostedZone flag if needed
if [[ "$CREATE_HOSTED_ZONE" == "true" ]]; then
    pulumi config set createHostedZone true
    print_info "Will create new Route53 hosted zone"
fi

# Check for existing OIDC providers
print_info "Checking for existing AWS resources..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --no-cli-pager)

if ! pulumi stack export | grep -q "github-oidc-provider" 2>/dev/null; then
    if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" --no-cli-pager &>/dev/null; then
        export IMPORT_GITHUB_OIDC="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
        print_info "Will import existing GitHub OIDC provider"
    fi
fi

if ! pulumi stack export | grep -q "pulumi-oidc-provider" 2>/dev/null; then
    if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/api.pulumi.com/oidc" --no-cli-pager &>/dev/null; then
        export IMPORT_PULUMI_OIDC="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/api.pulumi.com/oidc"
        print_info "Will import existing Pulumi OIDC provider"
    fi
fi

# Deploy everything
print_info "Deploying complete infrastructure..."
echo ""
pulumi up --yes

# Get outputs
GITHUB_ACTIONS_ROLE_ARN=$(pulumi stack output githubActionsRoleArn)
PULUMI_ESC_ROLE_ARN=$(pulumi stack output pulumiEscRoleArn)
DNS_CREATED=$(pulumi stack output dnsRecordsCreated 2>/dev/null || echo "false")
HOSTED_ZONE_CREATED=$(pulumi stack output hostedZoneCreated 2>/dev/null || echo "false")
HOSTED_ZONE_ID=$(pulumi stack output hostedZoneId 2>/dev/null || echo "")

cd ..

print_success "Infrastructure deployed!"
echo ""
echo "  GitHub Actions Role: $GITHUB_ACTIONS_ROLE_ARN"
echo "  Pulumi ESC Role: $PULUMI_ESC_ROLE_ARN"
echo "  DNS Records Created: $DNS_CREATED"

# Show nameserver information if we created a hosted zone
if [[ "$HOSTED_ZONE_CREATED" == "true" ]]; then
    echo ""
    print_warning "New Route53 Hosted Zone Created!"
    echo ""
    echo "  Hosted Zone ID: $HOSTED_ZONE_ID"
    echo ""
    cd infrastructure
    NAMESERVERS=$(pulumi stack output hostedZoneNameServers 2>/dev/null || echo "")
    cd ..
    
    if [[ -n "$NAMESERVERS" ]]; then
        echo "  Add these NS records to your parent domain:"
        echo "  $NAMESERVERS"
        echo ""
        print_info "Update the NS records at your parent domain's DNS provider"
    fi
fi

# Step 4: Configure GitHub Secrets
print_header "Step 4: Configure GitHub Secrets"

print_info "Setting GitHub repository secrets..."

gh secret set AWS_ROLE_ARN --body "$GITHUB_ACTIONS_ROLE_ARN" --repo "$GITHUB_REPO"
print_success "Set AWS_ROLE_ARN"

# Optional secrets
read -p "Set Pulumi access token? (Y/n): " set_pulumi_token
set_pulumi_token=${set_pulumi_token:-Y}
if [[ "$set_pulumi_token" == "y" || "$set_pulumi_token" == "Y" ]]; then
    read -p "Pulumi access token: " PULUMI_TOKEN
    gh secret set PULUMI_ACCESS_TOKEN --body "$PULUMI_TOKEN" --repo "$GITHUB_REPO"
    print_success "Set PULUMI_ACCESS_TOKEN"
fi

read -p "Set Cloudflare API token? (Y/n): " set_cf_token
set_cf_token=${set_cf_token:-Y}
if [[ "$set_cf_token" == "y" || "$set_cf_token" == "Y" ]]; then
    read -p "Cloudflare API token: " CF_API_TOKEN
    gh secret set CF_API_TOKEN --body "$CF_API_TOKEN" --repo "$GITHUB_REPO"
    print_success "Set CF_API_TOKEN"
fi

gh secret set CF_ACCOUNT_ID --body "$CF_ACCOUNT_ID" --repo "$GITHUB_REPO"
print_success "Set CF_ACCOUNT_ID"

# Step 5: Pulumi ESC Environment
print_header "Step 5: Pulumi ESC Environment"

echo "Pulumi ESC provides centralized secret management via OIDC."
echo ""

read -p "Create Pulumi ESC environment? (Y/n): " create_esc
create_esc=${create_esc:-Y}

if [[ "$create_esc" == "y" || "$create_esc" == "Y" ]]; then
    ESC_ENV_NAME="cf-auth-$AWS_REGION"
    
    print_info "Creating ESC environment: $GITHUB_OWNER/$ESC_ENV_NAME"
    
    # Create ESC environment file
    cat > /tmp/esc-environment.yaml << EOF
values:
  aws:
    login:
      fn::open::aws-login:
        oidc:
          roleArn: $PULUMI_ESC_ROLE_ARN
          sessionName: pulumi-esc-session
          duration: 1h
  
  secrets:
    fn::open::aws-secrets:
      region: $AWS_REGION
      login: \${aws.login}
      get:
        sesCredentials:
          secretId: cf-auth/ses-credentials-dev
  
  environmentVariables:
    AWS_REGION: $AWS_REGION
    AWS_ACCESS_KEY_ID: \${secrets.sesCredentials.awsAccessKeyId}
    AWS_SECRET_ACCESS_KEY: \${secrets.sesCredentials.awsSecretAccessKey}
  
  pulumiConfig:
    aws:region: $AWS_REGION
EOF
    
    # Create environment
    pulumi env init "$GITHUB_OWNER/$ESC_ENV_NAME" 2>/dev/null || true
    EDITOR="tee" pulumi env edit "$GITHUB_OWNER/$ESC_ENV_NAME" < /tmp/esc-environment.yaml > /dev/null
    rm /tmp/esc-environment.yaml
    
    print_success "Created Pulumi ESC environment: $GITHUB_OWNER/$ESC_ENV_NAME"
    echo ""
    echo "To use in your Pulumi stacks:"
    echo "  pulumi config env add $GITHUB_OWNER/$ESC_ENV_NAME"
fi

# Summary
print_header "Setup Complete! 🎉"

echo "What was configured:"
echo ""
echo "  ✓ Complete infrastructure (OIDC, SES, Cloudflare)"
echo "  ✓ DNS records automated via Route53"
echo "  ✓ GitHub repository secrets"
if [[ "$create_esc" == "y" || "$create_esc" == "Y" ]]; then
    echo "  ✓ Pulumi ESC environment"
fi
echo ""

print_header "Next Steps"

if [[ "$DNS_CREATED" == "true" ]]; then
    echo "1. ✅ DNS records created automatically"
    echo ""
    echo "   Verify SES domain (may take 5-10 minutes):"
    echo "   $ aws ses get-identity-verification-attributes --identities $EMAIL_DOMAIN --region $AWS_REGION"
    echo ""
else
    print_warning "DNS records not created automatically"
    echo ""
    echo "1. Add DNS records manually (see DNS_RECORDS.md)"
    echo ""
fi

echo "2. Configure Cloudflare Worker Secrets"
echo ""
cd infrastructure
AWS_ACCESS_KEY=$(pulumi stack output awsAccessKeyId 2>/dev/null || echo "<not-deployed>")
AWS_SECRET=$(pulumi stack output awsSecretAccessKey --show-secrets 2>/dev/null || echo "<not-deployed>")
cd ..

echo "   Option A - Using wrangler (recommended for development):"
echo "   $ echo '$AWS_ACCESS_KEY' | wrangler secret put AWS_ACCESS_KEY_ID"
echo "   $ echo '<secret>' | wrangler secret put AWS_SECRET_ACCESS_KEY"
echo "   $ wrangler secret put JWT_SECRET"
echo ""
echo "   Option B - Using Pulumi ESC (recommended for production):"
if [[ "$create_esc" == "y" || "$create_esc" == "Y" ]]; then
    echo "   ✅ ESC environment already configured: $GITHUB_OWNER/$ESC_ENV_NAME"
    echo "   $ pulumi env open $GITHUB_OWNER/$ESC_ENV_NAME"
    echo "   $ wrangler deploy"
else
    echo "   $ pulumi env init $GITHUB_OWNER/cf-auth-$AWS_REGION"
    echo "   $ pulumi env edit $GITHUB_OWNER/cf-auth-$AWS_REGION"
    echo "   (Add AWS SES credentials from Pulumi outputs)"
fi
echo ""

echo "3. Deploy Cloudflare Worker"
echo ""
echo "   $ wrangler deploy"
echo ""

echo "4. AWS SES Production Access (Required for sending to any email)"
echo ""
echo "   ⚠  AWS SES starts in SANDBOX MODE with limitations:"
echo "   - Can only send to verified email addresses"
echo "   - Lower sending limits (200 emails/day)"
echo ""
echo "   Steps to enable production access:"
echo ""
echo "   a. Request production access:"
echo "      https://console.aws.amazon.com/ses/home?region=$AWS_REGION#/account"
echo ""
echo "   b. Fill out the form:"
echo "      - Mail type: Transactional"
echo "      - Use case: Authentication emails (verification, password reset)"
echo "      - Expected volume: <100 emails/day initially"
echo "      - Note: We have bounce/complaint handling via SNS topics"
echo ""
echo "   c. While waiting for approval (24-48 hrs), verify test emails:"
echo "      https://console.aws.amazon.com/ses/home?region=$AWS_REGION#/verified-identities"
echo "      Click 'Create identity' > Email address > Enter your test email"
echo ""
echo "5. Test email sending"
echo ""
echo "   $ ./scripts/test-registration-backend.sh"
echo ""

print_header "Resources"

cd infrastructure
D1_DB_ID=$(pulumi stack output d1DatabaseId 2>/dev/null || echo "not deployed")
RATE_LIMITER_KV=$(pulumi stack output rateLimiterKvId 2>/dev/null || echo "not deployed")
SESSION_CACHE_KV=$(pulumi stack output sessionCacheKvId 2>/dev/null || echo "not deployed")
TOKEN_BLACKLIST_KV=$(pulumi stack output tokenBlacklistKvId 2>/dev/null || echo "not deployed")
cd ..

echo ""
echo "Deployed Resources:"
echo "  D1 Database:        $D1_DB_ID"
echo "  Rate Limiter KV:    $RATE_LIMITER_KV"
echo "  Session Cache KV:   $SESSION_CACHE_KV"
echo "  Token Blacklist KV: $TOKEN_BLACKLIST_KV"
echo ""
echo "Useful Commands:"
echo "  View outputs:    cd infrastructure && pulumi stack output"
echo "  View secrets:    cd infrastructure && pulumi stack output --show-secrets"
echo "  Deploy worker:   wrangler deploy"
echo "  View logs:       wrangler tail"
echo "  Update infra:    cd infrastructure && pulumi up"
echo ""

print_info "Setup complete! Follow the next steps above to finish deployment."
echo ""
