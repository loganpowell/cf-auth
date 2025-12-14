/**
 * Permission Badge Component
 *
 * Displays a single permission with icon, label, and state indicator.
 * Shows tooltip with permission description on hover.
 */

import { component$, $, type QRL } from "@qwik.dev/core";
import {
  getPermissionCategory,
  formatPermissionName,
  PERMISSION_CATEGORIES,
} from "~/lib/permissions-api";

export interface PermissionBadgeProps {
  /**
   * Permission name (e.g., "org:read", "team:create")
   */
  permission: string;

  /**
   * Visual state of the permission
   */
  state?: "granted" | "inherited" | "missing" | "pending";

  /**
   * Optional description tooltip
   */
  description?: string;

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";

  /**
   * Click handler
   */
  onClick$?: QRL<() => void>;

  /**
   * Whether the badge is clickable
   */
  clickable?: boolean;
}

export const PermissionBadge = component$<PermissionBadgeProps>(
  ({
    permission,
    state = "granted",
    description,
    size = "md",
    onClick$,
    clickable = false,
  }) => {
    const category = getPermissionCategory(permission);
    const categoryInfo = PERMISSION_CATEGORIES[category];
    const displayName = formatPermissionName(permission);

    // State-based styling
    const stateClasses = {
      granted:
        "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
      inherited:
        "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
      missing:
        "bg-white dark:bg-black text-black dark:text-white border-black dark:border-white opacity-50",
      pending:
        "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700 animate-pulse",
    };

    // Size-based styling
    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-3 py-1 text-sm",
      lg: "px-4 py-1.5 text-base",
    };

    const baseClasses = `
      inline-flex items-center gap-1.5 rounded-full border
      font-medium transition-all duration-200
      ${stateClasses[state]}
      ${sizeClasses[size]}
      ${clickable || onClick$ ? "cursor-pointer hover:shadow-md hover:scale-105" : ""}
    `.trim();

    return (
      <span
        class={baseClasses}
        onClick$={onClick$}
        title={description || permission}
        role={clickable || onClick$ ? "button" : undefined}
        tabIndex={clickable || onClick$ ? 0 : undefined}
      >
        <span class="text-base leading-none">{categoryInfo.icon}</span>
        <span>{displayName}</span>
        {state === "inherited" && (
          <span class="text-xs opacity-70" title="Inherited from parent">
            ↓
          </span>
        )}
        {state === "missing" && (
          <span class="text-xs opacity-70" title="Permission not granted">
            ✗
          </span>
        )}
        {state === "pending" && (
          <span class="text-xs opacity-70" title="Permission change pending">
            ...
          </span>
        )}
      </span>
    );
  }
);

/**
 * Permission Badge List - displays multiple badges in a grid
 */
export interface PermissionBadgeListProps {
  permissions: string[];
  state?: "granted" | "inherited" | "missing" | "pending";
  onPermissionClick$?: QRL<(permission: string) => void>;
}

export const PermissionBadgeList = component$<PermissionBadgeListProps>(
  ({ permissions, state, onPermissionClick$ }) => {
    return (
      <div class="flex flex-wrap gap-2">
        {permissions.map((permission) => (
          <PermissionBadge
            key={permission}
            permission={permission}
            state={state}
            onClick$={
              onPermissionClick$
                ? $(() => onPermissionClick$(permission))
                : undefined
            }
            clickable={!!onPermissionClick$}
          />
        ))}
      </div>
    );
  }
);
