import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    console.warn('[auth] JWT verification failed:', err instanceof Error ? err.message : String(err));
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
