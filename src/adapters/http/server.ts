import express from 'express';
import http from 'http';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { profileRoutes } from './routes/profileRoutes';
import { jobRoutes } from './routes/jobRoutes';
import { applicationRoutes } from './routes/applicationRoutes';
import { authRoutes } from './routes/authRoutes';
import { requireAuth } from './middleware/authMiddleware';

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

/** Health-check endpoint */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Is another instance running?`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(config.port, () => {
  console.log(`Job assistant API running on port ${config.port}`);
});

export { app };
