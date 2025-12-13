#!/bin/bash

# Check AWS SES Status and Sandbox Mode

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔍 AWS SES Diagnostics                                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load environment
cd "$(dirname "$0")/.."
source .env 2>/dev/null || true

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "❌ AWS credentials not configured in .env"
    exit 1
fi

AWS_REGION=${AWS_REGION:-us-east-1}

echo "📍 Configuration:"
echo "   Region: $AWS_REGION"
echo "   From Email: ${EMAIL_FROM:-not set}"
echo ""

# Check SES sending quota (indicates if in sandbox)
echo "🔍 Checking SES account status..."
echo ""

RESPONSE=$(curl -s -X POST "https://email.${AWS_REGION}.amazonaws.com/" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: SimpleEmailService.GetSendQuota" \
  -d '{}' 2>&1 || echo '{"error": "failed"}')

echo "Raw Response:"
echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "SentLast24Hours"; then
    echo "✅ Successfully connected to SES"
    echo ""
    echo "Send Quota Details:"
    echo "$RESPONSE" | grep -oE '"[^"]+"\s*:\s*[0-9.]+' || echo "Could not parse quota"
else
    echo "⚠️  Could not get SES quota (might need AWS SigV4 signing)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Common Issues:"
echo ""
echo "1. **SES Sandbox Mode** (most likely):"
echo "   - In sandbox mode, you can ONLY send to verified email addresses"
echo "   - To verify an email:"
echo "     a. Go to: https://console.aws.amazon.com/ses/home?region=${AWS_REGION}#/verified-identities"
echo "     b. Click 'Create identity'"
echo "     c. Enter: loganpowell@gmail.com"
echo "     d. Check your email for verification link"
echo ""
echo "2. **Domain Not Verified:**"
echo "   - Your domain ${EMAIL_FROM} must be verified in SES"
echo "   - Check: https://console.aws.amazon.com/ses/home?region=${AWS_REGION}#/verified-identities"
echo ""
echo "3. **Request Production Access:**"
echo "   - To send to any email, request production access"
echo "   - Go to: https://console.aws.amazon.com/ses/home?region=${AWS_REGION}#/account"
echo "   - Click 'Request production access'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
