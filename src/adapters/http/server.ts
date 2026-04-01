import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { profileRoutes } from './routes/profileRoutes';
import { jobRoutes } from './routes/jobRoutes';
import { applicationRoutes } from './routes/applicationRoutes';
import { authRoutes } from './routes/authRoutes';
import { resumeRoutes } from './routes/resumeRoutes';
import { requireAuth } from './middleware/authMiddleware';
import { initTelemetry, trackException, trackTrace, flushTelemetry } from '../../services/telemetry';
import { AppError, ErrorSeverity, InternalError, toAppError } from '../../errors/AppError';

// ── Initialise Application Insights before anything else ─────────────────────
initTelemetry(config.appInsightsConnectionString);

// ── Process-level safety nets ─────────────────────────────────────────────────
process.on('uncaughtException', (err: Error) => {
  trackException(err, undefined, { source: 'uncaughtException' });
  flushTelemetry();
  console.error('[process] Uncaught exception – shutting down:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  trackException(err, undefined, { source: 'unhandledRejection' });
  console.error('[process] Unhandled promise rejection:', err);
});

const app = express();
app.use(express.json());

/** Serve static frontend from public/ */
app.use(express.static(path.join(__dirname, '../../../public')));

/** Rate-limit authentication endpoints to mitigate brute-force attacks */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** General rate limit for all API routes */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Public auth endpoints (no JWT required) */
app.use('/api/auth', authLimiter, authRoutes);

/** All remaining API routes require a valid JWT */
app.use('/api/profile', apiLimiter, requireAuth, profileRoutes);
app.use('/api/jobs', apiLimiter, requireAuth, jobRoutes);
app.use('/api/applications', apiLimiter, requireAuth, applicationRoutes);
app.use('/api/resume', apiLimiter, requireAuth, resumeRoutes);

/** Health-check endpoint */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Global Express error handler.
 * Catches any error passed to next(err) or thrown inside a route.
 * Logs the exception to Application Insights and returns a structured JSON response.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const appErr = toAppError(err);
  const userId = (req as import('./middleware/authMiddleware').AuthRequest).userId;

  trackException(appErr, userId, {
    method: req.method,
    path: req.path,
    statusCode: String(appErr.statusCode),
  });

  trackTrace(
    `[${appErr.code}] ${appErr.message}`,
    appErr.severity,
    { method: req.method, path: req.path },
  );

  // Do not expose internal details for non-operational errors
  const clientMessage = appErr.isOperational
    ? appErr.message
    : 'An unexpected error occurred. Please try again later.';

  res.status(appErr.statusCode).json({
    error: clientMessage,
    code: appErr.code,
  });
});

const server = http.createServer(app);
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Is another instance running?`);
  } else {
    trackException(err, undefined, { source: 'server_error' });
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(config.port, () => {
  trackTrace(`Job assistant API started on port ${config.port}`, ErrorSeverity.Information);
  console.log(`Job assistant API running on port ${config.port}`);
});

export { app };
