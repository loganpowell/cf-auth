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
  // useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getApiUrl } from "~/lib/config";

// Register action - runs on server only
export const useRegister = routeAction$(
  async (data, { cookie, fail }) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/v1/auth/register`, {
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
    } catch {
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
  // const nav = useNavigate();
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
    <div class="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">
        {/* Header */}
        <div class="mb-16">
          <h1 class="text-6xl font-light tracking-tightest mb-6">
            Create Account
          </h1>
          <p class="text-sm opacity-60">Sign up to get started</p>
        </div>

        {/* Error display */}
        {register.value?.failed && (
          <div class="mb-8 pb-6 border-b border-black">
            <p class="text-sm">{register.value.message}</p>
          </div>
        )}

        {/* Success message */}
        {register.value?.success && (
          <div class="mb-8 pb-6 border-b border-black">
            <h3 class="text-sm font-medium mb-2">Check your email</h3>
            <p class="text-sm opacity-60">
              We've sent a verification email. Please click the link to verify
              your account.
            </p>
          </div>
        )}

        <Form
          action={register}
          class="space-y-8"
          onSubmitCompleted$={async () => {
            if (register.value?.success && register.value.accessToken) {
              if (typeof window !== "undefined") {
                localStorage.setItem("accessToken", register.value.accessToken);
              }
            }
          }}
        >
          <div>
            <label
              for="displayName"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              Display Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              class="input"
              placeholder="John Doe"
            />
            {register.value?.fieldErrors?.displayName && (
              <p class="mt-2 text-sm opacity-60">
                {register.value.fieldErrors.displayName}
              </p>
            )}
          </div>

          <div>
            <label
              for="email"
              class="block text-xs uppercase tracking-wider mb-3 opacity-60"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              class="input"
              placeholder="your@email.com"
            />
            {register.value?.fieldErrors?.email && (
              <p class="mt-2 text-sm opacity-60">
                {register.value.fieldErrors.email}
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
              id="password"
              name="password"
              type="password"
              required
              class="input"
              placeholder="••••••••"
              onInput$={(e) => {
                password.value = (e.target as HTMLInputElement).value;
              }}
            />
            {register.value?.fieldErrors?.password && (
              <p class="mt-2 text-sm opacity-60">
                {register.value.fieldErrors.password}
              </p>
            )}

            {/* Password strength indicator */}
            {password.value && (
              <div class="mt-3">
                <div class="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      class={`h-0.5 flex-1 transition-colors ${
                        level <= passwordStrength.value
                          ? "bg-black"
                          : "bg-black opacity-10"
                      }`}
                    />
                  ))}
                </div>
                {strengthLabel.value.text && (
                  <p class="text-xs opacity-60">
                    Strength: {strengthLabel.value.text}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            class="btn w-full"
            disabled={register.isRunning}
          >
            {register.isRunning ? "Creating account..." : "Create account"}
          </button>
        </Form>

        <div class="mt-12 pt-12 border-t border-black flex items-center justify-center text-sm">
          <span class="opacity-60 mr-2">Already have an account?</span>
          <a href="/">Sign in</a>
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
