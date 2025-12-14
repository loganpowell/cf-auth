/**
 * Button Component
 *
 * Reusable button with variants
 */

import { component$, Slot, type QRL } from "@qwik.dev/core";

export interface ButtonProps {
  onClick$?: QRL<() => void>;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  class?: string;
}

export const Button = component$<ButtonProps>(
  ({
    onClick$,
    type = "button",
    variant = "primary",
    disabled = false,
    class: className = "",
  }) => {
    const variantClasses = {
      primary:
        "bg-black dark:bg-white text-white dark:text-black hover:opacity-80 border border-black dark:border-white",
      secondary:
        "bg-white dark:bg-black border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-black dark:text-white",
      danger:
        "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white border border-red-600 dark:border-red-500",
    };

    return (
      <button
        type={type}
        class={`
          px-4 py-2 rounded-lg font-medium
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${className}
        `}
        onClick$={onClick$}
        disabled={disabled}
      >
        <Slot />
      </button>
    );
  }
);
