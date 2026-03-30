import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { config } from '../../config';
import { profileRoutes } from './routes/profileRoutes';
import { jobRoutes } from './routes/jobRoutes';
import { applicationRoutes } from './routes/applicationRoutes';

const app = express();
app.use(express.json());

app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);

/** Health-check endpoint */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Global error-handling middleware.
 * Catches any error thrown (or passed via next(err)) in route handlers
 * and returns a structured JSON response instead of crashing the server.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
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
