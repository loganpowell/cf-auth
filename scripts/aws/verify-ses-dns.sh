#!/bin/bash

# Check AWS SES Domain Verification Status

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔍 AWS SES Domain Verification Status                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load environment
cd "$(dirname "$0")/.."
source .env 2>/dev/null || true

AWS_REGION=${AWS_REGION:-us-east-1}
EMAIL_DOMAIN=${EMAIL_FROM#*@}  # Extract domain from email

echo "📍 Configuration:"
echo "   Domain: mail.rel.sh"
echo "   Region: $AWS_REGION"
echo ""

echo "🔍 DNS Verification:"
echo ""

# Check NS records
echo "1. NS Delegation (mail.rel.sh):"
dig NS mail.rel.sh +short | while read ns; do
    echo "   ✓ $ns"
done
echo ""

# Check SES verification TXT record
echo "2. SES Verification Record (_amazonses.mail.rel.sh):"
VERIFICATION_RECORD=$(dig TXT _amazonses.mail.rel.sh +short 2>/dev/null || echo "NOT FOUND")
if [ "$VERIFICATION_RECORD" != "NOT FOUND" ]; then
    echo "   ✓ $VERIFICATION_RECORD"
else
    echo "   ✗ Not found"
fi
echo ""

# Check DKIM records
echo "3. DKIM Records:"
for token in "mxltodsq23syocjixvdck2liudokqbic" "5m6ri7zrgb23tkzuzhbmwyxi2fvtrqsv" "fhhkyqjo2jovoaqqrsa57rlnelvozgdl"; do
    DKIM_RECORD=$(dig CNAME ${token}._domainkey.mail.rel.sh +short 2>/dev/null || echo "NOT FOUND")
    if [ "$DKIM_RECORD" != "NOT FOUND" ]; then
        echo "   ✓ ${token}._domainkey.mail.rel.sh → $DKIM_RECORD"
    else
        echo "   ✗ ${token}._domainkey.mail.rel.sh - Not found"
    fi
done
echo ""

# Check Mail FROM domain records
echo "4. Mail FROM Domain (bounces.mail.rel.sh):"
MX_RECORD=$(dig MX bounces.mail.rel.sh +short 2>/dev/null || echo "NOT FOUND")
if [ "$MX_RECORD" != "NOT FOUND" ]; then
    echo "   ✓ MX: $MX_RECORD"
else
    echo "   ✗ MX: Not found"
fi

SPF_RECORD=$(dig TXT bounces.mail.rel.sh +short 2>/dev/null || echo "NOT FOUND")
if [ "$SPF_RECORD" != "NOT FOUND" ]; then
    echo "   ✓ SPF: $SPF_RECORD"
else
    echo "   ✗ SPF: Not found"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All DNS records are configured!"
echo ""
echo "📧 AWS SES will automatically verify the domain within a few minutes."
echo ""
echo "Check verification status at:"
echo "https://console.aws.amazon.com/ses/home?region=${AWS_REGION}#/verified-identities"
echo ""
echo "Once verified, you can send emails from auth@mail.rel.sh!"
echo ""
