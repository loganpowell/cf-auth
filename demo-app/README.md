# Auth Service Demo App ⚡️

Qwik v2 demonstration application for testing the Cloudflare Workers authentication service.

## Overview

This demo app provides visual testing and validation of the authentication service backend. Each development phase includes corresponding UI implementation for immediate feedback.

### Current Status: Phase 1 Complete ✅

- ✅ Qwik v2 application initialized
- ✅ API client with server$ integration
- ✅ Health check page demonstrating backend connectivity
- ✅ Styled components with responsive design
- ⏳ Authentication flows (Phase 2)
- ⏳ Email integration UI (Phase 3)
- ⏳ Permission management interface (Phase 4)

## Quick Start

### Prerequisites

- Node.js 18+ or 20+
- pnpm 10+
- Backend service running on `http://localhost:8787`

### Development

**Important:** You need BOTH services running:

```bash
# Terminal 1 - Backend (from project root)
cd /Users/logan.powell/Documents/projects/logan/cf-auth
pnpm run dev

# Terminal 2 - Demo app (from demo-app directory)
cd /Users/logan.powell/Documents/projects/logan/cf-auth/demo-app
pnpm run dev
```

The demo app will be available at **http://localhost:5173**

## Architecture Highlights

### Server$ Pattern (No CORS Issues!)

Uses Qwik's `server$` for secure API calls:

```typescript
// Runs on server - no CORS, no exposed secrets
export const checkHealth$ = server$(async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
});
```

### Reactive State with Signals

```typescript
const health = useSignal<HealthCheckResponse | null>(null);

// Auto-updates UI when signal changes
useTask$(async () => {
  health.value = await checkHealth$();
});
```

## Features

### Phase 1: Infrastructure Testing ✅

- **Health Check**: Verifies backend connectivity
- **Error Handling**: Shows connection errors with helpful hints
- **Loading States**: Visual feedback during API calls
- **Status Display**: Shows backend version and timestamp

### Coming Soon

- **Phase 2**: Login/Register forms, JWT token management
- **Phase 3**: Email verification UI, password reset flows
- **Phase 4**: Permission tree visualization, role management
- **Phase 5**: Organization/team management interfaces

## Troubleshooting

### "Failed to connect to backend"

1. ✅ Make sure backend is running: `pnpm run dev` (from project root)
2. ✅ Check backend is on `http://localhost:8787`
3. ✅ Verify `.env` has correct `VITE_API_URL`

## Resources

- [Qwik v2 Docs](https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/)
- [Routing](https://qwikdev-build-v2.qwik-8nx.pages.dev/docs/routing/)
- [Discord](https://qwik.dev/chat)

---

**Next Phase**: Implement login/register forms and JWT token management (Phase 2)
