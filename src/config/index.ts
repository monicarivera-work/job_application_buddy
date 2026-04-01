import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('[security] JWT_SECRET is not set. Using an insecure default. Set JWT_SECRET in production.');
}

export const config = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DATABASE_URL || 'postgres://localhost/job_assistant',
  headless: process.env.HEADLESS !== 'false',
  jwtSecret: jwtSecret || 'change-me-in-production',
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  azureStorageContainerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads',
  appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '',
};
