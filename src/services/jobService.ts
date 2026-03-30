import { ApplicationStatus } from '@prisma/client';
import prisma from '../lib/prisma';

export interface JobSearchResult {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  source: string;
  postedAt: Date | null;
  matchScore?: number;
  applicationStatus?: ApplicationStatus;
}

export async function discoverJobs(userId: string): Promise<JobSearchResult[]> {
  // In a real implementation, this would scrape LinkedIn, Indeed, etc.
  // For now, return any saved jobs from the database
  const savedJobs = await prisma.job.findMany({
    include: {
      applications: {
        where: { userId },
        select: { status: true, matchScore: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return savedJobs.map(job => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    url: job.url,
    source: job.source,
    postedAt: job.postedAt,
    matchScore: job.applications[0]?.matchScore ?? undefined,
    applicationStatus: job.applications[0]?.status ?? undefined,
  }));
}

export async function getApplications(userId: string) {
  return prisma.application.findMany({
    where: { userId },
    include: {
      job: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApplication(userId: string, jobId: string, data: { coverLetter?: string; notes?: string }) {
  return prisma.application.create({
    data: {
      userId,
      jobId,
      ...data,
    },
    include: { job: true },
  });
}

export async function updateApplicationStatus(userId: string, applicationId: string, status: ApplicationStatus) {
  const existing = await prisma.application.findUnique({
    where: { id: applicationId, userId },
    select: { status: true },
  });
  const setAppliedAt =
    status === ApplicationStatus.SUBMITTED && existing?.status !== ApplicationStatus.SUBMITTED
      ? new Date()
      : undefined;

  return prisma.application.update({
    where: { id: applicationId, userId },
    data: { status, ...(setAppliedAt ? { appliedAt: setAppliedAt } : {}) },
    include: { job: true },
  });
}

export async function getUserProfile(userId: string) {
  return prisma.userProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function upsertUserProfile(userId: string, data: { headline?: string; skills?: string[]; resumeUrl?: string; preferences?: object }) {
  return prisma.userProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
