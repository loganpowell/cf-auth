/**
 * Auth Context for Qwik v2
 *
 * Provides authentication state management across the application.
 * Uses Qwik signals for reactive state and context for dependency injection.
 */

import {
  createContextId,
  useContext,
  useContextProvider,
  useSignal,
  useTask$,
  type Signal,
} from "@qwik.dev/core";
import type { AuthState, User } from "./types";

/**
 * Auth context interface
 */
export interface AuthContext {
  state: Signal<AuthState>;
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Create context ID for auth
 */
export const AuthContextId = createContextId<AuthContext>("auth-context");

/**
 * Initial auth state
 */
const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true, // Start as loading to check for existing session
  error: null,
};

/**
 * Hook to provide auth context
 */
export const useAuthProvider = () => {
  // Create reactive state signal
  const state = useSignal<AuthState>(initialAuthState);

  // Login function
  const login = (user: User, accessToken: string) => {
    // Store token in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", accessToken);
    }

    // Update state
    state.value = {
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    };
  };

  // Logout function
  const logout = () => {
    // Clear token from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
    }

    // Reset state
    state.value = {
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    };
  };

  // Update user function
  const updateUser = (user: User) => {
    state.value = {
      ...state.value,
      user,
    };
  };

  // Set loading state
  const setLoading = (isLoading: boolean) => {
    state.value = {
      ...state.value,
      isLoading,
    };
  };

  // Set error
  const setError = (error: string | null) => {
    state.value = {
      ...state.value,
      error,
      isLoading: false,
    };
  };

  // Restore token from localStorage on mount
  useTask$(({ track }) => {
    track(() => state.value);

    if (typeof window !== "undefined" && state.value.isLoading) {
      const token = localStorage.getItem("accessToken");
      if (token) {
        // Token exists, set it in state (will be validated by getCurrentUser$ call)
        state.value = {
          ...state.value,
          accessToken: token,
          isLoading: false,
        };
      } else {
        // No token, not authenticated
        state.value = {
          ...state.value,
          isLoading: false,
        };
      }
    }
  });

  const authContext: AuthContext = {
    state,
    login,
    logout,
    updateUser,
    setLoading,
    setError,
  };

  // Provide context
  useContextProvider(AuthContextId, authContext);

  return authContext;
};

/**
 * Hook to consume auth context
 */
export const useAuth = () => {
  return useContext(AuthContextId);
};
