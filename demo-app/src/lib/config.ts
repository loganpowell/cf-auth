/**
 * Configuration utilities for the demo app
 *
 * Provides access to environment variables with fallback defaults
 */

/**
 * Get the API base URL
 *
 * In development: Uses VITE_API_URL from .env (http://localhost:8787)
 * In production: Should be set to your deployed API URL
 */
export function getApiUrl(): string {
  // In Qwik server-side code, we can use import.meta.env
  // Vite will replace this at build time
  return import.meta.env.VITE_API_URL || "http://localhost:8787";
}

/**
 * Get the app base URL
 *
 * In development: Uses VITE_APP_URL from .env (http://localhost:5173)
 * In production: Should be set to your deployed app URL
 */
export function getAppUrl(): string {
  return import.meta.env.VITE_APP_URL || "http://localhost:5173";
}
