/**
 * Home Page - Login
 *
 * The main entry point for the application.
 * Displays the login form for authentication using Qwik routeAction$.
 */

import { component$ } from "@qwik.dev/core";
import {
  routeAction$,
  Form,
  z,
  zod$,
  type DocumentHead,
} from "@qwik.dev/router";
import { DarkModeToggle } from "~/components/ui/dark-mode-toggle";
import { getApiUrl, getTenantId } from "~/lib/config";

// Login action - runs on server only
export const useLogin = routeAction$(
  async (data, { cookie, fail }) => {
    try {
      const response = await fetch(`${getApiUrl()}/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": getTenantId(),
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return fail(response.status, {
          message: error.error || "Login failed",
        });
      }

      const result = await response.json();

      // Set access token cookie
      if (result.accessToken) {
        cookie.set("accessToken", result.accessToken, {
          httpOnly: false, // Allow client-side access
          secure: false,
          sameSite: "lax",
          maxAge: 15 * 60, // 15 minutes
          path: "/",
        });
      }

      return {
        success: true,
        accessToken: result.accessToken,
        user: result.user,
      };
    } catch (error) {
      return fail(500, {
        message: "Network error. Please try again.",
      });
    }
  },
  zod$({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(1, "Password is required"),
  })
);

export default component$(() => {
  const login = useLogin();

  return (
    <div class="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6 transition-colors duration-200">
      {/* Dark mode toggle - fixed top right */}
      <div class="fixed top-6 right-6">
        <DarkModeToggle />
      </div>

      <div class="w-full max-w-md">
        {/* Header */}
        <div class="mb-16">
          <h1 class="text-6xl font-light tracking-tightest mb-6">Sign In</h1>
          <p class="text-sm opacity-60">
            Enter your credentials to access your account
          </p>
        </div>

        {/* Error Message */}
        {login.value?.failed && (
          <div class="mb-8 pb-6 border-b border-black dark:border-white">
            <p class="text-sm">{login.value.message}</p>
          </div>
        )}

        {/* Success Message */}
        {login.value?.success && (
          <div class="mb-8 pb-6 border-b border-black dark:border-white">
            <p class="text-sm">Login successful! Redirecting...</p>
          </div>
        )}

        {/* Login Form */}
        <Form
          action={login}
          class="space-y-8"
          onSubmitCompleted$={() => {
            console.log("onSubmitCompleted called");
            console.log("login.value:", login.value);

            if (login.value?.success && login.value.accessToken) {
              console.log(
                "Success condition met, storing token and redirecting"
              );
              // Store token and navigate
              if (typeof window !== "undefined") {
                localStorage.setItem("accessToken", login.value.accessToken);
                console.log("Token stored, navigating to /logged-in");
                window.location.href = "/logged-in";
              }
            } else {
              console.log("Success condition NOT met");
              console.log("success:", login.value?.success);
              console.log("accessToken:", login.value?.accessToken);
            }
          }}
        >
          <div>
            <label
              for="email"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              class="input"
              placeholder="your@email.com"
            />
            {login.value?.fieldErrors?.email && (
              <p class="mt-2 text-sm opacity-60">
                {login.value.fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              for="password"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              class="input"
              placeholder="••••••••"
            />
            {login.value?.fieldErrors?.password && (
              <p class="mt-2 text-sm opacity-60">
                {login.value.fieldErrors.password}
              </p>
            )}
          </div>

          <button type="submit" class="btn w-full" disabled={login.isRunning}>
            {login.isRunning ? "Signing in..." : "Sign in"}
          </button>
        </Form>

        {/* Footer Links */}
        <div class="mt-12 pt-12 border-t border-black dark:border-white flex items-center justify-between text-sm">
          <a href="/forgot-password">Forgot password?</a>
          <a href="/register">Create account</a>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sign In",
  meta: [
    {
      name: "description",
      content: "Sign in to your account",
    },
  ],
};
