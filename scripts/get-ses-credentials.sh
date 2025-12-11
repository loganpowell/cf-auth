#!/bin/bash

# Get AWS SES credentials from Pulumi Stack for local testing
# This script retrieves the credentials so you can test actual email sending

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🔑 AWS SES Credentials for Local Testing                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd infrastructure

# Set passphrase from parent .env
export PULUMI_CONFIG_PASSPHRASE=$(grep PULUMI_CONFIG_PASSPHRASE ../.env | cut -d'=' -f2)

echo "Retrieving AWS credentials from Pulumi stack..."
echo ""

# Get the credentials from stack outputs
AWS_ACCESS_KEY=$(pulumi stack output awsAccessKeyId 2>/dev/null)
AWS_SECRET_KEY=$(pulumi stack output awsSecretAccessKey --show-secrets 2>/dev/null)
AWS_REGION=$(pulumi stack output awsRegion 2>/dev/null)
EMAIL_FROM=$(pulumi stack output emailFrom 2>/dev/null)

if [ -z "$AWS_ACCESS_KEY" ] || [ -z "$AWS_SECRET_KEY" ]; then
    echo "❌ Failed to retrieve AWS credentials from Pulumi stack"
    echo ""
    echo "Make sure you've deployed the infrastructure:"
    echo "  cd infrastructure"
    echo "  pulumi up"
    exit 1
fi

echo "✅ Credentials retrieved successfully!"
echo ""
echo "Add these to your .env file to test AWS SES email sending:"
echo ""
echo "# AWS SES Credentials (from Pulumi Stack)"
echo "AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY"
echo "AWS_SECRET_ACCESS_KEY=$AWS_SECRET_KEY"
echo "AWS_REGION=$AWS_REGION"
echo "EMAIL_FROM=$EMAIL_FROM"
echo ""
echo "Then uncomment this line in .env to enable production mode:"
echo "ENVIRONMENT=production"
echo ""
echo "⚠️  Remember to comment out ENVIRONMENT=production when done testing!"
echo ""

