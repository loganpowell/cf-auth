/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token.
 */

import { component$, useSignal } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  Form,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { z } from "zod";
import { getApiUrl } from "~/lib/config";

// Loader to get token from query params
export const useResetToken = routeLoader$(({ query }) => {
  return {
    token: query.get("token") || null,
  };
});

// Server action for password reset
export const useResetPasswordAction = routeAction$(async (data, { fail }) => {
  const schema = z
    .object({
      token: z.string().min(1, "Reset token is required"),
      newPassword: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(
          /[^A-Za-z0-9]/,
          "Password must contain at least one special character"
        ),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });

  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.reduce(
      (acc, err) => {
        const field = err.path[0] as string;
        acc[field] = err.message;
        return acc;
      },
      {} as Record<string, string>
    );

    return fail(400, {
      fieldErrors: errors,
    });
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: result.data.token,
        newPassword: result.data.newPassword,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return fail(response.status, {
        message: responseData.message || "Failed to reset password",
      });
    }

    return {
      success: true,
      message: responseData.message,
    };
  } catch (error) {
    console.error("Reset password error:", error);
    return fail(500, {
      message: "Network error. Please try again.",
    });
  }
});

export default component$(() => {
  const tokenData = useResetToken();
  const action = useResetPasswordAction();
  const isSubmitting = useSignal(false);
  const showPassword = useSignal(false);
  const showConfirmPassword = useSignal(false);

  // If no token in URL, show error
  if (!tokenData.value.token) {
    return (
      <div class="min-h-screen bg-white flex items-center justify-center px-6">
        <div class="w-full max-w-md">
          <div class="card p-8 text-center">
            <h2 class="text-2xl font-light tracking-tightest mb-4">
              Invalid Reset Link
            </h2>
            <p class="text-sm opacity-60 mb-8">
              This password reset link is missing a token. Please check your
              email and click the full link.
            </p>
            <a href="/forgot-password" class="btn inline-block">
              Request New Link
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-white flex items-center justify-center px-6">
      <div class="w-full max-w-md">
        <div class="mb-16">
          <h1 class="text-6xl font-light tracking-tightest mb-6">
            Reset Password
          </h1>
          <p class="text-sm opacity-60">Enter your new password below.</p>
        </div>

        {action.value?.success ? (
          <div>
            <div class="card p-8 mb-8">
              <h2 class="text-2xl font-light tracking-tightest mb-4">
                Password Reset Successful
              </h2>
              <p class="text-sm opacity-60">{action.value.message}</p>
            </div>
            <div class="text-center">
              <a href="/" class="btn inline-block">
                Go to Login
              </a>
            </div>
          </div>
        ) : (
          <Form action={action} class="space-y-8">
            <input type="hidden" name="token" value={tokenData.value.token} />

            {action.value?.message && (
              <div class="border border-black p-4 mb-8">
                <p class="text-sm">{action.value.message}</p>
              </div>
            )}

            <div>
              <label
                for="newPassword"
                class="block text-xs uppercase tracking-wider mb-3 opacity-60"
              >
                New Password
              </label>
              <div class="relative">
                <input
                  type={showPassword.value ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  required
                  class="input pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick$={() => {
                    showPassword.value = !showPassword.value;
                  }}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-sm opacity-60 hover:opacity-100"
                >
                  {showPassword.value ? "hide" : "show"}
                </button>
              </div>
              {action.value?.fieldErrors?.newPassword && (
                <p class="mt-2 text-sm opacity-60">
                  {action.value.fieldErrors.newPassword}
                </p>
              )}
              <p class="mt-2 text-xs opacity-40">
                Must be at least 8 characters with uppercase, lowercase, number,
                and special character
              </p>
            </div>

            <div>
              <label
                for="confirmPassword"
                class="block text-xs uppercase tracking-wider mb-3 opacity-60"
              >
                Confirm Password
              </label>
              <div class="relative">
                <input
                  type={showConfirmPassword.value ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  class="input pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick$={() => {
                    showConfirmPassword.value = !showConfirmPassword.value;
                  }}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-sm opacity-60 hover:opacity-100"
                >
                  {showConfirmPassword.value ? "hide" : "show"}
                </button>
              </div>
              {action.value?.fieldErrors?.confirmPassword && (
                <p class="mt-2 text-sm opacity-60">
                  {action.value.fieldErrors.confirmPassword}
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
              {isSubmitting.value ? "Resetting..." : "Reset Password"}
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
  title: "Reset Password - Auth Service",
  meta: [
    {
      name: "description",
      content: "Create a new password for your account",
    },
  ],
};
