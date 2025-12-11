# Testing AWS SES Email Delivery

This guide explains how to test actual email sending with AWS SES.

## Quick Start (Development Mode - Default)

By default, emails are logged to the console instead of being sent:

```bash
# Start backend
pnpm run dev

# In another terminal, run the test
./scripts/test-registration-backend.sh
```

The verification token will be shown in the backend console output.

## Testing Real Email Delivery (Production Mode)

To test actual email sending via AWS SES:

### Step 1: Get AWS Credentials

Run this script to get your AWS SES credentials from Pulumi ESC:

```bash
chmod +x scripts/get-ses-credentials.sh
./scripts/get-ses-credentials.sh
```

### Step 2: Add Credentials to .env

Copy the output and add it to your `.env` file:

```bash
# AWS SES Credentials (from Pulumi ESC)
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here

# Enable production mode for testing
ENVIRONMENT=production
```

### Step 3: Restart Backend

Stop the current backend (Ctrl+C) and start it again to load the new environment variables:

```bash
pnpm run dev
```

### Step 4: Run the Test

```bash
./scripts/test-registration-backend.sh
```

You should receive a real email at the address you provide!

### Step 5: Cleanup

**Important:** After testing, comment out the production mode in `.env`:

```bash
# Set to "production" to test actual AWS SES email sending
# ENVIRONMENT=production
```

You can also remove the AWS credentials from `.env` if you don't need them for local testing anymore.

## Troubleshooting

### Email Not Received

1. **Check spam folder** - AWS SES emails sometimes get flagged
2. **Verify domain** - Ensure your domain is verified in AWS SES Console
3. **Check SES sandbox** - If in sandbox mode, recipient email must be verified too
4. **Check backend logs** - Look for AWS SES errors in the console

### Common Errors

**"Email service not configured"**

- Make sure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in `.env`
- Make sure `ENVIRONMENT=production` is set

**"Failed to send email via AWS SES: 403"**

- Check AWS credentials are correct
- Verify SES domain is verified
- Check IAM permissions for SES SendEmail

**"Email already registered"**

- The test script now automatically resends verification if email exists
- Or manually test resend with:
  ```bash
  curl -X POST http://localhost:8787/v1/auth/resend-verification \
    -H "Content-Type: application/json" \
    -d '{"email": "your-email@example.com"}'
  ```

## Development vs Production

| Mode        | Email Delivery    | Use Case                            |
| ----------- | ----------------- | ----------------------------------- |
| Development | Logged to console | Fast testing, no email required     |
| Production  | Sent via AWS SES  | Real email testing, end-to-end flow |

The test script automatically detects which mode you're in and adjusts the instructions accordingly.
