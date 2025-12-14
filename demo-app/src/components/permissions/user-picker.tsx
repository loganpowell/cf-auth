/**
 * User Picker Component
 *
 * Searchable dropdown for selecting users in the permissions dashboard.
 * Makes it easy to select users by email/name instead of typing user IDs.
 */

import { component$, useSignal, $, type QRL } from "@qwik.dev/core";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export interface UserListItem {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: number;
  status: "active" | "suspended";
}

interface UserPickerProps {
  users: UserListItem[];
  selectedUserId?: string;
  onSelect$: QRL<(userId: string) => void>;
  disabled?: boolean;
  loading?: boolean;
}

export const UserPicker = component$<UserPickerProps>((props) => {
  const searchQuery = useSignal("");
  const isOpen = useSignal(false);
  const selectedUser = useSignal<UserListItem | null>(null);

  // Find the selected user from the users list
  if (props.selectedUserId && !selectedUser.value) {
    const user = props.users.find((u) => u.id === props.selectedUserId);
    if (user) {
      selectedUser.value = user;
    }
  }

  // Filter users based on search query
  const filteredUsers = props.users.filter((user) => {
    if (!searchQuery.value) return true;
    const query = searchQuery.value.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.displayName?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  });

  const handleSelect = $((user: UserListItem) => {
    selectedUser.value = user;
    isOpen.value = false;
    searchQuery.value = "";
    props.onSelect$(user.id);
  });

  const handleClear = $(() => {
    selectedUser.value = null;
    searchQuery.value = "";
    props.onSelect$("");
  });

  return (
    <div class="relative">
      {/* Display selected user or show search input */}
      {selectedUser.value ? (
        <div class="flex items-center gap-2 p-3 border border-black dark:border-white bg-white dark:bg-black">
          <div class="flex-1">
            <div class="font-medium text-black dark:text-white">
              {selectedUser.value.displayName || selectedUser.value.email}
            </div>
            <div class="text-sm text-black dark:text-white opacity-60">
              {selectedUser.value.email}
            </div>
            <div class="text-xs text-black dark:text-white opacity-40 font-mono">
              {selectedUser.value.id}
            </div>
          </div>
          <div class="flex items-center gap-2">
            {selectedUser.value.emailVerified && (
              <span
                class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                title="Email verified"
              >
                ✓ Verified
              </span>
            )}
            <Button
              onClick$={handleClear}
              variant="secondary"
              disabled={props.disabled}
            >
              Change
            </Button>
          </div>
        </div>
      ) : (
        <div class="space-y-2">
          <div class="flex gap-2">
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery.value}
              onInput$={(e) => {
                searchQuery.value = (e.target as HTMLInputElement).value;
                isOpen.value = true;
              }}
              disabled={props.disabled || props.loading}
              class="flex-1"
            />
            <Button
              onClick$={() => {
                isOpen.value = !isOpen.value;
              }}
              variant="secondary"
              disabled={props.disabled || props.loading}
            >
              {isOpen.value ? "Close" : "Select User"}
            </Button>
          </div>

          {/* Dropdown list */}
          {isOpen.value && (
            <div class="absolute z-50 w-full mt-1 max-h-64 overflow-auto border border-black dark:border-white bg-white dark:bg-black shadow-lg">
              {props.loading ? (
                <div class="p-4 text-center text-black dark:text-white opacity-60">
                  Loading users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div class="p-4 text-center text-black dark:text-white opacity-60">
                  {searchQuery.value ? "No users found" : "No users available"}
                </div>
              ) : (
                <ul class="py-1">
                  {filteredUsers.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick$={() => handleSelect(user)}
                        class="w-full text-left px-4 py-2 hover:bg-black hover:bg-opacity-5 dark:hover:bg-white dark:hover:bg-opacity-5 transition-colors"
                        disabled={props.disabled}
                      >
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-black dark:text-white truncate">
                              {user.displayName || user.email}
                            </div>
                            <div class="text-sm text-black dark:text-white opacity-60 truncate">
                              {user.email}
                            </div>
                            <div class="text-xs text-black dark:text-white opacity-40 font-mono truncate">
                              {user.id}
                            </div>
                          </div>
                          <div class="flex items-center gap-1 shrink-0">
                            {user.emailVerified && (
                              <span
                                class="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"
                                title="Email verified"
                              />
                            )}
                            {user.status === "suspended" && (
                              <span
                                class="text-xs px-1 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                                title="Suspended"
                              >
                                Suspended
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
