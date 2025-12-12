/**
 * Dashboard Index Page
 *
 * Main dashboard page showing user information and account status.
 * Uses routeLoader$ to check authentication and fetch user data.
 */

import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import type { User, ResendVerificationRequest } from "@/types/shared";
import { getApiUrl } from "~/lib/config";

// Loader runs on server before rendering - fetches user data
export const useUserData = routeLoader$(async ({ cookie, redirect }) => {
  // Check if refresh token exists (means user is authenticated)
  const refreshToken = cookie.get("refreshToken");
  const accessToken = cookie.get("accessToken");

  if (!refreshToken) {
    // No auth, redirect to login
    throw redirect(302, "/");
  }

  // Fetch user data from backend
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken?.value}`,
      },
    });

    if (response.ok) {
      const data = (await response.json()) as User;
      return {
        hasAuth: true,
        user: data,
      };
    }
  } catch (error) {
    console.error("Failed to fetch user data:", error);
  }

  // Fallback if fetch fails
  return {
    hasAuth: true,
    user: null,
  };
});

// Resend verification email action
export const useResendVerification = routeAction$(async (data, { fail }) => {
  try {
    const apiUrl = getApiUrl();
    const requestBody: ResendVerificationRequest = {
      email: data.email as string,
    };

    const response = await fetch(`${apiUrl}/v1/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      return fail(response.status, {
        message: error.error || "Failed to resend verification email",
      });
    }

    return {
      success: true,
      message: "Verification email sent! Please check your inbox.",
    };
  } catch (error) {
    console.error("Resend verification error:", error);
    return fail(500, { message: "Network error. Please try again." });
  }
});

export default component$(() => {
  // The loader ensures we're authenticated before rendering
  const userData = useUserData();
  const resendVerification = useResendVerification();

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

      {/* Resend Verification Success Message */}
      {resendVerification.value?.success && (
        <div class="card mb-8 p-6">
          <p class="text-sm">{resendVerification.value.message}</p>
        </div>
      )}

      {/* Resend Verification Error Message */}
      {resendVerification.value?.failed && (
        <div class="border border-black p-6 mb-8">
          <p class="text-sm">{resendVerification.value.message}</p>
        </div>
      )}

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
                <form
                  preventdefault:submit
                  onSubmit$={async () => {
                    if (userData.value.user?.email) {
                      await resendVerification.submit({
                        email: userData.value.user.email,
                      });
                    }
                  }}
                >
                  <button
                    type="submit"
                    class="btn"
                    disabled={resendVerification.isRunning}
                  >
                    {resendVerification.isRunning
                      ? "Sending..."
                      : "Resend Verification Email"}
                  </button>
                </form>
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
