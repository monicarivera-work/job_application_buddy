import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { discoverJobs, createApplication, getApplications, updateApplicationStatus, getUserProfile, upsertUserProfile } from '../services/jobService';
import { ApplicationStatus } from '@prisma/client';

const router = Router();

// All job routes require authentication
router.use(authenticateToken);

router.get('/jobs', async (req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await discoverJobs(req.user!.userId);
    res.json(jobs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch jobs';
    res.status(500).json({ error: message });
  }
});

router.get('/applications', async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await getApplications(req.user!.userId);
    res.json(applications);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch applications';
    res.status(500).json({ error: message });
  }
});

router.post('/applications', async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId, coverLetter, notes } = req.body;
    if (!jobId) {
      res.status(400).json({ error: 'jobId is required' });
      return;
    }
    const application = await createApplication(req.user!.userId, jobId, { coverLetter, notes });
    res.status(201).json(application);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create application';
    res.status(500).json({ error: message });
  }
});

router.patch('/applications/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!Object.values(ApplicationStatus).includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const application = await updateApplicationStatus(req.user!.userId, id, status);
    res.json(application);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update application';
    res.status(500).json({ error: message });
  }
});

router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await getUserProfile(req.user!.userId);
    res.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile';
    res.status(500).json({ error: message });
  }
});

router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const { headline, skills, resumeUrl, preferences } = req.body;
    const profile = await upsertUserProfile(req.user!.userId, { headline, skills, resumeUrl, preferences });
    res.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    res.status(500).json({ error: message });
  }
});

export default router;
