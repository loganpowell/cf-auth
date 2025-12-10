/**
 * API Client for Authentication Service
 *
 * Provides type-safe API calls to the backend auth service.
 */

// API Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8787";

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
