/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email.
 */

import {
  component$,
  useSignal,
  useContext,
  useVisibleTask$,
} from "@qwik.dev/core";
import {
  routeAction$,
  Form,
  z,
  zod$,
  type DocumentHead,
} from "@qwik.dev/router";
import { serverApi } from "~/lib/server-api";
import { ToastContextId } from "~/contexts/toast-context";

// Server action for password reset request
export const useForgotPasswordAction = routeAction$(
  async (data, { fail }) => {
    try {
      const response = await serverApi.forgotPassword(data.email);

      return {
        success: true,
        message: response.message,
      };
    } catch (error) {
      console.error("Forgot password error:", error);
      return fail(400, {
        message:
          error instanceof Error ? error.message : "Failed to send reset email",
      });
    }
  },
  zod$({
    email: z.string().email("Invalid email format"),
  })
);

export default component$(() => {
  const action = useForgotPasswordAction();
  const isSubmitting = useSignal(false);
  const toastCtx = useContext(ToastContextId);

  // Show toast notification when reset email is sent
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const value = track(() => action.value);

    if (value?.success) {
      toastCtx.showToast(value.message, "success");
    } else if (value?.failed && value?.message) {
      toastCtx.showToast(value.message, "error");
    }
  });

  return (
    <div class="min-h-screen bg-white flex items-center justify-center px-6">
      <div class="w-full max-w-md">
        <div class="mb-16">
          <h1 class="text-6xl font-light tracking-tightest mb-6">
            Reset Password
          </h1>
          <p class="text-sm opacity-60">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        {action.value?.success ? (
          <div>
            <div class="card p-8 mb-8">
              <h2 class="text-2xl font-light tracking-tightest mb-4">
                Check Your Email
              </h2>
              <p class="text-sm opacity-60">{action.value.message}</p>
            </div>
            <div class="text-center">
              <a href="/" class="text-sm">
                ← Back to Login
              </a>
            </div>
          </div>
        ) : (
          <Form action={action} class="space-y-8">
            <div>
              <label
                for="email"
                class="block text-xs uppercase tracking-wider mb-3 opacity-60"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                class="input"
                placeholder="your@email.com"
              />
              {action.value?.fieldErrors?.email && (
                <p class="mt-2 text-sm opacity-60">
                  {action.value.fieldErrors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting.value}
              class="btn w-full"
              onClick$={() => {
                isSubmitting.value = true;
              }}
            >
              {isSubmitting.value ? "Sending..." : "Send Reset Link"}
            </button>

            <div class="pt-8 border-t border-black text-center">
              <a href="/" class="text-sm">
                ← Back to Login
              </a>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Forgot Password - Auth Service",
  meta: [
    {
      name: "description",
      content: "Reset your password",
    },
  ],
};
