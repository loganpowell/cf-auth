import {
  component$,
  isDev,
  useSignal,
  useContextProvider,
  $,
  useVisibleTask$,
  useOnDocument,
} from "@qwik.dev/core";
import { QwikRouterProvider, RouterOutlet } from "@qwik.dev/router";
import { RouterHead } from "./components/router-head/router-head";
import { ToastContainer, type Toast } from "./components/ui/toast";
import { ToastContextId, showToast } from "./contexts/toast-context";
import {
  ThemeContextId,
  getInitialTheme,
  applyTheme,
  type Theme,
} from "./contexts/theme-context";

import "./global.css";

export default component$(() => {
  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  const toasts = useSignal<Toast[]>([]);
  const theme = useSignal<Theme>("light");

  // Provide toast context to all components
  useContextProvider(ToastContextId, {
    toasts,
    showToast: $((message: string, type?: "success" | "error" | "info") => {
      showToast(toasts, message, type);
    }),
  });

  // Provide theme context to all components
  useContextProvider(ThemeContextId, {
    theme,
    toggleTheme: $(() => {
      const newTheme = theme.value === "light" ? "dark" : "light";
      console.log("🎨 Toggle: Switching from", theme.value, "to", newTheme);
      theme.value = newTheme;
      localStorage.setItem("theme", newTheme);
      applyTheme(newTheme);
      console.log(
        "🎨 Toggle: Applied theme, document classes:",
        document.documentElement.classList.toString()
      );
    }),
  });

  // Initialize theme on mount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      const initialTheme = getInitialTheme();
      console.log("🎨 Root: Initializing theme:", initialTheme);
      console.log(
        "🎨 Root: HTML classes before:",
        document.documentElement.className
      );
      theme.value = initialTheme;
      applyTheme(initialTheme);
      console.log(
        "🎨 Root: HTML classes after:",
        document.documentElement.className
      );
    },
    { strategy: "document-ready" }
  );

  // Also listen for changes and re-apply
  useOnDocument(
    "qinit",
    $(() => {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        console.log("🎨 OnDocument qinit: Applying saved theme:", savedTheme);
        document.documentElement.classList.toggle(
          "dark",
          savedTheme === "dark"
        );
      }
    })
  );

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
        {/* Prevent flash of wrong theme - run before anything else */}
        <script
          dangerouslySetInnerHTML={
            "(function(){const theme=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(theme==='dark'){document.documentElement.classList.add('dark');}})()"
          }
        />
        <RouterHead />
      </head>
      <body lang="en">
        <RouterOutlet />
        {toasts.value.length > 0 && <ToastContainer toasts={toasts} />}
      </body>
    </QwikRouterProvider>
  );
});
