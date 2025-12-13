import {
  component$,
  isDev,
  useSignal,
  useContextProvider,
  $,
} from "@qwik.dev/core";
import { QwikRouterProvider, RouterOutlet } from "@qwik.dev/router";
import { RouterHead } from "./components/router-head/router-head";
import { ToastContainer, type Toast } from "./components/ui/toast";
import { ToastContextId, showToast } from "./contexts/toast-context";

import "./global.css";

export default component$(() => {
  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  const toasts = useSignal<Toast[]>([]);

  // Provide toast context to all components
  useContextProvider(ToastContextId, {
    toasts,
    showToast: $((message: string, type?: "success" | "error" | "info") => {
      showToast(toasts, message, type);
    }),
  });

  return (
    <QwikRouterProvider>
      <head>
        <meta charset="utf-8" />
        {!isDev && (
          <link
            rel="manifest"
            href={`${import.meta.env.BASE_URL}manifest.json`}
          />
        )}
        <RouterHead />
      </head>
      <body lang="en">
        <RouterOutlet />
        {toasts.value.length > 0 && <ToastContainer toasts={toasts} />}
      </body>
    </QwikRouterProvider>
  );
});
