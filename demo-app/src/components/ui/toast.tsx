/**
 * Toast Notification Component
 *
 * Minimal toast notifications for user feedback
 * Auto-dismisses after 5 seconds
 */

import {
  component$,
  useSignal,
  useVisibleTask$,
  type Signal,
} from "@qwik.dev/core";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastProps {
  toast: Toast;
  onRemove: Signal<string | null>;
}

export const ToastItem = component$<ToastProps>(({ toast, onRemove }) => {
  const isVisible = useSignal(false);

  // Fade in animation
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    setTimeout(() => {
      isVisible.value = true;
    }, 10);

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      isVisible.value = false;
      setTimeout(() => {
        onRemove.value = toast.id;
      }, 300);
    }, 5000);

    return () => clearTimeout(timer);
  });

  const getStyles = () => {
    const baseStyles = "transition-all duration-300 ease-in-out";
    if (!isVisible.value) {
      return `${baseStyles} opacity-0 translate-x-full`;
    }
    return `${baseStyles} opacity-100 translate-x-0`;
  };

  const getTypeStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-black text-white border-black";
      case "error":
        return "bg-white text-black border-black";
      case "info":
        return "bg-white text-black border-black";
    }
  };

  return (
    <div
      class={`${getStyles()} ${getTypeStyles()} border px-6 py-4 mb-3 flex items-center justify-between min-w-80 max-w-md`}
    >
      <div class="flex items-center gap-3">
        <span class="text-sm">{toast.message}</span>
      </div>
      <button
        onClick$={() => {
          isVisible.value = false;
          setTimeout(() => {
            onRemove.value = toast.id;
          }, 300);
        }}
        class="opacity-60 hover:opacity-100 transition-opacity ml-4"
      >
        ✕
      </button>
    </div>
  );
});

interface ToastContainerProps {
  toasts: Signal<Toast[]>;
}

export const ToastContainer = component$<ToastContainerProps>(({ toasts }) => {
  const removeId = useSignal<string | null>(null);

  // Watch for removal requests
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const id = track(() => removeId.value);
    if (id) {
      toasts.value = toasts.value.filter((t) => t.id !== id);
      removeId.value = null;
    }
  });

  return (
    <div class="fixed top-6 right-6 z-50 pointer-events-none">
      <div class="pointer-events-auto">
        {toasts.value.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeId} />
        ))}
      </div>
    </div>
  );
});

/**
 * Helper function to create a toast
 */
export function createToast(
  message: string,
  type: "success" | "error" | "info" = "info"
): Toast {
  return {
    id: crypto.randomUUID(),
    message,
    type,
  };
}
