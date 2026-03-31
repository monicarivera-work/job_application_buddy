import { auditLog, logAuditEvent, AuditEntry } from '../services/auditLogger';

describe('auditLogger', () => {
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('writes a JSON line prefixed with [AUDIT]', () => {
    auditLog({
      timestamp: '2024-01-01T00:00:00.000Z',
      action: 'user_login_success',
      userId: 'user-1',
      success: true,
      ip: '127.0.0.1',
    });

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = writeSpy.mock.calls[0][0] as string;
    expect(written.startsWith('[AUDIT] ')).toBe(true);
    expect(written.endsWith('\n')).toBe(true);
  });

  it('produces valid JSON with expected fields', () => {
    auditLog({
      timestamp: '2024-01-01T00:00:00.000Z',
      action: 'user_login_failed',
      userId: 'user-2',
      success: false,
      ip: '10.0.0.1',
      details: { reason: 'wrong_password' },
    });

    const written = writeSpy.mock.calls[0][0] as string;
    const json = JSON.parse(written.replace(/^\[AUDIT\] /, ''));
    expect(json.action).toBe('user_login_failed');
    expect(json.userId).toBe('user-2');
    expect(json.success).toBe(false);
    expect(json.details.reason).toBe('wrong_password');
    expect(json.timestamp).toBe('2024-01-01T00:00:00.000Z');
  });

  it('does not include PII fields (email, name, password) in log output', () => {
    const entry: AuditEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      action: 'user_registered',
      userId: 'user-3',
      success: true,
      ip: '192.168.1.1',
    };
    auditLog(entry);

    const written = writeSpy.mock.calls[0][0] as string;
    expect(written).not.toContain('email');
    expect(written).not.toContain('password');
    expect(written).not.toContain('name');
  });

  it('logAuditEvent sets a current ISO timestamp', () => {
    const before = Date.now();
    logAuditEvent('profile_accessed', { userId: 'user-4', success: true });
    const after = Date.now();

    const written = writeSpy.mock.calls[0][0] as string;
    const json = JSON.parse(written.replace(/^\[AUDIT\] /, ''));
    const ts = new Date(json.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('logs without userId for unauthenticated events', () => {
    logAuditEvent('user_login_failed', {
      success: false,
      resource: 'POST /api/auth/login',
      details: { reason: 'account_not_found' },
    });

    const written = writeSpy.mock.calls[0][0] as string;
    const json = JSON.parse(written.replace(/^\[AUDIT\] /, ''));
    expect(json.userId).toBeUndefined();
    expect(json.action).toBe('user_login_failed');
  });
});
