# Development Quick Start

## Starting the Apps

### Option 1: Backend + Web App (Recommended)

```bash
./start-dev.sh
```

This starts:

- ✅ Backend at `http://localhost:8787`
- ✅ Demo app at `http://localhost:5173`

Logs are written to:

- `/tmp/cf-auth-backend.log`
- `/tmp/cf-auth-frontend.log`

View logs in real-time:

```bash
# Backend logs
tail -f /tmp/cf-auth-backend.log

# Frontend logs
tail -f /tmp/cf-auth-frontend.log
```

### Option 2: All Apps (Backend + Web + Desktop)

```bash
./start-all.sh
```

This starts everything including the Tauri desktop app.

### Option 3: Manual Start (Separate Terminals)

**Terminal 1 - Backend:**

```bash
pnpm run dev
```

**Terminal 2 - Web App:**

```bash
cd demo-app
pnpm run dev
```

**Terminal 3 - Desktop App:**

```bash
cd ../desktop-app
pnpm tauri dev
```

## Testing the UI

### 1. Register a New User

1. Open `http://localhost:5173`
2. Click "Create Account"
3. Fill in:
   - Email: `test@example.com`
   - Display Name: `Test User`
   - Password: `Test123!@#` (must have uppercase, lowercase, number, special char)
4. Click "Create Account"
5. Check email verification page (email won't actually send in dev)

### 2. Login

1. Go to `http://localhost:5173`
2. Enter email and password
3. Click "Sign In"
4. You should see the dashboard with your user info

### 3. Test Permissions

1. From dashboard, click "Permissions" in nav
2. View your roles and permissions
3. Try creating custom roles (requires admin permissions)

### 4. Test Desktop App

The desktop app should open automatically when you run `start-all.sh` or `pnpm tauri dev`.

Features to test:

- Login/register (same backend as web)
- View dashboard
- Check permissions
- Logout

## Running E2E Tests

### Web App Tests

```bash
cd demo-app

# Run all tests
pnpm test:e2e

# Visual test runner (recommended)
pnpm test:e2e:ui

# Watch tests run in browser
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug
```

### Test Suites Available

- **auth.spec.ts**: Login, register, password reset (14 tests)
- **permissions.spec.ts**: Roles, permissions, audit (14 tests)
- **session.spec.ts**: Session management, multi-tab (10 tests)

## Monitoring in Dev

### Backend Logging

The backend now includes structured logging:

```bash
# Watch backend logs
tail -f /tmp/cf-auth-backend.log
```

You'll see:

- Request logs with duration and status
- Error logs with stack traces
- Sentry integration (when configured)

### Frontend Debugging

Open browser console to see:

- API requests and responses
- Authentication state changes
- Form validation errors

## Common Issues

### Port Already in Use

If ports 8787 or 5173 are already in use:

```bash
# Find and kill process on port 8787
lsof -ti:8787 | xargs kill -9

# Find and kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Backend Won't Start

Check logs:

```bash
cat /tmp/cf-auth-backend.log
```

Common issues:

- Missing D1 database (run `pnpm run db:migrate`)
- Missing KV namespaces (check `wrangler.toml`)
- Invalid environment variables

### Frontend Won't Start

Check logs:

```bash
cat /tmp/cf-auth-frontend.log
```

Common issues:

- Backend not running
- Wrong API URL in `.env`
- Missing dependencies (run `pnpm install`)

### Tests Failing

1. Make sure backend is running on port 8787
2. Make sure frontend is running on port 5173
3. Clear test data: `rm -rf demo-app/playwright/.auth`
4. Run tests again

## Development Workflow

### Making Changes

1. **Backend changes**: Edit files in `src/`, changes auto-reload
2. **Frontend changes**: Edit files in `demo-app/src/`, hot reload
3. **Tests**: Write tests alongside feature development

### Before Committing

```bash
# Run all tests
cd demo-app && pnpm test:e2e

# Check TypeScript
pnpm run build.types

# Format code
pnpm run fmt
```

## Environment Variables

### Backend (.env)

```env
# In cf-auth/.dev.vars
JWT_SECRET=your-secret-key-here
CLOUDFLARE_API_TOKEN=your-token
```

### Frontend (.env)

```env
# In cf-auth/demo-app/.env
VITE_API_URL=http://localhost:8787
```

## Database

### Run Migrations

```bash
pnpm run db:migrate
```

### View Database

```bash
# Open D1 console
wrangler d1 execute auth-db-dev --command "SELECT * FROM users;"

# Or use the admin dashboard
curl http://localhost:8787/admin/health
```

## Stopping Services

Press `Ctrl+C` in the terminal where you ran `start-dev.sh` or `start-all.sh`.

All background processes will be killed automatically.

## Next Steps

- Read [CLIENT_TESTING.md](../../docs/CLIENT_TESTING.md) for testing guide
- Read [TESTING_GUIDE.md](TESTING_GUIDE.md) for backend tests
- Read [MONITORING_SETUP.md](infrastructure/MONITORING_SETUP.md) for monitoring setup

## Quick Tips

- 🔥 Hot reload works for both backend and frontend
- 🎨 UI mode for tests is the best way to debug
- 📝 Structured logs show request duration and status
- 🔐 Test with different users to verify permissions
- 📱 Test mobile viewports in browser dev tools
