/**
 * Toast Context
 *
 * Provides toast notification functionality throughout the app
 */

import { createContextId, type Signal, type QRL } from "@qwik.dev/core";
import type { Toast } from "~/components/ui/toast";

export interface ToastContext {
  toasts: Signal<Toast[]>;
  showToast: QRL<
    (message: string, type?: "success" | "error" | "info") => void
  >;
}

export const ToastContextId = createContextId<ToastContext>("toast-context");

/**
 * Helper to show a toast notification
 */
export function showToast(
  toasts: Signal<Toast[]>,
  message: string,
  type: "success" | "error" | "info" = "info"
) {
  const newToast: Toast = {
    id: crypto.randomUUID(),
    message,
    type,
  };

  toasts.value = [...toasts.value, newToast];
}
