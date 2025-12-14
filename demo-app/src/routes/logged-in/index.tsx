/**
 * Simple Logged In Confirmation Page
 *
 * A minimal page to confirm the user is logged in.
 * Displays cookies and basic authentication status.
 */

import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { DarkModeToggle } from "../../components/ui/dark-mode-toggle";

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
    <div class="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4 transition-colors duration-200">
      {/* Dark mode toggle - fixed top right */}
      <div class="fixed top-6 right-6">
        <DarkModeToggle />
      </div>

      <div class="w-full max-w-2xl">
        <div class="card p-12">
          {/* Header */}
          <div class="text-center mb-12">
            <h1 class="text-6xl font-light tracking-tightest mb-4">
              Logged In
            </h1>
            <p class="text-lg opacity-60">You are successfully authenticated</p>
          </div>

          {/* Auth Status */}
          <div class="space-y-6 mb-12">
            <div>
              <h3 class="text-sm font-medium uppercase tracking-wider opacity-60 mb-4">
                Authentication Status
              </h3>
              <div class="space-y-3">
                <div class="flex items-center justify-between py-2 border-b border-current">
                  <span class="text-sm">Refresh Token</span>
                  <span class="text-sm font-mono">
                    {authData.value.hasRefreshToken ? "✓" : "✗"}{" "}
                    {authData.value.hasRefreshToken &&
                      `${authData.value.refreshTokenLength} chars`}
                  </span>
                </div>
                <div class="flex items-center justify-between py-2 border-b border-current">
                  <span class="text-sm">Access Token</span>
                  <span class="text-sm font-mono">
                    {authData.value.hasAccessToken ? "✓" : "✗"}{" "}
                    {authData.value.hasAccessToken &&
                      `${authData.value.accessTokenLength} chars`}
                  </span>
                </div>
              </div>
            </div>

            <div class="pt-6">
              <h3 class="text-sm font-medium uppercase tracking-wider opacity-60 mb-3">
                What This Means
              </h3>
              <p class="text-sm leading-relaxed opacity-80">
                Your login was successful. The server set authentication
                cookies, and you were redirected to this page. This confirms the
                entire authentication flow is working correctly.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div class="grid grid-cols-2 gap-4">
            <a href="/dashboard" class="btn text-center">
              Dashboard
            </a>
            <a href="/" class="btn btn-secondary text-center">
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
