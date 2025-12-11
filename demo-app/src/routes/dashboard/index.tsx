/**
 * Dashboard Index Page
 *
 * Main dashboard page showing user information and account status.
 * Uses routeLoader$ to check authentication.
 */

import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";

// Loader runs on server before rendering - checks if user is authenticated
export const useUserData = routeLoader$(async ({ cookie, redirect }) => {
  // Check if refresh token exists (means user is authenticated)
  const refreshToken = cookie.get("refreshToken");

  if (!refreshToken) {
    // No auth, redirect to login
    throw redirect(302, "/");
  }

  return {
    hasAuth: true,
  };
});

export default component$(() => {
  // The loader ensures we're authenticated before rendering
  // The layout.tsx handles displaying user info

  return (
    <div>
      {/* Welcome Section */}
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800">Welcome back!</h1>
        <p class="mt-2 text-gray-600">
          You're successfully authenticated with the Auth Service.
        </p>
      </div>

      {/* Success Message */}
      <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg
              class="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-lg font-medium text-green-900">
              🎉 Phase 2 Demo App Complete!
            </h3>
            <div class="mt-2 text-sm text-green-800">
              <p>
                You've successfully completed the authentication flow. The
                system includes:
              </p>
              <ul class="list-disc list-inside mt-2 space-y-1">
                <li>JWT-based authentication with access and refresh tokens</li>
                <li>Secure password hashing with PBKDF2</li>
                <li>Protected routes with automatic redirects</li>
                <li>Form validation using Zod</li>
                <li>Qwik v2 routeAction$ for server-side form handling</li>
                <li>HttpOnly cookies for refresh token storage</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center mb-4">
            <div class="bg-blue-100 rounded-lg p-3">
              <svg
                class="h-6 w-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 class="ml-3 text-lg font-semibold text-gray-800">
              Secure Auth
            </h3>
          </div>
          <p class="text-sm text-gray-600">
            Industry-standard JWT tokens with refresh token rotation for maximum
            security.
          </p>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center mb-4">
            <div class="bg-green-100 rounded-lg p-3">
              <svg
                class="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 class="ml-3 text-lg font-semibold text-gray-800">
              Edge Performance
            </h3>
          </div>
          <p class="text-sm text-gray-600">
            Running on Cloudflare Workers for ultra-low latency authentication
            worldwide.
          </p>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center mb-4">
            <div class="bg-purple-100 rounded-lg p-3">
              <svg
                class="h-6 w-6 text-purple-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 class="ml-3 text-lg font-semibold text-gray-800">
              Type Safety
            </h3>
          </div>
          <p class="text-sm text-gray-600">
            Full TypeScript coverage with Zod validation for runtime type
            safety.
          </p>
        </div>
      </div>

      {/* Next Steps */}
      <div class="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Next Steps</h2>
        <ul class="space-y-3">
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-blue-600 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm text-gray-700">
              Test the logout functionality by clicking the logout button in the
              header
            </span>
          </li>
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-blue-600 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm text-gray-700">
              Try creating another account to test the registration flow
            </span>
          </li>
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-blue-600 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm text-gray-700">
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
