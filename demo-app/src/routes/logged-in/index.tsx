/**
 * Simple Logged In Confirmation Page
 *
 * A minimal page to confirm the user is logged in.
 * Displays cookies and basic authentication status.
 */

import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";

// Loader to check authentication and get cookies
export const useAuthCheck = routeLoader$(async ({ cookie, redirect }) => {
  const refreshToken = cookie.get("refreshToken");
  const accessToken = cookie.get("accessToken");

  if (!refreshToken) {
    // Not logged in, redirect to login
    throw redirect(302, "/");
  }

  return {
    hasRefreshToken: !!refreshToken?.value,
    hasAccessToken: !!accessToken?.value,
    refreshTokenLength: refreshToken?.value?.length || 0,
    accessTokenLength: accessToken?.value?.length || 0,
  };
});

export default component$(() => {
  const authData = useAuthCheck();

  return (
    <div class="min-h-screen bg-linear-to-br from-green-50 to-blue-100 flex items-center justify-center px-4">
      <div class="w-full max-w-2xl">
        <div class="bg-white rounded-2xl shadow-xl p-8">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg
                class="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 class="text-4xl font-bold text-gray-800 mb-2">✅ Logged In!</h1>
            <p class="text-gray-600">You are successfully authenticated</p>
          </div>

          <div class="space-y-4 mb-8">
            <div class="bg-gray-50 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-gray-700 mb-2">
                Authentication Status
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Refresh Token:</span>
                  <span class="text-sm font-mono text-green-600">
                    {authData.value.hasRefreshToken ? "✓ Present" : "✗ Missing"}
                    {authData.value.hasRefreshToken &&
                      ` (${authData.value.refreshTokenLength} chars)`}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Access Token:</span>
                  <span class="text-sm font-mono text-green-600">
                    {authData.value.hasAccessToken ? "✓ Present" : "✗ Missing"}
                    {authData.value.hasAccessToken &&
                      ` (${authData.value.accessTokenLength} chars)`}
                  </span>
                </div>
              </div>
            </div>

            <div class="bg-blue-50 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-blue-900 mb-2">
                ℹ️ What This Means
              </h3>
              <p class="text-sm text-blue-800">
                Your login was successful! The server set authentication
                cookies, and you were redirected to this page. This confirms the
                entire authentication flow is working correctly.
              </p>
            </div>
          </div>

          <div class="flex gap-4">
            <a
              href="/dashboard"
              class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Go to Dashboard
            </a>
            <a
              href="/"
              class="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors text-center"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Logged In - Auth Service",
  meta: [
    {
      name: "description",
      content: "You are successfully logged in",
    },
  ],
};
