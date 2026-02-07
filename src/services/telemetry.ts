const shouldLog = import.meta.env.DEV && import.meta.env.MODE !== 'test';

type TelemetryPayload = Record<string, unknown>;

export const trackEvent = (event: string, payload?: TelemetryPayload) => {
  if (!shouldLog) return;
  console.info('[telemetry:event]', event, payload || {});
};

export const trackError = (event: string, error: unknown, payload?: TelemetryPayload) => {
  if (!shouldLog) return;
  console.error('[telemetry:error]', event, {
    message: error instanceof Error ? error.message : String(error),
    payload: payload || {},
  });
};
