import { Router, Request, Response } from 'express';
import { profileService } from '../../../services/profileService';
import { applicationOrchestrator } from '../../../services/applicationOrchestrator';
import { applicationRepo } from '../../persistence/applicationRepo';
import { MatchedJob } from '../../../domain/job';

export const applicationRoutes = Router();

/**
 * POST /api/applications/plan
 * Builds a draft application plan for a matched job.
 * Body: { userId: string, job: MatchedJob }
 */
applicationRoutes.post('/plan', async (req: Request, res: Response) => {
  const { userId, job } = req.body as { userId: string; job: MatchedJob };

  if (!userId || !job || !job.title?.trim() || !job.company?.trim() || !job.applyUrl?.trim()) {
    res.status(400).json({ error: 'userId and a valid job (with title, company, applyUrl) are required' });
    return;
  }

  const profile = await profileService.getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const plan = await applicationOrchestrator.buildApplicationPlan(profile, job);
  res.json(plan);
});

/**
 * POST /api/applications/submit
 * Submits an approved application plan.
 * Body: { userId: string, plan: ApplicationPlan, files?: Record<string, string> }
 */
applicationRoutes.post('/submit', async (req: Request, res: Response) => {
  const { userId, plan, files = {} } = req.body as {
    userId: string;
    plan: Parameters<typeof applicationOrchestrator.submitApprovedApplication>[1];
    files?: Record<string, string>;
  };

  if (!userId || !plan) {
    res.status(400).json({ error: 'userId and plan are required' });
    return;
  }

  const profile = await profileService.getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  await applicationOrchestrator.submitApprovedApplication(profile, plan, files);
  res.json({ message: 'Application submitted successfully' });
});

/**
 * GET /api/applications?userId=<id>
 * Returns the application history for the given user.
 */
applicationRoutes.get('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: 'userId query parameter is required' });
    return;
  }

  const records = await applicationRepo.listByUser(userId);
  res.json(records);
});

/**
 * PATCH /api/applications/:id/status
 * Updates the status of an application.
 * Body: { status: ApplicationStatus, notes?: string }
 */
applicationRoutes.patch('/:id/status', async (req: Request, res: Response) => {
  const { status, notes } = req.body as {
    status: Parameters<typeof applicationRepo.updateStatus>[1];
    notes?: string;
  };

  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const updated = await applicationRepo.updateStatus(req.params.id, status, notes);
  if (!updated) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.json(updated);
});
