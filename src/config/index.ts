import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DATABASE_URL || 'postgres://localhost/job_assistant',
  headless: process.env.HEADLESS !== 'false',
};
