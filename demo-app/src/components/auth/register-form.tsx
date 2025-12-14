/**
 * Register Form Component
 *
 * Handles user registration with email, password, and display name.
 */

import { component$, useSignal, $, useComputed$ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { register$, ApiError } from "~/lib/api";

export const RegisterForm = component$(() => {
  const nav = useNavigate();

  // Form state
  const email = useSignal("");
  const password = useSignal("");
  const displayName = useSignal("");
  const error = useSignal<string | null>(null);
  const isSubmitting = useSignal(false);

  // Password strength indicator
  const passwordStrength = useComputed$(() => {
    const pwd = password.value;
    if (!pwd) return { strength: 0, label: "", color: "" };

    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const colors = [
      "",
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-green-600",
    ];

    return { strength, label: labels[strength], color: colors[strength] };
  });

  // Handle form submission
  const handleSubmit = $(
    async (event: Event, currentTarget: HTMLFormElement) => {
      event.preventDefault();
      error.value = null;
      isSubmitting.value = true;

      // Get values from FormData (avoiding signal serialization issues)
      const formData = new FormData(currentTarget);
      const emailVal = formData.get("email") as string;
      const passwordVal = formData.get("password") as string;
      const displayNameVal = formData.get("displayName") as string;

      try {
        // Validation
        if (!emailVal || !passwordVal || !displayNameVal) {
          error.value = "All fields are required";
          isSubmitting.value = false;
          return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailVal)) {
          error.value = "Please enter a valid email address";
          isSubmitting.value = false;
          return;
        }

        // Display name validation
        if (displayNameVal.length < 1 || displayNameVal.length > 100) {
          error.value = "Display name must be between 1 and 100 characters";
          isSubmitting.value = false;
          return;
        }

        // Password validation (matches backend schema)
        if (passwordVal.length < 8) {
          error.value = "Password must be at least 8 characters";
          isSubmitting.value = false;
          return;
        }
        if (!/[a-z]/.test(passwordVal)) {
          error.value = "Password must contain at least one lowercase letter";
          isSubmitting.value = false;
          return;
        }
        if (!/[A-Z]/.test(passwordVal)) {
          error.value = "Password must contain at least one uppercase letter";
          isSubmitting.value = false;
          return;
        }
        if (!/[0-9]/.test(passwordVal)) {
          error.value = "Password must contain at least one number";
          isSubmitting.value = false;
          return;
        }
        if (!/[^a-zA-Z0-9]/.test(passwordVal)) {
          error.value = "Password must contain at least one special character";
          isSubmitting.value = false;
          return;
        }

        // Call register API with inline object literal to avoid QRL serialization
        const response = await register$({
          email: emailVal,
          password: passwordVal,
          displayName: displayNameVal,
        });

        // Store token and navigate to dashboard
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", response.accessToken);
          await nav("/dashboard");
        }
      } catch (err) {
        if (err instanceof ApiError) {
          error.value = err.message;
        } else {
          error.value = "An unexpected error occurred. Please try again.";
        }
        isSubmitting.value = false;
      }
    }
  );

  return (
    <form
      onSubmit$={handleSubmit}
      class="w-full max-w-md mx-auto bg-white dark:bg-black border border-black dark:border-white rounded-lg shadow-md p-8"
    >
      <h2 class="text-2xl font-bold mb-6 text-center text-black dark:text-white">
        Create Account
      </h2>

      {/* Error Message */}
      {error.value && (
        <div
          class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
          role="alert"
        >
          {error.value}
        </div>
      )}

      {/* Display Name Field */}
      <div class="mb-4">
        <label
          for="displayName"
          class="block text-sm font-medium text-black dark:text-white mb-2"
        >
          Display Name
        </label>
        <input
          type="text"
          id="displayName"
          name="displayName"
          value={displayName.value}
          onInput$={(e) =>
            (displayName.value = (e.target as HTMLInputElement).value)
          }
          required
          disabled={isSubmitting.value}
          maxLength={100}
          class="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="John Doe"
        />
      </div>

      {/* Email Field */}
      <div class="mb-4">
        <label
          for="email"
          class="block text-sm font-medium text-black dark:text-white mb-2"
        >
          Email Address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={email.value}
          onInput$={(e) => (email.value = (e.target as HTMLInputElement).value)}
          required
          disabled={isSubmitting.value}
          class="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="you@example.com"
        />
      </div>

      {/* Password Field */}
      <div class="mb-4">
        <label
          for="password"
          class="block text-sm font-medium text-black dark:text-white mb-2"
        >
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          value={password.value}
          onInput$={(e) =>
            (password.value = (e.target as HTMLInputElement).value)
          }
          required
          disabled={isSubmitting.value}
          class="w-full px-3 py-2 border border-black dark:border-white bg-white dark:bg-black text-black dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="••••••••"
        />
        {/* Password Strength Indicator */}
        {password.value && (
          <div class="mt-2">
            <div class="flex gap-1 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  class={`h-1 flex-1 rounded ${
                    i < passwordStrength.value.strength
                      ? passwordStrength.value.color
                      : "bg-white dark:bg-black border border-black dark:border-white"
                  }`}
                />
              ))}
            </div>
            <p class="text-xs text-black dark:text-white opacity-70">
              Password strength: {passwordStrength.value.label}
            </p>
          </div>
        )}
        <p class="mt-2 text-xs text-black dark:text-white opacity-50">
          Must be at least 8 characters with uppercase, lowercase, number, and
          special character
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting.value}
        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed font-medium transition-colors mt-6"
      >
        {isSubmitting.value ? "Creating Account..." : "Create Account"}
      </button>

      {/* Footer Links */}
      <div class="mt-6 text-center text-sm text-black dark:text-white opacity-70">
        <p>
          Already have an account?{" "}
          <a href="/" class="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </a>
        </p>
      </div>
    </form>
  );
});
