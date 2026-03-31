import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';
import { logAuditEvent } from '../../../services/auditLogger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logAuditEvent('unauthorized_access_attempt', {
      resource: `${req.method} ${req.path}`,
      success: false,
      ip: req.ip,
      details: { reason: 'missing_or_invalid_authorization_header' },
    });
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; email: string };
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    logAuditEvent('unauthorized_access_attempt', {
      resource: `${req.method} ${req.path}`,
      success: false,
      ip: req.ip,
      details: { reason: 'invalid_or_expired_token' },
    });
    console.warn('[auth] JWT verification failed:', err instanceof Error ? err.message : String(err));
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
