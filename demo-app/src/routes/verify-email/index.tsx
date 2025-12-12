/**
 * Email Verification Page
 *
 * Handles email verification via token from the verification email.
 */

import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { getApiUrl } from "~/lib/config";

// Loader to get token from query params
export const useVerificationToken = routeLoader$(({ query }) => {
  return {
    token: query.get("token") || null,
  };
});

export default component$(() => {
  const tokenData = useVerificationToken();
  const status = useSignal<"verifying" | "success" | "error">("verifying");
  const message = useSignal("");
  const shouldRedirect = useSignal(false);

  // Handle redirect when flag is set
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => shouldRedirect.value);

    if (shouldRedirect.value) {
      const timer = setTimeout(() => {
        window.location.href = "/";
      }, 3000);

      return () => clearTimeout(timer);
    }
  });

  // Verify email on mount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => tokenData.value);

    const token = tokenData.value.token;

    if (!token) {
      status.value = "error";
      message.value = "No verification token provided";
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/v1/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        status.value = "success";
        message.value = data.message || "Email verified successfully!";

        // Trigger redirect
        shouldRedirect.value = true;
      } else {
        status.value = "error";
        message.value = data.error || "Verification failed";
      }
    } catch {
      status.value = "error";
      message.value = "Network error. Please try again.";
    }
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-800 mb-2">
            🔐 Email Verification
          </h1>
        </div>

        <div class="bg-white rounded-2xl shadow-xl p-8">
          {status.value === "verifying" && (
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h2 class="text-xl font-semibold text-gray-800 mb-2">
                Verifying your email...
              </h2>
              <p class="text-gray-600">
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {status.value === "success" && (
            <div class="text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <svg
                  class="w-8 h-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 class="text-xl font-semibold text-gray-800 mb-2">
                Email Verified!
              </h2>
              <p class="text-gray-600 mb-4">{message.value}</p>
              <p class="text-sm text-gray-500">Redirecting you to login...</p>
            </div>
          )}

          {status.value === "error" && (
            <div class="text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <svg
                  class="w-8 h-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 class="text-xl font-semibold text-gray-800 mb-2">
                Verification Failed
              </h2>
              <p class="text-gray-600 mb-6">{message.value}</p>
              <div class="space-y-3">
                <button
                  onClick$={() => {
                    window.location.href = "/";
                  }}
                  class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  Go to Login
                </button>
                <a
                  href="/resend-verification"
                  class="block w-full text-center text-blue-600 hover:text-blue-700 font-medium py-2"
                >
                  Resend Verification Email
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Verify Email - Auth Service",
  meta: [
    {
      name: "description",
      content: "Verify your email address",
    },
  ],
};
