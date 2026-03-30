import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;

if (nodeEnv === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable must be set in production');
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/job_buddy',
  jwt: {
    secret: jwtSecret || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  headless: process.env.HEADLESS !== 'false',
};
