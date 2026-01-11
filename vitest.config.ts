import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          // Add any additional Miniflare options here
          compatibilityDate: "2024-01-01",
          compatibilityFlags: ["nodejs_compat"],
          bindings: {
            // Test bindings will be loaded from wrangler.toml
          },
        },
      },
    },
  },
});
