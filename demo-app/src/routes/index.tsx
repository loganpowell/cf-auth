/**
 * Home Page - Backend Health Check Demo
 *
 * This page demonstrates:
 * 1. Connection to the Cloudflare Workers backend
 * 2. Server-side API calls using Qwik's server$
 * 3. Reactive state management
 * 4. Error handling
 */

import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { server$ } from "@builder.io/qwik-city";
import { API_BASE_URL, type HealthCheckResponse, ApiError } from "~/lib/api";

/**
 * Server-side health check
 * This runs on the server to avoid CORS issues during development
 */
const checkHealth$ = server$(async (): Promise<HealthCheckResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
      throw new ApiError(
        `Health check failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data as HealthCheckResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Failed to connect to API: ${error instanceof Error ? error.message : "Unknown error"}`,
      0
    );
  }
});

export default component$(() => {
  const health = useSignal<HealthCheckResponse | null>(null);
  const error = useSignal<string | null>(null);
  const loading = useSignal(false);

  // Check health on mount
  useTask$(async () => {
    loading.value = true;
    error.value = null;

    try {
      const result = await checkHealth$();
      health.value = result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to connect to backend";
    } finally {
      loading.value = false;
    }
  });

  const handleRefresh = $(async () => {
    loading.value = true;
    error.value = null;

    try {
      const result = await checkHealth$();
      health.value = result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to connect to backend";
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="container">
      <header class="header">
        <h1>🔐 Auth Service Demo</h1>
        <p class="subtitle">Testing Phase 1 Infrastructure</p>
      </header>

      <main class="main">
        <section class="status-card">
          <h2>Backend Health Check</h2>

          {loading.value && (
            <div class="loading">
              <div class="spinner" />
              <p>Checking backend status...</p>
            </div>
          )}

          {error.value && (
            <div class="error">
              <h3>❌ Connection Failed</h3>
              <p>{error.value}</p>
              <p class="hint">
                Make sure the backend is running: <code>pnpm run dev</code>
              </p>
            </div>
          )}

          {health.value && !loading.value && (
            <div class="success">
              <h3>✅ Backend Connected</h3>
              <dl class="health-info">
                <div class="info-row">
                  <dt>Status:</dt>
                  <dd class="status-ok">{health.value.status}</dd>
                </div>
                <div class="info-row">
                  <dt>Version:</dt>
                  <dd>{health.value.version}</dd>
                </div>
                <div class="info-row">
                  <dt>Timestamp:</dt>
                  <dd>{new Date(health.value.timestamp).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          )}

          <button
            class="refresh-btn"
            onClick$={handleRefresh}
            disabled={loading.value}
          >
            {loading.value ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </section>

        <section class="info-card">
          <h2>📋 Phase 1 Status</h2>
          <ul class="checklist">
            <li class="completed">✅ Cloudflare Workers runtime</li>
            <li class="completed">✅ D1 Database provisioned</li>
            <li class="completed">✅ KV Namespaces created (3)</li>
            <li class="completed">✅ Health endpoint responding</li>
            <li class="completed">✅ Qwik v2 demo app initialized</li>
            <li class="pending">⏳ Authentication endpoints (Phase 2)</li>
            <li class="pending">⏳ Email integration (Phase 3)</li>
            <li class="pending">⏳ Permission system (Phase 4)</li>
          </ul>
        </section>

        <section class="next-steps">
          <h2>🚀 Next Steps</h2>
          <p>
            Phase 1 backend infrastructure is complete. The demo app can now
            communicate with the Cloudflare Workers backend.
          </p>
          <p>
            Ready to proceed to Phase 2: Core Authentication implementation.
          </p>
        </section>
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Auth Service Demo - Phase 1",
  meta: [
    {
      name: "description",
      content:
        "Cloudflare Workers Authentication Service demonstration application",
    },
  ],
};
