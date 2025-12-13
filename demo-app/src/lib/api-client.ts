/**
 * Type-safe API Client using OpenAPI-generated types
 *
 * This client provides full type safety for all API requests and responses.
 * Types are automatically generated from the OpenAPI spec.
 */

import createClient from "openapi-fetch";
import type { paths } from "./api-client.d";
import { getApiUrl } from "./config";

// Create the typed API client
export const apiClient = createClient<paths>({
  baseUrl: getApiUrl(),
});

/**
 * API Error class for handling API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Helper to handle API responses and errors
 */
export async function handleApiResponse<T>(response: {
  data?: T;
  error?: any;
  response: Response;
}): Promise<T> {
  if (response.error) {
    const errorMessage =
      response.error.error || response.error.message || "API request failed";
    throw new ApiError(errorMessage, response.response.status, response.error);
  }

  if (!response.data) {
    throw new ApiError("No data returned from API", response.response.status);
  }

  return response.data;
}

/**
 * Set authentication token for all requests
 */
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.use({
      onRequest({ request }) {
        request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    });
  }
}

/**
 * Type-safe API methods with full IntelliSense
 */
export const api = {
  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    displayName: string;
  }) {
    const response = await apiClient.POST("/v1/auth/register", {
      body: data,
    });
    return handleApiResponse(response);
  },

  /**
   * Login with email and password
   */
  async login(data: { email: string; password: string }) {
    const response = await apiClient.POST("/v1/auth/login", {
      body: data,
    });
    return handleApiResponse(response);
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    const response = await apiClient.POST("/v1/auth/verify-email", {
      body: { token },
    });
    return handleApiResponse(response);
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string) {
    const response = await apiClient.POST("/v1/auth/resend-verification", {
      body: { email },
    });
    return handleApiResponse(response);
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string) {
    const response = await apiClient.POST("/v1/auth/forgot-password", {
      body: { email },
    });
    return handleApiResponse(response);
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string) {
    const response = await apiClient.POST("/v1/auth/reset-password", {
      body: { token, newPassword },
    });
    return handleApiResponse(response);
  },

  /**
   * Get current user (requires auth token)
   */
  async getMe() {
    const response = await apiClient.GET("/v1/auth/me");
    return handleApiResponse(response);
  },

  /**
   * Refresh access token
   */
  async refresh() {
    const response = await apiClient.POST("/v1/auth/refresh");
    return handleApiResponse(response);
  },

  /**
   * Logout (requires auth token)
   */
  async logout() {
    const response = await apiClient.POST("/v1/auth/logout");
    return handleApiResponse(response);
  },
};
