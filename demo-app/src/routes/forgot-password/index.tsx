/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email.
 */

import { component$, useSignal } from "@builder.io/qwik";
import { routeAction$, Form, type DocumentHead } from "@builder.io/qwik-city";
import { z } from "zod";
import { getApiUrl } from "~/lib/config";

// Server action for password reset request
export const useForgotPasswordAction = routeAction$(async (data, { fail }) => {
  const schema = z.object({
    email: z.string().email("Invalid email format"),
  });

  const result = schema.safeParse(data);
  if (!result.success) {
    return fail(400, {
      fieldErrors: {
        email: result.error.errors[0]?.message,
      },
    });
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: result.data.email }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return fail(response.status, {
        message: responseData.message || "Failed to send reset email",
      });
    }

    return {
      success: true,
      message: responseData.message,
    };
  } catch (error) {
    console.error("Forgot password error:", error);
    return fail(500, {
      message: "Network error. Please try again.",
    });
  }
});

export default component$(() => {
  const action = useForgotPasswordAction();
  const isSubmitting = useSignal(false);

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
            {action.value?.message && (
              <div class="border border-black p-4 mb-8">
                <p class="text-sm">{action.value.message}</p>
              </div>
            )}

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
