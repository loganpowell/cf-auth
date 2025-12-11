#!/bin/bash

# Check AWS SES domain verification status using the API
# This uses the credentials from .env to check if mail.rel.sh is verified

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🔍 AWS SES Domain Verification Status                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load environment variables
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

source .env

# Check required variables
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_REGION" ]; then
    echo -e "${RED}✗ Missing AWS credentials in .env${NC}"
    exit 1
fi

DOMAIN="mail.rel.sh"

echo -e "${BLUE}📍 Configuration:${NC}"
echo "   Domain: $DOMAIN"
echo "   Region: $AWS_REGION"
echo ""

# We'll use a Node.js script to properly sign the request with AWS SigV4
cat > /tmp/check-ses-verification.js << 'EOFJS'
const crypto = require('crypto');

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-2';
const DOMAIN = 'mail.rel.sh';

// AWS Signature Version 4 signing
function sha256(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = hmac('AWS4' + key, dateStamp);
    const kRegion = hmac(kDate, regionName);
    const kService = hmac(kRegion, serviceName);
    const kSigning = hmac(kService, 'aws4_request');
    return kSigning;
}

async function checkSESVerification() {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    
    const method = 'POST';
    const service = 'ses';
    const host = `email.${AWS_REGION}.amazonaws.com`;
    const endpoint = `https://${host}/v2/email/identities/${DOMAIN}`;
    
    const canonicalUri = `/v2/email/identities/${DOMAIN}`;
    const canonicalQuerystring = '';
    const payloadHash = sha256('');
    
    const canonicalHeaders = `host:${host}\n` +
                           `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    
    const signingKey = getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signature = hmac(signingKey, stringToSign).toString('hex');
    
    const authorizationHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Host': host,
                'X-Amz-Date': amzDate,
                'Authorization': authorizationHeader,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP ${response.status}: ${errorText}`);
            return null;
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}

(async () => {
    const result = await checkSESVerification();
    if (result) {
        console.log(JSON.stringify(result, null, 2));
    }
})();
EOFJS

echo -e "${BLUE}🔍 Checking domain verification status...${NC}"
echo ""

# Run the Node.js script
VERIFICATION_STATUS=$(node /tmp/check-ses-verification.js)

if [ $? -eq 0 ] && [ -n "$VERIFICATION_STATUS" ]; then
    echo "$VERIFICATION_STATUS" | jq -r '
        if .VerifiedForSendingStatus == true then
            "✅ Domain is VERIFIED and ready to send emails"
        else
            "⏳ Domain verification is PENDING\n   Status: Waiting for DNS propagation"
        end
    '
    
    echo ""
    echo -e "${BLUE}📊 Full Status:${NC}"
    echo "$VERIFICATION_STATUS" | jq '{
        VerifiedForSendingStatus,
        DkimAttributes: .DkimAttributes.Status,
        MailFromAttributes: .MailFromAttributes.MailFromDomainStatus
    }'
else
    echo -e "${YELLOW}⚠️  Could not retrieve verification status${NC}"
    echo ""
    echo -e "${BLUE}💡 Manual Check:${NC}"
    echo "   Go to: https://console.aws.amazon.com/ses/home?region=${AWS_REGION}#/verified-identities"
    echo "   Look for: $DOMAIN"
    echo ""
fi

# Cleanup
rm -f /tmp/check-ses-verification.js

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
