/**
 * Theme Context
 *
 * Manages dark mode state with localStorage persistence
 */

import {
  createContextId,
  useContext,
  type Signal,
  type QRL,
} from "@qwik.dev/core";

export type Theme = "light" | "dark";

export interface ThemeContext {
  theme: Signal<Theme>;
  toggleTheme: QRL<() => void>;
}

export const ThemeContextId = createContextId<ThemeContext>("theme-context");

export const useTheme = () => {
  const context = useContext(ThemeContextId);
  return context;
};

/**
 * Initialize theme from localStorage or system preference
 */
export const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  // Check system preference
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

/**
 * Apply theme to document
 */
export const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};
