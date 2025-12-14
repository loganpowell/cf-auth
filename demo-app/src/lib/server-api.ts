/**
 * Server-side API utilities for Qwik route loaders and actions
 *
 * These utilities use the typed API client on the server side.
 * They handle authentication, error handling, and type safety.
 */

import createClient from "openapi-fetch";
import type { paths } from "./api-client.d";
import { getApiUrl } from "./config";

/**
 * Create a server-side API client with optional auth token
 */
export function createServerApiClient(accessToken?: string) {
  const client = createClient<paths>({
    baseUrl: getApiUrl(),
  });

  if (accessToken) {
    client.use({
      onRequest({ request }) {
        request.headers.set("Authorization", `Bearer ${accessToken}`);
        return request;
      },
    });
  }

  return client;
}

/**
 * Server-side API helper with typed responses
 */
export const serverApi = {
  /**
   * Get current user (requires auth token)
   */
  async getMe(accessToken: string) {
    console.log("🔍 serverApi.getMe called");
    console.log("🔑 Access token:", accessToken ? "exists" : "missing");

    const client = createServerApiClient(accessToken);
    console.log("📡 Making GET request to /v1/auth/me");

    const response = await client.GET("/v1/auth/me");

    console.log("📥 Response received:", {
      hasError: !!response.error,
      hasData: !!response.data,
      status: response.response.status,
      statusText: response.response.statusText,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to fetch user";
      console.error("❌ serverApi.getMe error:", errorMsg);
      console.error("❌ Full error:", response.error);
      throw new Error(errorMsg);
    }

    console.log("✅ serverApi.getMe success");
    // Type-safe response: response.data has type { user: User }
    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    displayName: string;
  }) {
    const client = createServerApiClient();
    const response = await client.POST("/v1/auth/register", {
      body: data,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Registration failed";
      throw new Error(errorMsg);
    }

    return response.data;
  },

  /**
   * Login with email and password
   */
  async login(data: { email: string; password: string }) {
    const client = createServerApiClient();
    const response = await client.POST("/v1/auth/login", {
      body: data,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error || response.error?.message || "Login failed";
      throw new Error(errorMsg);
    }

    return response.data;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    const client = createServerApiClient();
    const response = await client.POST("/v1/auth/verify-email", {
      body: { token },
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Email verification failed";
      throw new Error(errorMsg);
    }

    return response.data;
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string) {
    console.log("🔍 serverApi.resendVerification called");
    console.log("📧 Email:", email);

    const client = createServerApiClient();
    console.log("📡 Making POST request to /v1/auth/resend-verification");

    const response = await client.POST("/v1/auth/resend-verification", {
      body: { email },
    });

    console.log("📥 Response received:", {
      hasError: !!response.error,
      hasData: !!response.data,
      status: response.response.status,
      statusText: response.response.statusText,
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Failed to resend verification email";
      console.error("❌ serverApi.resendVerification error:", errorMsg);
      console.error("❌ Full error:", response.error);
      throw new Error(errorMsg);
    }

    console.log("✅ serverApi.resendVerification success");
    return response.data;
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string) {
    const client = createServerApiClient();
    const response = await client.POST("/v1/auth/forgot-password", {
      body: { email },
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Password reset request failed";
      throw new Error(errorMsg);
    }

    return response.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string) {
    const client = createServerApiClient();
    const response = await client.POST("/v1/auth/reset-password", {
      body: { token, newPassword },
    });

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Password reset failed";
      throw new Error(errorMsg);
    }

    return response.data;
  },

  /**
   * Refresh access token
   */
  async refresh() {
    const client = createServerApiClient();
    const response = await client.POST("/v1/auth/refresh");

    if (response.error || !response.data) {
      const errorMsg =
        response.error?.error ||
        response.error?.message ||
        "Token refresh failed";
      throw new Error(errorMsg);
    }

    return response.data;
  },

  /**
   * Logout (requires auth token)
   */
  async logout(accessToken: string) {
    const client = createServerApiClient(accessToken);
    const response = await client.POST("/v1/auth/logout");

    if (!response.data) {
      throw new Error("Logout failed");
    }

    return response.data;
  },

  /**
   * Change password (requires auth token)
   * NOTE: This endpoint is not yet migrated to OpenAPI (Phase 3.5)
   * Uses manual fetch until SDK types are generated
   */
  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string
  ) {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to change password"
      );
    }

    const data = await response.json();
    return data;
  },
};
