/**
 * Home Page - Login
 *
 * The main entry point for the application.
 * Displays the login form for authentication using Qwik routeAction$.
 */

import { component$ } from "@builder.io/qwik";
import {
  routeAction$,
  Form,
  z,
  zod$,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";

// Login action - runs on server only
export const useLogin = routeAction$(
  async (data, { cookie, fail }) => {
    try {
      const response = await fetch("http://localhost:8787/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Set the refresh token cookie
      if (result.refreshToken) {
        cookie.set("refreshToken", result.refreshToken, {
          httpOnly: true,
          secure: false, // Set to true in production with HTTPS
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60, // 7 days
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
  const nav = useNavigate();

  return (
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-800 mb-2">🔐 Auth Service</h1>
          <p class="text-gray-600">
            Secure authentication on Cloudflare Workers
          </p>
        </div>

        <div class="bg-white rounded-2xl shadow-xl p-8">
          <h2 class="text-2xl font-bold mb-6 text-gray-800">Sign In</h2>

          {/* Error display */}
          {login.value?.failed && (
            <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p class="text-sm text-red-800">{login.value.message}</p>
            </div>
          )}

          <Form
            action={login}
            class="space-y-4"
            onSubmitCompleted$={async () => {
              if (login.value?.success && login.value.accessToken) {
                // Store token and navigate to dashboard
                if (typeof window !== "undefined") {
                  localStorage.setItem("accessToken", login.value.accessToken);
                  await nav("/dashboard");
                }
              }
            }}
          >
            <div>
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                value={login.formData?.get("email") || ""}
              />
              {login.value?.fieldErrors?.email && (
                <p class="mt-1 text-xs text-red-600">
                  {login.value.fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                for="password"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {login.value?.fieldErrors?.password && (
                <p class="mt-1 text-xs text-red-600">
                  {login.value.fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              disabled={login.isRunning}
            >
              {login.isRunning ? "Signing in..." : "Sign In"}
            </button>
          </Form>

          <p class="mt-4 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <a
              href="/register"
              class="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sign In - Auth Service",
  meta: [
    {
      name: "description",
      content: "Sign in to your account",
    },
  ],
};
