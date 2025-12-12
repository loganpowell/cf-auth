/**
 * API Client for Authentication Service
 *
 * Provides type-safe API calls to the backend auth service.
 * Uses server$ for secure server-side API calls.
 */

import { server$ } from "@builder.io/qwik-city";
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  ApiErrorResponse,
} from "./types";
import { getApiUrl } from "./config";

// API Configuration
export const API_BASE_URL = getApiUrl();

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: string;
  timestamp: number;
  version: string;
}

/**
 * Generic API Error
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
 * Client-side configuration
 */
export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 30000, // 30 seconds
};

/**
 * Login user with credentials
 */
export const login$ = server$(
  async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
      credentials: "include", // Include cookies for refresh token
    });

    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new ApiError(error.error || "Login failed", response.status, error);
    }

    return response.json();
  }
);

/**
 * Register new user
 */
export const register$ = server$(
  async (data: RegisterData): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include", // Include cookies for refresh token
    });

    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new ApiError(
        error.error || "Registration failed",
        response.status,
        error
      );
    }

    return response.json();
  }
);

/**
 * Get current user info
 */
export const getCurrentUser$ = server$(
  async (accessToken: string): Promise<{ user: User }> => {
    const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new ApiError(
        error.error || "Failed to get user",
        response.status,
        error
      );
    }

    return response.json();
  }
);

/**
 * Logout user
 */
export const logout$ = server$(async (accessToken?: string): Promise<void> => {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/v1/auth/logout`, {
    method: "POST",
    headers,
    credentials: "include", // Include cookies to clear refresh token
  });

  if (!response.ok) {
    const error: ApiErrorResponse = await response.json();
    throw new ApiError(error.error || "Logout failed", response.status, error);
  }
});

/**
 * Refresh access token
 */
export const refreshToken$ = server$(
  async (): Promise<{
    accessToken: string;
  }> => {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send refresh token cookie
    });

    if (!response.ok) {
      const error: ApiErrorResponse = await response.json();
      throw new ApiError(
        error.error || "Token refresh failed",
        response.status,
        error
      );
    }

    return response.json();
  }
);
