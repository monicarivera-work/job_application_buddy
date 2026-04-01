import { ErrorSeverity } from '../errors/AppError';

// We need to reset the module state between tests because telemetry.ts
// uses module-level singleton state (_initialised, _client).
let trackException: typeof import('../services/telemetry').trackException;
let trackTrace: typeof import('../services/telemetry').trackTrace;
let trackEvent: typeof import('../services/telemetry').trackEvent;
let isTelemetryEnabled: typeof import('../services/telemetry').isTelemetryEnabled;
let initTelemetry: typeof import('../services/telemetry').initTelemetry;

beforeEach(() => {
  jest.resetModules();
  // Delete the cached module so each test gets a fresh singleton state
  const mod = require('../services/telemetry');
  trackException = mod.trackException;
  trackTrace = mod.trackTrace;
  trackEvent = mod.trackEvent;
  isTelemetryEnabled = mod.isTelemetryEnabled;
  initTelemetry = mod.initTelemetry;
});

describe('telemetry – no connection string (console fallback)', () => {
  it('isTelemetryEnabled returns false when not configured', () => {
    expect(isTelemetryEnabled()).toBe(false);
  });

  it('trackException logs to console.error when not configured', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    trackException(new Error('test error'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[telemetry:exception]');
    spy.mockRestore();
  });

  it('trackException includes error message in output', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    trackException(new Error('something failed'), 'user-123', { resource: '/api/test' });
    const output = spy.mock.calls[0][1] as string;
    const parsed = JSON.parse(output);
    expect(parsed.message).toBe('something failed');
    expect(parsed.userId).toBe('user-123');
    expect(parsed.resource).toBe('/api/test');
    spy.mockRestore();
  });

  it('trackTrace logs to console.info for Information severity', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    trackTrace('hello', ErrorSeverity.Information);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[telemetry:trace]');
    spy.mockRestore();
  });

  it('trackTrace logs to console.warn for Warning severity', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    trackTrace('watch out', ErrorSeverity.Warning);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('trackTrace logs to console.error for Error and Critical severity', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    trackTrace('critical fail', ErrorSeverity.Critical);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('trackEvent logs to console.info when not configured', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    trackEvent('resume_uploaded', { ext: 'pdf' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[telemetry:event]');
    expect(spy.mock.calls[0][1]).toBe('resume_uploaded');
    spy.mockRestore();
  });

  it('trackException handles non-Error values gracefully', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => trackException('plain string error')).not.toThrow();
    expect(() => trackException(42)).not.toThrow();
    expect(() => trackException(null)).not.toThrow();
    spy.mockRestore();
  });
});

describe('telemetry – initTelemetry', () => {
  it('logs a warning when connection string is empty', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    initTelemetry('');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('APPLICATIONINSIGHTS_CONNECTION_STRING is not set'),
    );
    spy.mockRestore();
  });

  it('does not re-initialise when called a second time', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    initTelemetry('');
    initTelemetry('');
    // Only one info call expected for the "not set" warning
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
