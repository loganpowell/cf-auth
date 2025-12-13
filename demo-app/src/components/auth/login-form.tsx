/**
 * Login Form Component
 *
 * Handles user login with email and password.
 */

import { component$, useSignal, $ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { login$, ApiError } from "~/lib/api";

export const LoginForm = component$(() => {
  const nav = useNavigate();

  // Form state
  const email = useSignal("");
  const password = useSignal("");
  const error = useSignal<string | null>(null);
  const isSubmitting = useSignal(false);

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

      try {
        // Basic validation
        if (!emailVal || !passwordVal) {
          error.value = "Email and password are required";
          isSubmitting.value = false;
          return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailVal)) {
          error.value = "Please enter a valid email address";
          isSubmitting.value = false;
          return;
        }

        // Call login API - inline object to avoid serialization issues
        const response = await login$({
          email: emailVal,
          password: passwordVal,
        });

        // Store token in localStorage and update auth state
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", response.accessToken);
          // Trigger a page navigation which will reload auth context
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
      class="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-8"
    >
      <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Sign In</h2>

      {/* Error Message */}
      {error.value && (
        <div
          class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
          role="alert"
        >
          {error.value}
        </div>
      )}

      {/* Email Field */}
      <div class="mb-4">
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
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
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="you@example.com"
        />
      </div>

      {/* Password Field */}
      <div class="mb-6">
        <label
          for="password"
          class="block text-sm font-medium text-gray-700 mb-2"
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
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="••••••••"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting.value}
        class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {isSubmitting.value ? "Signing in..." : "Sign In"}
      </button>

      {/* Footer Links */}
      <div class="mt-6 text-center text-sm text-gray-600">
        <p>
          Don't have an account?{" "}
          <a
            href="/register"
            class="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create one
          </a>
        </p>
      </div>
    </form>
  );
});
