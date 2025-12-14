/**
 * Role Selector Component - Rewritten using Qwik UI patterns
 * 
 * Key insight: Don't use reactive computations for dropdown data.
 * Map arrays directly in JSX like Qwik UI does.
 */

import { component$, useSignal, $, type QRL } from "@qwik.dev/core";
import { PermissionBadgeList } from "./permission-badge";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissionNames: string[];
  isSystem: boolean;
  organizationId: string | null;
}

export interface RoleSelectorProps {
  roles: Role[];
  selectedRoleId?: string;
  userPermissions?: string[];
  onSelect$: QRL<(role: Role) => void>;
  disabled?: boolean;
  placeholder?: string;
}

export const RoleSelector = component$<RoleSelectorProps>(
  ({
    roles,
    selectedRoleId,
    userPermissions = [],
    onSelect$,
    disabled = false,
    placeholder = "Select a role...",
  }) => {
    const isOpen = useSignal(false);
    const searchQuery = useSignal("");
    const hoveredRoleId = useSignal<string | null>(null);
    const internalSelectedRoleId = useSignal(selectedRoleId || "");

    const handleSelect = $((role: Role) => {
      internalSelectedRoleId.value = role.id;
      onSelect$(role);
      isOpen.value = false;
      searchQuery.value = "";
    });

    const handleToggle = $(() => {
      if (!disabled) {
        isOpen.value = !isOpen.value;
      }
    });

    return (
      <div class="relative">
        {/* Selector Button */}
        <button
          type="button"
          class={`
            w-full flex items-center justify-between gap-2 px-4 py-2.5
            bg-white dark:bg-black border border-black dark:border-white
            rounded-lg shadow-sm hover:shadow-md
            transition-all duration-200
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          onClick$={handleToggle}
          disabled={disabled}
        >
          <span class="flex-1 text-left">
            {/* Find selected role inline - no reactive computation */}
            {roles.find((r) => r.id === internalSelectedRoleId.value) ? (
              (() => {
                const selected = roles.find((r) => r.id === internalSelectedRoleId.value)!;
                return (
                  <span class="flex items-center gap-2">
                    <span class="font-medium text-black dark:text-white">
                      {selected.name}
                    </span>
                    {selected.isSystem && (
                      <span class="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        System
                      </span>
                    )}
                  </span>
                );
              })()
            ) : (
              <span class="text-black dark:text-white opacity-50">
                {placeholder}
              </span>
            )}
          </span>
          <svg
            class={`w-5 h-5 text-black dark:text-white opacity-70 transition-transform ${
              isOpen.value ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen.value && (
          <div class="absolute z-50 w-full mt-2 bg-white dark:bg-black border border-black dark:border-white rounded-lg shadow-xl">
            {/* Search Input */}
            <div class="p-2 border-b border-black dark:border-white">
              <input
                type="text"
                class="w-full px-3 py-2 bg-white dark:bg-black border border-black dark:border-white rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-black dark:text-white"
                placeholder="Search roles..."
                value={searchQuery.value}
                onInput$={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value.toLowerCase();
                }}
              />
            </div>

            {/* Role List - Direct mapping like Qwik UI Combobox */}
            <div class="max-h-64 overflow-y-auto">
              {roles
                .filter((role) => {
                  if (!searchQuery.value) return true;
                  return (
                    role.name.toLowerCase().includes(searchQuery.value) ||
                    role.description?.toLowerCase().includes(searchQuery.value)
                  );
                })
                .map((role) => {
                  // Inline computation per item, not reactive
                  const canDelegate =
                    userPermissions.length > 0 &&
                    role.permissionNames.every((perm) => userPermissions.includes(perm));
                  const isSelected = role.id === internalSelectedRoleId.value;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      class={`
                        w-full px-4 py-3 text-left transition-colors
                        hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
                        ${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                        ${!canDelegate ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                      onClick$={() => {
                        if (canDelegate) handleSelect(role);
                      }}
                      onMouseEnter$={() => {
                        hoveredRoleId.value = role.id;
                      }}
                      onMouseLeave$={() => {
                        hoveredRoleId.value = null;
                      }}
                      disabled={!canDelegate}
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="font-medium text-black dark:text-white">
                              {role.name}
                            </span>
                            {role.isSystem && (
                              <span class="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                System
                              </span>
                            )}
                            {isSelected && (
                              <svg
                                class="w-4 h-4 text-blue-600 dark:text-blue-400"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          {role.description && (
                            <p class="text-sm text-black dark:text-white opacity-70 mb-2">
                              {role.description}
                            </p>
                          )}
                          <div class="text-xs text-black dark:text-white opacity-50">
                            {role.permissionNames.length} permissions
                          </div>
                        </div>
                        {!canDelegate && (
                          <div class="shrink-0">
                            <span
                              class="text-xs text-red-600 dark:text-red-400"
                              title="You cannot delegate all permissions in this role"
                            >
                              ⚠️ Cannot grant
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Permission Preview Tooltip */}
        {hoveredRoleId.value && (() => {
          const hoveredRole = roles.find((r) => r.id === hoveredRoleId.value);
          if (!hoveredRole) return null;

          const canDelegate =
            userPermissions.length > 0 &&
            hoveredRole.permissionNames.every((perm) => userPermissions.includes(perm));

          return (
            <div class="absolute z-50 left-full ml-2 top-0 w-72 p-4 bg-white dark:bg-black border border-black dark:border-white rounded-lg shadow-xl">
              <div class="text-sm font-semibold mb-2 text-black dark:text-white">
                Permissions in "{hoveredRole.name}"
              </div>
              <PermissionBadgeList
                permissions={hoveredRole.permissionNames}
                state={canDelegate ? "granted" : "missing"}
              />
            </div>
          );
        })()}
      </div>
    );
  }
);
