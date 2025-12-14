/**
 * Role Selector Component
 *
 * Dropdown/combobox for selecting and assigning roles.
 * Shows permission preview on hover and validates delegation.
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
  /**
   * Available roles to select from
   */
  roles: Role[];

  /**
   * Currently selected role ID
   */
  selectedRoleId?: string;

  /**
   * User's permissions (for delegation validation)
   */
  userPermissions?: string[];

  /**
   * Callback when role is selected
   */
  onSelect$: QRL<(role: Role) => void>;

  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;

  /**
   * Placeholder text
   */
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
    
    // Use internal signal for selected role
    const internalSelectedRoleId = useSignal(selectedRoleId || "");

    // Check if user can delegate permissions - make it a QRL
    const canDelegateRole = $((role: Role): boolean => {
      if (!userPermissions.length) return false;
      return role.permissionNames.every((perm) =>
        userPermissions.includes(perm)
      );
    });

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

    const handleSearch = $((event: Event) => {
      const target = event.target as HTMLInputElement;
      searchQuery.value = target.value.toLowerCase();
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
            {roles.find((r) => r.id === internalSelectedRoleId.value) ? (
              <span class="flex items-center gap-2">
                <span class="font-medium text-black dark:text-white">
                  {roles.find((r) => r.id === internalSelectedRoleId.value)!.name}
                </span>
                {roles.find((r) => r.id === internalSelectedRoleId.value)!.isSystem && (
                  <span class="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                    System
                  </span>
                )}
              </span>
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
                onInput$={handleSearch}
              />
            </div>

            {/* Role List - Direct mapping like Qwik UI does */}
            <div class="max-h-64 overflow-y-auto">
              {roles
                .filter((role) => {
                  const query = searchQuery.value.toLowerCase();
                  return (
                    role.name.toLowerCase().includes(query) ||
                    role.description?.toLowerCase().includes(query) ||
                    !query
                  );
                })
                .map((role) => (
                  <RoleItem
                    key={role.id}
                    role={role}
                    isSelected={role.id === internalSelectedRoleId.value}
                    canDelegate={
                      userPermissions.length > 0 &&
                      role.permissionNames.every((perm) =>
                        userPermissions.includes(perm)
                      )
                    }
                    onSelect$={handleSelect}
                    onHover$={$((roleId: string | null) => {
                      hoveredRoleId.value = roleId;
                    })}
                  />
                ))}
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
                })
              )}
            </div>
          </div>
        )}

        {/* Permission Preview (shown when hovering over a role) */}
        {hoveredRole && (
          <div class="absolute z-50 left-0 right-0 mt-2 p-4 bg-white dark:bg-black border border-black dark:border-white rounded-lg shadow-xl">
            <h4 class="text-sm font-semibold text-black dark:text-white mb-3">
              Permissions in "{hoveredRole.name}"
            </h4>
            <PermissionBadgeList
              permissions={hoveredRole.permissionNames}
              state={canDelegateRole(hoveredRole) ? "granted" : "missing"}
            />
          </div>
        )}
      </div>
    );
  }
);
