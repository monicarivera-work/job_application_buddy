import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';
import { logAuditEvent } from '../../../services/auditLogger';
import { trackException, trackTrace } from '../../../services/telemetry';
import { AuthTokenMissingError, AuthTokenInvalidError, ErrorSeverity } from '../../../errors/AppError';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new AuthTokenMissingError('Missing or invalid Authorization header');
    logAuditEvent('unauthorized_access_attempt', {
      resource: `${req.method} ${req.path}`,
      success: false,
      ip: req.ip,
      details: { reason: 'missing_or_invalid_authorization_header' },
    });
    trackTrace(
      `[${err.code}] ${err.message} – ${req.method} ${req.path}`,
      ErrorSeverity.Warning,
      { resource: `${req.method} ${req.path}` },
    );
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; email: string };
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    const authErr = new AuthTokenInvalidError('Invalid or expired token');
    logAuditEvent('unauthorized_access_attempt', {
      resource: `${req.method} ${req.path}`,
      success: false,
      ip: req.ip,
      details: { reason: 'invalid_or_expired_token' },
    });
    trackException(authErr, undefined, {
      resource: `${req.method} ${req.path}`,
      cause: err instanceof Error ? err.message : String(err),
    });
    res.status(authErr.statusCode).json({ error: authErr.message, code: authErr.code });
  }
}
