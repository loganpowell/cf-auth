/**
 * Email Verification Page
 *
 * Handles email verification via token from the verification email.
 */

import {
  component$,
  useSignal,
  useVisibleTask$,
  useContext,
} from "@qwik.dev/core";
import {
  routeLoader$,
  routeAction$,
  type DocumentHead,
} from "@qwik.dev/router";
import { serverApi } from "~/lib/server-api";
import { ToastContextId } from "~/contexts/toast-context";
import { DarkModeToggle } from "~/components/ui/dark-mode-toggle";

// Loader to get token from query params
export const useVerificationToken = routeLoader$(({ query }) => {
  return {
    token: query.get("token") || null,
  };
});

// Server action for email verification
export const useVerifyEmailAction = routeAction$(
  async ({ token }, { fail }) => {
    if (!token) {
      return fail(400, { message: "No verification token provided" });
    }

    try {
      const result = await serverApi.verifyEmail(token as string);
      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error("Email verification error:", error);
      return fail(400, {
        message: error instanceof Error ? error.message : "Verification failed",
      });
    }
  }
);

export default component$(() => {
  const tokenData = useVerificationToken();
  const verifyAction = useVerifyEmailAction();
  const status = useSignal<"verifying" | "success" | "error">("verifying");
  const message = useSignal("");
  const shouldRedirect = useSignal(false);
  const toastCtx = useContext(ToastContextId);

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
  useVisibleTask$(async () => {
    const token = tokenData.value.token;

    if (!token) {
      status.value = "error";
      message.value = "No verification token provided";
      toastCtx.showToast("No verification token provided", "error");
      return;
    }

    // Submit the verification action
    const result = await verifyAction.submit({ token });

    if (result.value?.success) {
      status.value = "success";
      message.value = result.value.message || "Email verified successfully!";
      toastCtx.showToast(message.value, "success");

      // Trigger redirect
      shouldRedirect.value = true;
    } else {
      status.value = "error";
      message.value = result.value?.message || "Verification failed";
      toastCtx.showToast(message.value, "error");
    }
  });

  return (
    <div class="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6 transition-colors duration-200">
      <div class="fixed top-6 right-6">
        <DarkModeToggle />
      </div>
      <div class="w-full max-w-md">
        <div class="mb-16 text-center">
          <h1 class="text-6xl font-light tracking-tightest mb-6">
            Email Verification
          </h1>
        </div>

        <div class="card p-8">
          {status.value === "verifying" && (
            <div class="text-center">
              <div class="inline-block animate-spin h-12 w-12 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent mb-6"></div>
              <h2 class="text-2xl font-light tracking-tightest mb-4">
                Verifying your email...
              </h2>
              <p class="text-sm opacity-60">
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {status.value === "success" && (
            <div class="text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 border border-black dark:border-white mb-6">
                <svg
                  class="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="square"
                    stroke-linejoin="miter"
                    stroke-width="1"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 class="text-2xl font-light tracking-tightest mb-4">
                Email Verified!
              </h2>
              <p class="text-sm opacity-60 mb-4">{message.value}</p>
              <p class="text-xs opacity-40">Redirecting you to login...</p>
            </div>
          )}

          {status.value === "error" && (
            <div class="text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 border border-black dark:border-white mb-6">
                <svg
                  class="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="square"
                    stroke-linejoin="miter"
                    stroke-width="1"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 class="text-2xl font-light tracking-tightest mb-4">
                Verification Failed
              </h2>
              <p class="text-sm opacity-60 mb-8">{message.value}</p>
              <div class="space-y-4">
                <button
                  onClick$={() => {
                    window.location.href = "/";
                  }}
                  class="btn w-full"
                >
                  Go to Login
                </button>
                <a href="/dashboard" class="block w-full text-center text-sm">
                  Resend Verification Email →
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
