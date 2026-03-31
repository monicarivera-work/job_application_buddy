import { Router, Request, Response } from 'express';
import { profileService } from '../../../services/profileService';
import { applicationOrchestrator } from '../../../services/applicationOrchestrator';
import { applicationRepo } from '../../persistence/applicationRepo';
import { MatchedJob } from '../../../domain/job';
import { logAuditEvent } from '../../../services/auditLogger';
import { AuthRequest } from '../middleware/authMiddleware';

export const applicationRoutes = Router();

/**
 * POST /api/applications/plan
 * Builds a draft application plan for a matched job.
 * Body: { job: MatchedJob }
 */
applicationRoutes.post('/plan', async (req: AuthRequest, res: Response) => {
  const { job } = req.body as { job: MatchedJob };
  const userId = req.userId!;

  if (!job || !job.title?.trim() || !job.company?.trim() || !job.applyUrl?.trim()) {
    res.status(400).json({ error: 'A valid job (with title, company, applyUrl) is required' });
    return;
  }

  const profile = await profileService.getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const plan = await applicationOrchestrator.buildApplicationPlan(profile, job);
  logAuditEvent('application_plan_created', { userId, resource: 'POST /api/applications/plan', success: true, ip: req.ip });
  res.json(plan);
});

/**
 * POST /api/applications/submit
 * Submits an approved application plan.
 * Body: { plan: ApplicationPlan, files?: Record<string, string> }
 */
applicationRoutes.post('/submit', async (req: AuthRequest, res: Response) => {
  const { plan, files = {} } = req.body as {
    plan: Parameters<typeof applicationOrchestrator.submitApprovedApplication>[1];
    files?: Record<string, string>;
  };
  const userId = req.userId!;

  if (!plan) {
    res.status(400).json({ error: 'plan is required' });
    return;
  }

  const profile = await profileService.getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  await applicationOrchestrator.submitApprovedApplication(profile, plan, files);
  logAuditEvent('application_submitted', { userId, resource: 'POST /api/applications/submit', success: true, ip: req.ip });
  res.json({ message: 'Application submitted successfully' });
});

/**
 * GET /api/applications
 * Returns the application history for the authenticated user.
 */
applicationRoutes.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const records = await applicationRepo.listByUser(userId);
  logAuditEvent('applications_listed', { userId, resource: 'GET /api/applications', success: true, ip: req.ip, details: { count: records.length } });
  res.json(records);
});

/**
 * PATCH /api/applications/:id/status
 * Updates the status of an application owned by the authenticated user.
 * Body: { status: ApplicationStatus, notes?: string }
 */
applicationRoutes.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { status, notes } = req.body as {
    status: Parameters<typeof applicationRepo.updateStatus>[1];
    notes?: string;
  };

  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const existing = await applicationRepo.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  if (existing.userId !== userId) {
    logAuditEvent('unauthorized_access_attempt', { userId, resource: `PATCH /api/applications/${req.params.id}/status`, success: false, ip: req.ip, details: { reason: 'forbidden_application_update' } });
    res.status(403).json({ error: 'Forbidden: you may only update your own applications' });
    return;
  }

  const updated = await applicationRepo.updateStatus(req.params.id, status, notes);
  logAuditEvent('application_status_updated', { userId, resource: `PATCH /api/applications/${req.params.id}/status`, success: true, ip: req.ip, details: { applicationId: req.params.id, status } });
  res.json(updated);
});
