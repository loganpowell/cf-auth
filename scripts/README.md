# Scripts Organization

This directory contains utility scripts organized by purpose.

## Directory Structure

### 📡 `openapi/`

OpenAPI specification generation and SDK type generation.

- **generate-openapi.ts** - Generates `openapi.json` from Zod schemas
- **fix-openapi-nullable.ts** - Post-processes spec to fix nullable field format for OpenAPI 3.1.0 compliance

**Usage:**

```bash
pnpm run generate:openapi  # Generate OpenAPI spec
pnpm run generate:sdk      # Generate spec + TypeScript SDK types
```

### 🗄️ `database/`

Database management and cleanup utilities.

- **cleanup-db.sh** - Removes all users from local D1 development database
- **delete-user.sh** - Deletes a specific user by email

**Usage:**

```bash
./scripts/database/cleanup-db.sh
./scripts/database/delete-user.sh user@example.com
```

### ✉️ `email/`

Email template compilation and management.

- **compile-emails.ts** - Compiles MJML templates to HTML (Phase 3)
- **test-email.sh** - Test email sending functionality

**Usage:**

```bash
pnpm run compile:emails
./scripts/email/test-email.sh
```

### ☁️ `aws/`

AWS infrastructure and SES (Simple Email Service) management.

- **check-ses-status.sh** - Check AWS SES verification status
- **check-ses-verification.sh** - Verify SES domain/email setup
- **verify-ses-dns.sh** - Verify DNS records for SES
- **get-ses-credentials.sh** - Retrieve SES SMTP credentials
- **cleanup-aws-resources.sh** - Clean up AWS resources

### ☁️ `pulumi/`

- **cleanup-all-resources.sh** - Clean up all infrastructure (AWS + Cloudflare)

**Usage:**

```bash
./scripts/aws/check-ses-status.sh
./scripts/aws/verify-ses-dns.sh
```

### 🧪 `testing/`

Integration and end-to-end testing scripts.

- **test-registration-flow.sh** - Test complete registration flow
- **test-registration-backend.sh** - Test backend registration endpoint
- **test-email.sh** - Test email functionality
- **test-ses-email.sh** - Test AWS SES email sending

**Usage:**

```bash
./scripts/testing/test-registration-flow.sh
./scripts/testing/test-ses-email.sh
```

## Making Scripts Executable

If a script isn't executable, run:

```bash
chmod +x scripts/<category>/<script-name>.sh
```

## Adding New Scripts

When adding new scripts:

1. Place them in the appropriate category directory
2. Make them executable if they're shell scripts
3. Update this README with a brief description
4. If the script is commonly used, add it to `package.json` scripts section
