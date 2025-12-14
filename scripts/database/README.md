# Database Scripts

Collection of database management scripts for the CF-Auth project.

## Scripts

### 🧹 cleanup-db.sh

**Purpose:** Complete database reset - removes all Wrangler state, regenerates migrations, and creates fresh database.

**Usage:**

```bash
# Clean database only
./scripts/database/cleanup-db.sh

# Clean database AND apply seed data
./scripts/database/cleanup-db.sh --seed
```

**What it does:**

1. Deletes `.wrangler/state/v3/d1` (local database)
2. Deletes `drizzle/migrations` (old migrations)
3. Generates fresh migration from `src/db/schema.ts`
4. Applies migration to local database
5. Verifies tables were created
6. (Optional) Seeds initial data (roles + test users)

**When to use:**

- After changing database schema in `src/db/schema.ts`
- When you need a completely fresh database
- During development when test data becomes messy
- Before running E2E tests

---

### 🌱 seed-data.ts

**Purpose:** Generates comprehensive SQL seed data for development and E2E testing.

**Usage:**

```bash
# Preview SQL output
pnpm tsx scripts/database/seed-data.ts

# Apply to database
pnpm tsx scripts/database/seed-data.ts > /tmp/seed.sql
wrangler d1 execute auth-db --local --file=/tmp/seed.sql

# Or use cleanup-db.sh with --seed flag (recommended)
./scripts/database/cleanup-db.sh --seed
```

**Creates:**

**4 System Roles:**

1. **Admin** - Full permissions across all domains (29 permissions)
2. **Member** - Standard user with read/write access (11 permissions)
3. **Viewer** - Read-only access (7 permissions)
4. **Billing Manager** - Billing-focused role (4 permissions)

**5 Test Users:**

| Email                  | Password       | Role   | Status    | Verified |
| ---------------------- | -------------- | ------ | --------- | -------- |
| admin@example.com      | Admin123!      | Admin  | Active    | ✅       |
| member@example.com     | Member123!     | Member | Active    | ✅       |
| viewer@example.com     | Viewer123!     | Viewer | Active    | ✅       |
| unverified@example.com | Unverified123! | None   | Active    | ❌       |
| suspended@example.com  | Suspended123!  | Member | Suspended | ✅       |

**Role Assignments:**

- Admin user → Admin role
- Member user → Member role
- Viewer user → Viewer role
- Suspended user → Member role (but account suspended)

**Use cases:**

- E2E testing of permission system
- Testing user picker component
- Testing role assignment/revocation
- Testing different user states (verified, unverified, suspended)
- Quick login for development without registration

---

### 🗑️ seed-permissions.ts (DEPRECATED)

**Status:** ⚠️ Replaced by `seed-data.ts`

Use `seed-data.ts` instead - it includes roles AND test users for comprehensive testing.

---

### 🗑️ delete-user.sh

**Purpose:** Delete specific users from the local database.

**Usage:**

```bash
./scripts/database/delete-user.sh
```

Interactively shows current users and prompts for deletion.

---

## Workflow Examples

### Schema Changed - Need Fresh Database

```bash
# 1. Update src/db/schema.ts with your changes
vim src/db/schema.ts

# 2. Clean everything and create fresh database with seed data
./scripts/database/cleanup-db.sh --seed

# 3. Start development
pnpm run dev
```

### Need to Test Permission System

```bash
# 1. Clean database and seed roles
./scripts/database/cleanup-db.sh --seed

# 2. Register a test user via demo app
# 3. Manually grant Admin role (or modify seed script to auto-assign)
# 4. Test permissions dashboard
```

### Database Has Junk Data

```bash
# Quick reset without changing schema
./scripts/database/cleanup-db.sh --seed
```

## Migration Workflow

Our migration workflow uses Drizzle Kit:

```
┌─────────────────┐
│ src/db/schema.ts│ ← Single source of truth
└────────┬────────┘
         │
         │ drizzle-kit generate
         ↓
┌─────────────────────┐
│ drizzle/migrations/ │ ← Auto-generated SQL
└──────────┬──────────┘
           │
           │ wrangler d1 migrations apply
           ↓
     ┌──────────┐
     │ D1 Database │
     └──────────┘
```

**Key Points:**

- ✅ **Never** manually edit migration files
- ✅ **Always** change `src/db/schema.ts` first
- ✅ Use `cleanup-db.sh` for schema changes during development
- ✅ For production, use `drizzle-kit generate` and apply migrations carefully

## Tips

- 🔄 Run `cleanup-db.sh --seed` frequently during development
- 🧪 Clean database before E2E tests for consistent state
- 📝 Check seed script output to see generated role IDs
- 🚀 Use `wrangler d1 execute auth-db --local --command "SELECT ..."` for quick queries

## File Structure

```
scripts/database/
├── README.md              ← You are here
├── cleanup-db.sh          ← Main cleanup script (use this!)
├── cleanup-db.sh.old      ← Old version (backup)
├── seed-permissions.ts    ← Permission role seed data
└── delete-user.sh         ← User deletion utility
```
