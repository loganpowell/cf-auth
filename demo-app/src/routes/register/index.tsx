/**
 * Registration Page
 *
 * Allows new users to create an account using Qwik routeAction$.
 */

import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import {
  routeAction$,
  Form,
  z,
  zod$,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";

// Register action - runs on server only
export const useRegister = routeAction$(
  async (data, { cookie, fail }) => {
    try {
      const response = await fetch("http://localhost:8787/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return fail(response.status, {
          message: error.error || "Registration failed",
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
    } catch (_error) {
      return fail(500, {
        message: "Network error. Please try again.",
      });
    }
  },
  zod$({
    email: z.string().email("Please enter a valid email"),
    displayName: z
      .string()
      .min(1, "Display name is required")
      .max(100, "Display name too long"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^a-zA-Z0-9]/,
        "Password must contain at least one special character"
      ),
  })
);

export default component$(() => {
  const register = useRegister();
  const nav = useNavigate();
  const password = useSignal("");

  // Password strength calculator
  const passwordStrength = useComputed$(() => {
    const pwd = password.value;
    let strength = 0;

    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    return strength;
  });

  const strengthLabel = useComputed$(() => {
    const strength = passwordStrength.value;
    if (strength === 0) return { text: "", color: "" };
    if (strength <= 2) return { text: "Weak", color: "bg-red-500" };
    if (strength === 3) return { text: "Fair", color: "bg-yellow-500" };
    if (strength === 4) return { text: "Good", color: "bg-blue-500" };
    return { text: "Strong", color: "bg-green-500" };
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-800 mb-2">🔐 Auth Service</h1>
          <p class="text-gray-600">Create your account to get started</p>
        </div>

        <div class="bg-white rounded-2xl shadow-xl p-8">
          <h2 class="text-2xl font-bold mb-6 text-gray-800">Create Account</h2>

          {/* Error display */}
          {register.value?.failed && (
            <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p class="text-sm text-red-800">{register.value.message}</p>
            </div>
          )}

          {/* Success message */}
          {register.value?.success && (
            <div class="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div class="flex items-start">
                <svg
                  class="w-5 h-5 text-blue-600 mt-0.5 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  />
                </svg>
                <div>
                  <h3 class="text-sm font-medium text-blue-900">
                    Check your email!
                  </h3>
                  <p class="mt-1 text-sm text-blue-800">
                    We've sent a verification email to your address. Please
                    click the link in the email to verify your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Form
            action={register}
            class="space-y-4"
            onSubmitCompleted$={async () => {
              if (register.value?.success && register.value.accessToken) {
                // Store token but don't redirect yet - show email verification message
                if (typeof window !== "undefined") {
                  localStorage.setItem(
                    "accessToken",
                    register.value.accessToken
                  );
                }
              }
            }}
          >
            <div>
              <label
                for="displayName"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Display Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                autocomplete="name"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
                value={register.formData?.get("displayName") || ""}
              />
              {register.value?.fieldErrors?.displayName && (
                <p class="mt-1 text-xs text-red-600">
                  {register.value.fieldErrors.displayName}
                </p>
              )}
            </div>

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
                value={register.formData?.get("email") || ""}
              />
              {register.value?.fieldErrors?.email && (
                <p class="mt-1 text-xs text-red-600">
                  {register.value.fieldErrors.email}
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
                autocomplete="new-password"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                onInput$={(e) => {
                  password.value = (e.target as HTMLInputElement).value;
                }}
              />
              {register.value?.fieldErrors?.password && (
                <p class="mt-1 text-xs text-red-600">
                  {register.value.fieldErrors.password}
                </p>
              )}

              {/* Password strength indicator */}
              {password.value && (
                <div class="mt-2">
                  <div class="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        class={`h-1 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.value
                            ? strengthLabel.value.color
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  {strengthLabel.value.text && (
                    <p class="text-xs text-gray-600">
                      Password strength: {strengthLabel.value.text}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              disabled={register.isRunning}
            >
              {register.isRunning ? "Creating account..." : "Create Account"}
            </button>
          </Form>

          <p class="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <a href="/" class="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Create Account - Auth Service",
  meta: [
    {
      name: "description",
      content: "Create a new account",
    },
  ],
};
