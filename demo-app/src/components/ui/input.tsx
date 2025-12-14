/**
 * Input Component
 *
 * Reusable form input
 */

import { component$, type QRL } from "@qwik.dev/core";

export interface InputProps {
  type?: string;
  value?: string;
  placeholder?: string;
  onInput$?: QRL<(event: Event) => void>;
  onChange$?: QRL<(event: Event) => void>;
  disabled?: boolean;
  class?: string;
}

export const Input = component$<InputProps>(
  ({
    type = "text",
    value,
    placeholder,
    onInput$,
    onChange$,
    disabled = false,
    class: className = "",
  }) => {
    return (
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onInput$={onInput$}
        onChange$={onChange$}
        disabled={disabled}
        class={`
          w-full px-4 py-2 rounded-lg
          bg-white dark:bg-black
          border border-black dark:border-white
          text-black dark:text-white
          placeholder:text-black placeholder:dark:text-white placeholder:opacity-50
          focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
          ${className}
        `}
      />
    );
  }
);
