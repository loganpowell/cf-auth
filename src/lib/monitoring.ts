/**
 * Monitoring and Observability
 *
 * Integrates Sentry for error tracking and Cloudflare Analytics
 * for performance monitoring.
 */

import { captureException as sentryCaptureException } from "@sentry/cloudflare";

export interface MonitoringConfig {
  sentryDsn?: string;
  environment: string;
  release?: string;
}

/**
 * Initialize Sentry error tracking
 *
 * Note: For Cloudflare Workers with Hono, we use captureException directly
 * rather than wrapping the entire handler.
 */
export function initializeSentry(config: MonitoringConfig): void {
  if (!config.sentryDsn) {
    console.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  console.log(`Sentry configured for environment: ${config.environment}`);
}

/**
 * Track request metrics
 */
export interface RequestMetrics {
  method: string;
  path: string;
  status: number;
  duration: number;
  tenantId?: string;
  userId?: string;
  error?: string;
}

/**
 * Log request completion with metrics
 */
export function logRequest(metrics: RequestMetrics): void {
  const { method, path, status, duration, tenantId, userId, error } = metrics;

  const logData = {
    type: "request",
    method,
    path,
    status,
    duration,
    ...(tenantId && { tenantId }),
    ...(userId && { userId }),
    ...(error && { error }),
    timestamp: new Date().toISOString(),
  };

  // Log to console (captured by Cloudflare)
  if (status >= 500) {
    console.error("Request error:", logData);
  } else if (status >= 400) {
    console.warn("Request warning:", logData);
  } else {
    console.log("Request completed:", logData);
  }
}

/**
 * Capture exception to Sentry
 */
export function captureException(
  error: Error,
  context?: Record<string, any>
): void {
  sentryCaptureException(error, {
    extra: context,
  });

  console.error("Exception captured:", {
    error: error.message,
    stack: error.stack,
    context,
  });
}

/**
 * Wrap request handler with monitoring
 */
export function withMonitoring<T>(
  handler: () => Promise<T>,
  context: {
    method: string;
    path: string;
    tenantId?: string;
    userId?: string;
  }
): Promise<T> {
  const startTime = Date.now();

  return handler()
    .then((result) => {
      logRequest({
        ...context,
        status: 200,
        duration: Date.now() - startTime,
      });
      return result;
    })
    .catch((error) => {
      captureException(error, context);
      logRequest({
        ...context,
        status: 500,
        duration: Date.now() - startTime,
        error: error.message,
      });
      throw error;
    });
}
