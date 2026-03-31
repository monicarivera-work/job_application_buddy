/**
 * Audit Logger – GDPR-compliant structured event logging.
 *
 * Rules:
 *  - Every log entry is a single-line JSON object written to stdout.
 *  - Personally Identifiable Information (PII) such as names, email addresses,
 *    resume content, or raw query parameters is NEVER included in log entries.
 *  - The `userId` field is a pseudonymous identifier (UUID) – not PII on its own.
 *  - Sensitive details like passwords or tokens are never logged.
 */

export type AuditAction =
  // Authentication
  | 'user_registered'
  | 'user_login_success'
  | 'user_login_failed'
  | 'resume_uploaded'
  // GDPR
  | 'user_data_exported'
  | 'user_account_deleted'
  // Profile
  | 'profile_accessed'
  | 'profile_updated'
  // Applications
  | 'application_plan_created'
  | 'application_submitted'
  | 'applications_listed'
  | 'application_status_updated'
  // Security
  | 'unauthorized_access_attempt'
  | 'rate_limit_exceeded';

export interface AuditEntry {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Pseudonymous user identifier (UUID). Omitted when user is not authenticated. */
  userId?: string;
  /** The security/data-processing action that occurred */
  action: AuditAction;
  /** HTTP method + path, e.g. "POST /api/auth/register" */
  resource?: string;
  /** Whether the action completed successfully */
  success: boolean;
  /** Client IP address (may be IPv4 or IPv6) */
  ip?: string;
  /** Non-PII contextual details (IDs, status codes, error codes) */
  details?: Record<string, unknown>;
}

/** Write a structured audit log entry to stdout as a single JSON line. */
export function auditLog(entry: AuditEntry): void {
  const line = JSON.stringify(entry);
  // Use process.stdout.write for reliable atomic line writes.
  process.stdout.write(`[AUDIT] ${line}\n`);
}

/** Helper: build an AuditEntry and write it immediately. */
export function logAuditEvent(
  action: AuditAction,
  opts: Omit<AuditEntry, 'action' | 'timestamp'>
): void {
  auditLog({
    timestamp: new Date().toISOString(),
    action,
    ...opts,
  });
}
