# Using the Type-Safe API SDK

This document shows how to use the auto-generated TypeScript SDK for type-safe API calls.

## Benefits

✅ **Full TypeScript autocomplete** - IntelliSense for all API endpoints, request bodies, and responses  
✅ **Compile-time type checking** - Catch errors before runtime  
✅ **No more `user.user` confusion** - TypeScript knows the exact shape of responses  
✅ **Automatic sync with backend** - Regenerate SDK when OpenAPI spec changes

## Setup

The SDK is automatically generated from the OpenAPI spec:

```bash
# Regenerate SDK types (run this after backend API changes)
pnpm run generate:sdk
```

This creates `demo-app/src/lib/api-client.d.ts` with all the types.

## Usage Examples

### Server-Side (Route Loaders & Actions)

Use `serverApi` from `~/lib/server-api`:

```typescript
import { serverApi } from "~/lib/server-api";

// ✅ Type-safe route loader
export const useUserData = routeLoader$(async ({ cookie }) => {
  const accessToken = cookie.get("accessToken")?.value || "";

  // TypeScript knows the response type!
  const data = await serverApi.getMe(accessToken);

  // ✅ No user.user confusion - autocomplete shows: data.user
  return {
    user: data.user, // TypeScript: User type with all fields
  };
});

// ✅ Type-safe route action
export const useResendVerification = routeAction$(async (formData) => {
  const email = formData.email as string;

  // TypeScript validates request body shape
  const response = await serverApi.resendVerification(email);

  // TypeScript knows response.message exists
  return { message: response.message };
});
```

### Client-Side (Components)

Use `api` from `~/lib/api-client`:

```typescript
import { api } from "~/lib/api-client";

// ✅ Type-safe login
const handleLogin = $(async (email: string, password: string) => {
  // TypeScript validates the request body
  const response = await api.login({ email, password });

  // ✅ TypeScript knows all response fields
  localStorage.setItem("token", response.accessToken);
  console.log(response.user.displayName); // Autocomplete works!
  console.log(response.user.emailVerified); // TypeScript knows the type
});

// ✅ Type-safe registration
const handleRegister = $(
  async (data: { email: string; password: string; displayName: string }) => {
    // TypeScript ensures all required fields are present
    const response = await api.register(data);

    // TypeScript knows: response.user has { id, email, displayName }
    console.log(response.user.email);
  }
);

// ✅ Type-safe authenticated requests
const handleLogout = $(async () => {
  const response = await api.logout();
  console.log(response.message); // "Logged out successfully"
});
```

## Available API Methods

All methods are fully typed with IntelliSense:

### Public Endpoints (No Auth)

- `api.register(data)` - Register new user
- `api.login(data)` - Login with email/password
- `api.verifyEmail(token)` - Verify email with token
- `api.resendVerification(email)` - Resend verification email
- `api.forgotPassword(email)` - Request password reset
- `api.resetPassword(token, newPassword)` - Reset password
- `api.refresh()` - Refresh access token

### Protected Endpoints (Requires Auth)

- `api.getMe()` - Get current user
- `api.logout()` - Logout and invalidate tokens

## Type Safety Examples

### ❌ Before (Manual Typing)

```typescript
// No autocomplete, easy to make mistakes
const response = await fetch("/v1/auth/me");
const data = (await response.json()) as any;
console.log(data.user.user.name); // 😱 user.user confusion!
```

### ✅ After (Generated SDK)

```typescript
// Full autocomplete and type checking
const data = await serverApi.getMe(token);
console.log(data.user.displayName); // ✅ TypeScript guides you!
// data.user.unknown // ❌ Compile error - property doesn't exist
```

## Error Handling

The SDK includes proper error handling:

```typescript
try {
  const response = await api.login({ email, password });
  // Success!
} catch (error) {
  // error is ApiError with status and message
  console.error(error.message);
  console.error(error.status); // 400, 401, 500, etc.
}
```

## Development Workflow

1. **Update backend API** - Modify Zod schemas in `src/schemas/auth.schema.ts`
2. **Regenerate OpenAPI spec** - `pnpm run generate:openapi`
3. **Regenerate SDK types** - `pnpm run generate:sdk` (or just run both with `pnpm run generate:sdk`)
4. **Use in frontend** - TypeScript will show errors if API changed!

## Real-World Example: Dashboard

```typescript
// Before: Manual fetch with type confusion
export const useUserData = routeLoader$(async ({ cookie }) => {
  const response = await fetch(API + "/v1/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as { user: User };
  return { user: data.user }; // user.user confusion!
});

// After: Type-safe with SDK
export const useUserData = routeLoader$(async ({ cookie }) => {
  const data = await serverApi.getMe(token);
  // TypeScript knows: data.user is User type
  return { user: data.user }; // Clear and type-safe!
});
```

## Pro Tips

1. **Use the generated types** - They're in `api-client.d.ts`
2. **Let TypeScript guide you** - Autocomplete shows all available fields
3. **Regenerate after API changes** - Keep types in sync
4. **Trust the compiler** - If TypeScript is happy, the API will work!

## Troubleshooting

### Types are outdated

Run `pnpm run generate:sdk` to regenerate

### Autocomplete not working

Make sure `api-client.d.ts` exists and VS Code has reloaded

### Compile errors after API change

This is good! It means TypeScript caught breaking changes. Update your code to match the new API.
