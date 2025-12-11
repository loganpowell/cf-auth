/**
 * Dashboard Layout
 *
 * Provides the layout structure for authenticated pages.
 * Simple version without server$ - just handles logout navigation.
 */

import { component$, Slot, $, useSignal } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";

export default component$(() => {
  const nav = useNavigate();
  const showUserMenu = useSignal(false);

  const handleLogout = $(async () => {
    // Clear local storage and navigate to login
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        // Call logout endpoint (fire and forget)
        fetch("http://localhost:8787/v1/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {
          // Ignore errors - we're logging out anyway
        });
      }
      localStorage.removeItem("accessToken");
    }
    await nav("/");
  });

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-4">
            {/* Logo */}
            <div class="flex items-center">
              <a href="/dashboard" class="flex items-center">
                <span class="text-2xl">🔐</span>
                <span class="ml-2 text-xl font-bold text-gray-900">
                  Auth Service
                </span>
              </a>
            </div>

            {/* User Menu */}
            <div class="relative">
              <button
                onClick$={() => {
                  showUserMenu.value = !showUserMenu.value;
                }}
                class="flex items-center space-x-3 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 transition-colors"
              >
                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-medium">
                  U
                </div>
                <div class="text-left">
                  <div class="text-sm font-medium text-gray-900">User</div>
                  <div class="text-xs text-gray-500">Authenticated</div>
                </div>
                <svg
                  class="w-4 h-4 text-gray-500"
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
              {showUserMenu.value && (
                <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick$={handleLogout}
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <svg
                      class="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Slot />
      </main>
    </div>
  );
});
