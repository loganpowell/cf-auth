/**
 * Dashboard Index Page
 *
 * Main dashboard page showing user information and account status.
 * Uses routeLoader$ to check authentication and fetch user data.
 */

import { component$, useContext, useVisibleTask$ } from "@qwik.dev/core";
import {
  routeLoader$,
  routeAction$,
  Form,
  type DocumentHead,
} from "@qwik.dev/router";
import { ToastContextId } from "~/contexts/toast-context";
import { serverApi } from "~/lib/server-api";

// Loader runs on server before rendering - fetches user data with type-safe API
export const useUserData = routeLoader$(async ({ cookie, redirect }) => {
  console.log("🔍 Dashboard loader started");

  // Check if refresh token exists (means user is authenticated)
  const refreshToken = cookie.get("refreshToken");
  let accessToken = cookie.get("accessToken");

  console.log("🔑 Tokens:", {
    hasRefreshToken: !!refreshToken,
    hasAccessToken: !!accessToken,
    accessTokenValue: accessToken?.value ? "exists" : "missing",
  });

  if (!refreshToken) {
    console.log("❌ No refresh token - redirecting to login");
    // No auth, redirect to login
    throw redirect(302, "/");
  }

  // If access token is missing but refresh token exists, try to refresh
  if (!accessToken?.value && refreshToken) {
    console.log("🔄 Access token missing - attempting refresh...");
    try {
      const refreshData = await serverApi.refresh();
      console.log("✅ Token refreshed successfully");

      // Set the new access token in cookie
      cookie.set("accessToken", refreshData.accessToken, {
        httpOnly: false, // Accessible to JavaScript
        secure: false, // true in production
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15, // 15 minutes
      });

      // Update our local variable
      accessToken = cookie.get("accessToken");
      console.log("🔑 New access token set");
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      // Refresh failed, redirect to login
      throw redirect(302, "/");
    }
  }

  // Fetch user data from backend using typed API client
  try {
    console.log("📡 Calling serverApi.getMe...");
    const data = await serverApi.getMe(accessToken?.value || "");
    console.log("✅ Data received:", {
      hasUser: !!data.user,
      userEmail: data.user?.email,
      userVerified: data.user?.emailVerified,
    });

    // Type-safe: data has type { user: User }
    // No more user.user confusion - TypeScript knows the shape!
    return {
      hasAuth: true,
      user: data.user, // TypeScript autocomplete works here!
    };
  } catch (error) {
    console.error("❌ Dashboard loader error:", error);
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      raw: error,
    });

    // Fallback if fetch fails
    return {
      hasAuth: true,
      user: null,
    };
  }
});

// Resend verification email action with type-safe API
export const useResendVerification = routeAction$(async (data, { fail }) => {
  console.log("🔍 Resend verification action started");

  try {
    const email = data.email as string;
    console.log("📧 Email:", email);

    // Type-safe API call - TypeScript knows the request/response shape
    console.log("📡 Calling serverApi.resendVerification...");
    const response = await serverApi.resendVerification(email);
    console.log("✅ Response received:", response);

    return {
      success: true,
      message: response.message, // TypeScript knows this exists!
    };
  } catch (error) {
    console.error("❌ Resend verification error:", error);
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      raw: error,
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Network error. Please try again.";
    return fail(500, { message: errorMessage });
  }
});

export default component$(() => {
  // The loader ensures we're authenticated before rendering
  const userData = useUserData();
  const resendVerification = useResendVerification();
  const toastCtx = useContext(ToastContextId);

  // Show toast notification when verification email is sent
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const value = track(() => resendVerification.value);

    console.log("🔍 Resend verification value changed:", value);

    if (value?.success) {
      console.log("✅ Success - showing toast:", value.message);
      toastCtx.showToast(value.message, "success");
    } else if (value?.failed) {
      console.log("❌ Failed - showing error toast:", value.message);
      toastCtx.showToast(value.message, "error");
    }
  });

  return (
    <div class="max-w-4xl">
      {/* Welcome Section */}
      <div class="mb-16">
        <h1 class="text-5xl font-light tracking-tightest mb-4">
          Welcome back
          {userData.value.user ? `, ${userData.value.user.displayName}` : ""}
        </h1>
        <p class="text-sm opacity-60">You're successfully authenticated</p>
      </div>

      {/* Email Verification Status */}
      {userData.value.user && (
        <div class="border border-black p-6 mb-12">
          <div class="mb-4">
            <span
              class={
                userData.value.user.emailVerified
                  ? "badge badge-success"
                  : "badge badge-warning"
              }
            >
              {userData.value.user.emailVerified ? "VERIFIED" : "NOT VERIFIED"}
            </span>
          </div>
          <div class="text-sm">
            {userData.value.user.emailVerified ? (
              <p>
                Your email <strong>{userData.value.user.email}</strong> is
                verified.
              </p>
            ) : (
              <div>
                <p class="mb-4">
                  Please verify <strong>{userData.value.user.email}</strong> to
                  access all features.
                </p>
                <Form action={resendVerification}>
                  <input
                    type="hidden"
                    name="email"
                    value={userData.value.user.email}
                  />
                  <button
                    type="submit"
                    class="btn"
                    disabled={resendVerification.isRunning}
                  >
                    {resendVerification.isRunning
                      ? "Sending..."
                      : "Resend Verification Email"}
                  </button>
                </Form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authentication Complete */}
      <div class="card p-8 mb-12">
        <h2 class="text-2xl font-light tracking-tightest mb-4">
          Authentication Complete
        </h2>
        <p class="text-sm opacity-60 mb-6">
          The system includes the following features:
        </p>
        <ul class="space-y-2 text-sm">
          <li class="flex items-start">
            <span class="opacity-60 mr-2">—</span>
            <span>JWT-based authentication with access and refresh tokens</span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-2">—</span>
            <span>Secure password hashing with PBKDF2</span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-2">—</span>
            <span>Protected routes with automatic redirects</span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-2">—</span>
            <span>Form validation using Zod</span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-2">—</span>
            <span>Qwik v2 routeAction$ for server-side form handling</span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-2">—</span>
            <span>HttpOnly cookies for refresh token storage</span>
          </li>
        </ul>
      </div>

      {/* Feature Cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div class="card p-6">
          <h3 class="text-lg font-light tracking-tight mb-2">Secure Auth</h3>
          <p class="text-sm opacity-60">
            Industry-standard JWT tokens with refresh token rotation for maximum
            security.
          </p>
        </div>

        <div class="card p-6">
          <h3 class="text-lg font-light tracking-tight mb-2">
            Edge Performance
          </h3>
          <p class="text-sm opacity-60">
            Running on Cloudflare Workers for ultra-low latency authentication
            worldwide.
          </p>
        </div>

        <div class="card p-6">
          <h3 class="text-lg font-light tracking-tight mb-2">Type Safety</h3>
          <p class="text-sm opacity-60">
            Full TypeScript coverage with Zod validation for runtime type
            safety.
          </p>
        </div>
      </div>

      {/* Next Steps */}
      <div class="card p-8">
        <h2 class="text-2xl font-light tracking-tightest mb-6">Next Steps</h2>
        <ul class="space-y-4 text-sm">
          <li class="flex items-start">
            <span class="opacity-60 mr-3">—</span>
            <span>
              Test the logout functionality by clicking the logout button in the
              header
            </span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-3">—</span>
            <span>
              Try creating another account to test the registration flow
            </span>
          </li>
          <li class="flex items-start">
            <span class="opacity-60 mr-3">—</span>
            <span>
              Check the browser's DevTools to see the httpOnly refresh token
              cookie
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Dashboard - Auth Service",
  meta: [
    {
      name: "description",
      content: "Your secure dashboard",
    },
  ],
};
