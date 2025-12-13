/**
 * Home Page - Login
 *
 * The main entry point for the application.
 * Displays the login form for authentication using Qwik routeAction$.
 */

import { component$, useVisibleTask$ } from "@qwik.dev/core";
import {
  routeAction$,
  Form,
  z,
  zod$,
  type DocumentHead,
} from "@qwik.dev/router";
import { serverApi } from "~/lib/server-api";

// Login action - runs on server only
export const useLogin = routeAction$(
  async (data, { cookie, fail }) => {
    try {
      const result = await serverApi.login({
        email: data.email,
        password: data.password,
      });

      console.log("Login successful for:", data.email);

      // Set access token cookie for client-side access
      if (result.accessToken) {
        cookie.set("accessToken", result.accessToken, {
          httpOnly: false, // Allow client-side access
          secure: false,
          sameSite: "lax",
          maxAge: 15 * 60, // 15 minutes
          path: "/",
        });
      }

      // Note: refreshToken is set by the backend via Set-Cookie header with httpOnly flag
      // We don't need to manually set it here

      // Return success - we'll handle redirect on client
      return {
        success: true,
        redirectTo: "/logged-in",
      };
    } catch (error) {
      console.error("Login failed:", error);
      return fail(400, {
        message: error instanceof Error ? error.message : "Login failed",
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

  // Handle client-side redirect after successful login
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const value = track(() => login.value);

    // Type guard to check if value has our success properties
    if (
      value &&
      typeof value === "object" &&
      "success" in value &&
      "redirectTo" in value
    ) {
      const successValue = value as { success: boolean; redirectTo: string };
      if (successValue.success && successValue.redirectTo) {
        console.log("Redirecting to:", successValue.redirectTo);
        window.location.href = successValue.redirectTo;
      }
    }
  });

  return (
    <div class="min-h-screen bg-white flex items-center justify-center px-6">
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
          <div class="mb-8 pb-6 border-b border-black">
            <p class="text-sm">{login.value.message}</p>
          </div>
        )}

        {/* Login Form */}
        <Form action={login} class="space-y-8">
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
        <div class="mt-12 pt-12 border-t border-black flex items-center justify-between text-sm">
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
