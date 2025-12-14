# Quick Reference: Seed Data

## Test Credentials

Use these pre-configured test accounts for E2E testing and development:

| Email                      | Password         | Role   | Status    | Verified | Use Case                                     |
| -------------------------- | ---------------- | ------ | --------- | -------- | -------------------------------------------- |
| **admin@example.com**      | `Admin123!`      | Admin  | Active    | ✅       | Full system access, testing admin features   |
| **member@example.com**     | `Member123!`     | Member | Active    | ✅       | Standard user testing, read/write operations |
| **viewer@example.com**     | `Viewer123!`     | Viewer | Active    | ✅       | Read-only access testing                     |
| **unverified@example.com** | `Unverified123!` | None   | Active    | ❌       | Testing unverified user flows                |
| **suspended@example.com**  | `Suspended123!`  | Member | Suspended | ✅       | Testing suspended account handling           |

## Quick Setup

```bash
# Clean database and apply seed data
./scripts/database/cleanup-db.sh --seed
```

This creates:

- ✅ 4 system roles (Admin, Member, Viewer, Billing Manager)
- ✅ 5 test users with different states
- ✅ 4 role assignments (admin→Admin, member→Member, viewer→Viewer, suspended→Member)

## Database Contents

After seeding, your database will have:

### Roles

- **Admin** - 29 permissions across all domains
- **Member** - 11 permissions (read/write access)
- **Viewer** - 7 permissions (read-only)
- **Billing Manager** - 4 permissions (billing only)

### Users

- 5 users with varied email verification and account statuses
- All users have SHA-256 hashed passwords
- Different last login states (some null, some recent)

### Role Assignments

- Admin user has full Admin role
- Member user has Member role
- Viewer user has Viewer role
- Suspended user has Member role (but account is suspended)
- Unverified user has no role assigned yet

## Testing Workflows

### 1. Test User Picker

```bash
# Login as admin
Email: admin@example.com
Password: Admin123!

# Navigate to /dashboard/permissions
# User picker should show all 5 users
# Try searching by email/name
```

### 2. Test Role Assignment

```bash
# As admin, grant Viewer role to unverified user
# Verify unverified user now has Viewer permissions
# Try revoking the role
```

### 3. Test Permission Restrictions

```bash
# Login as viewer@example.com
# Try creating a custom role (should fail - no PERM_ROLE_CREATE)
# Try viewing roles (should work - has PERM_ROLE_READ)
```

### 4. Test Suspended Account

```bash
# Try logging in as suspended@example.com
# Should be blocked at login (suspended status)
# Verify UI shows appropriate error
```

### 5. Test Unverified User

```bash
# Login as unverified@example.com
# Email verification banner should show
# Try accessing protected features
```

## Updating Seed Data

To add more test data, edit:

```
/scripts/database/seed-data.ts
```

Then regenerate:

```bash
./scripts/database/cleanup-db.sh --seed
```

## Adding New Users

Add to the `USERS` array in `seed-data.ts`:

```typescript
const newUser = {
  id: generateId("user"),
  email: "test@example.com",
  displayName: "Test User",
  passwordHash: hashPassword("Test123!"),
  emailVerified: true,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: null,
};
```

## Adding Role Assignments

Add to the `ROLE_ASSIGNMENTS` array:

```typescript
{
  id: generateId("assignment"),
  userId: newUser.id,
  roleId: ROLES[0].id, // Admin role
  grantedBy: adminUser.id,
  createdAt: timestamp,
}
```

## Verification Queries

Check seeded data:

```bash
# List all roles
wrangler d1 execute auth-db --local --command \
  "SELECT name, description, is_system FROM roles ORDER BY name;"

# List all users
wrangler d1 execute auth-db --local --command \
  "SELECT email, display_name, email_verified, status FROM users ORDER BY email;"

# List role assignments
wrangler d1 execute auth-db --local --command \
  "SELECT u.email, r.name as role FROM role_assignments ra
   JOIN users u ON ra.user_id = u.id
   JOIN roles r ON ra.role_id = r.id;"
```

## Notes

- Passwords are hashed with SHA-256 (simple hash for dev/testing)
- User IDs and Role IDs are randomly generated each time (use UUID pattern)
- Timestamps are set to current time when script runs
- All data is inserted via SQL (no API calls required)
- Script is idempotent when combined with cleanup-db.sh (fresh start each time)

## Production Considerations

⚠️ **Do NOT use seed data in production:**

- Test passwords are publicly documented
- User IDs are predictable patterns
- No proper password stretching/salting for production use
- No rate limiting on these accounts

For production:

- Use proper user registration flow
- Implement strong password hashing (bcrypt/argon2)
- Enforce password complexity requirements
- Enable email verification
- Add rate limiting
- Use proper RBAC with delegated permissions
