/**
 * Shared TypeScript types for the demo app
 */

/**
 * User object as returned from the backend
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  status: "active" | "suspended" | "deleted";
  mfaEnabled: boolean;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Auth state
 */
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * API response for login/register
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  message?: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  details?: any;
}
