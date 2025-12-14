/**
 * Card Component
 *
 * Reusable card container
 */

import { component$, Slot } from "@qwik.dev/core";

export interface CardProps {
  class?: string;
}

export const Card = component$<CardProps>(({ class: className = "" }) => {
  return (
    <div
      class={`
        bg-white dark:bg-black
        border border-black dark:border-white
        rounded-lg shadow-sm
        ${className}
      `}
    >
      <Slot />
    </div>
  );
});
