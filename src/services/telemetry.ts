/**
 * Application Insights Telemetry Service
 *
 * Wraps the Azure Application Insights SDK and exposes simple helpers for:
 *  - Tracking exceptions (with structured AppError metadata)
 *  - Tracking trace messages
 *  - Tracking custom events
 *
 * Initialisation is gated on `APPLICATIONINSIGHTS_CONNECTION_STRING` being set.
 * When it is absent the helpers fall back to structured console output so that
 * local development continues to produce readable logs.
 */

import { AppError, ErrorSeverity } from '../errors/AppError';

/** Maps our numeric ErrorSeverity to the Application Insights string-based SeverityLevel. */
const SEVERITY_MAP: Record<ErrorSeverity, string> = {
  [ErrorSeverity.Verbose]: 'Verbose',
  [ErrorSeverity.Information]: 'Information',
  [ErrorSeverity.Warning]: 'Warning',
  [ErrorSeverity.Error]: 'Error',
  [ErrorSeverity.Critical]: 'Critical',
};

/** Lazily-loaded Application Insights client (undefined when not configured). */
let _client: import('applicationinsights').TelemetryClient | undefined;

/** True once `initTelemetry()` has been called. */
let _initialised = false;

/**
 * Initialise the Application Insights SDK.
 * Call this once at process start, before any routes are registered.
 *
 * @param connectionString  Application Insights connection string.
 *                          Falls back to the `APPLICATIONINSIGHTS_CONNECTION_STRING` env var.
 */
export function initTelemetry(connectionString?: string): void {
  if (_initialised) return;
  _initialised = true;

  const cs = connectionString ?? process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ?? '';
  if (!cs) {
    console.info('[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING is not set – telemetry will be logged to stdout only.');
    return;
  }

  try {
    // Dynamic import so the SDK is only loaded when actually configured
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appInsights = require('applicationinsights') as typeof import('applicationinsights');
    appInsights.setup(cs)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(false)
      .start();
    _client = appInsights.defaultClient;
    console.info('[telemetry] Application Insights initialised.');
  } catch (err) {
    console.error('[telemetry] Failed to initialise Application Insights:', err);
  }
}

/**
 * Track an exception in Application Insights.
 * Falls back to `console.error` when not configured.
 *
 * @param err      The error to track (AppError or unknown).
 * @param userId   Optional pseudonymous user identifier (not PII on its own).
 * @param properties  Additional non-PII properties to attach.
 */
export function trackException(
  err: unknown,
  userId?: string,
  properties?: Record<string, string>,
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const appError = err instanceof AppError ? err : undefined;

  const props: Record<string, string> = {
    ...(appError && { errorCode: appError.code, isOperational: String(appError.isOperational) }),
    ...(userId && { userId }),
    ...properties,
  };

  if (_client) {
    _client.trackException({ exception: error, properties: props });
  } else {
    console.error('[telemetry:exception]', JSON.stringify({
      message: error.message,
      stack: error.stack,
      ...(appError && { code: appError.code, statusCode: appError.statusCode }),
      ...props,
    }));
  }
}

/**
 * Track a trace message (informational log) in Application Insights.
 * Falls back to `console.info` / `console.warn` / `console.error` based on severity.
 */
export function trackTrace(
  message: string,
  severity: ErrorSeverity = ErrorSeverity.Information,
  properties?: Record<string, string>,
): void {
  if (_client) {
    _client.trackTrace({ message, severity: SEVERITY_MAP[severity], properties });
  } else {
    const logFn =
      severity >= ErrorSeverity.Error ? console.error :
      severity === ErrorSeverity.Warning ? console.warn :
      console.info;
    logFn('[telemetry:trace]', message, properties ?? '');
  }
}

/**
 * Track a named custom event in Application Insights.
 * Falls back to `console.info` when not configured.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string>,
): void {
  if (_client) {
    _client.trackEvent({ name, properties });
  } else {
    console.info('[telemetry:event]', name, properties ?? '');
  }
}

/**
 * Returns true if the Application Insights client is active.
 * Useful for conditional behaviour in tests.
 */
export function isTelemetryEnabled(): boolean {
  return _client !== undefined;
}

/**
 * Flush all pending telemetry synchronously.
 * Should be called before process exit to avoid losing buffered data.
 */
export function flushTelemetry(): void {
  if (_client) {
    _client.flush();
  }
}
