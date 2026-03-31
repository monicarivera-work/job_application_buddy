import express from 'express';
import http from 'http';
import path from 'path';
import { config } from '../../config';
import { profileRoutes } from './routes/profileRoutes';
import { jobRoutes } from './routes/jobRoutes';
import { applicationRoutes } from './routes/applicationRoutes';

const app = express();
app.use(express.json());

/** Serve static frontend from public/ */
app.use(express.static(path.join(__dirname, '../../../public')));

app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);

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
