/**
 * API Client for Authentication Service
 *
 * Provides type-safe API calls to the backend auth service.
 * Uses openapi-fetch for type-safe API calls.
 *
 * @deprecated This file is being phased out in favor of server-api.ts
 * which uses openapi-fetch with full type safety from the OpenAPI spec.
 *
 * Migration guide:
 * - Use serverApi.login() instead of login$()
 * - Use serverApi.register() instead of register$()
 * - Use serverApi.getMe() instead of getCurrentUser$()
 * - Use serverApi.logout() instead of logout$()
 * - Use serverApi.refresh() instead of refreshToken$()
 */

import { server$ } from "@qwik.dev/router";
import { serverApi } from "./server-api";
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
 * @deprecated Use serverApi.login() instead for better type safety
 */
export const login$ = server$(
  async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const result = await serverApi.login(credentials);
      return result as unknown as AuthResponse;
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "Login failed",
        400
      );
    }
  }
);

/**
 * Register new user
 * @deprecated Use serverApi.register() instead for better type safety
 */
export const register$ = server$(
  async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const result = await serverApi.register(data);
      return result as unknown as AuthResponse;
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "Registration failed",
        400
      );
    }
  }
);

/**
 * Get current user info
 * @deprecated Use serverApi.getMe() instead for better type safety
 */
export const getCurrentUser$ = server$(
  async (accessToken: string): Promise<{ user: User }> => {
    try {
      const result = await serverApi.getMe(accessToken);
      return result as unknown as { user: User };
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "Failed to get user",
        400
      );
    }
  }
);

/**
 * Logout user
 * @deprecated Use serverApi.logout() instead for better type safety
 */
export const logout$ = server$(async (accessToken?: string): Promise<void> => {
  if (!accessToken) {
    throw new ApiError("Access token required", 401);
  }
  try {
    await serverApi.logout(accessToken);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Logout failed",
      400
    );
  }
});

/**
 * Refresh access token
 * @deprecated Use serverApi.refresh() instead for better type safety
 */
export const refreshToken$ = server$(
  async (): Promise<{
    accessToken: string;
  }> => {
    try {
      return await serverApi.refresh();
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : "Token refresh failed",
        400
      );
    }
  }
);
