import { PrismaClient } from '@prisma/client';

// Shared singleton Prisma client to avoid connection pool exhaustion
const prisma = new PrismaClient();

export default prisma;
