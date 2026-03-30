import { Router, Request, Response } from 'express';
import { profileService } from '../../../services/profileService';
import { discoverJobsForProfile } from '../../../services/jobDiscoveryService';
import { rankJobs } from '../../../services/matchingService';

export const jobRoutes = Router();

/**
 * GET /api/jobs?userId=<id>
 * Discovers and returns jobs ranked by match score for the given user.
 */
jobRoutes.get('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: 'userId query parameter is required' });
    return;
  }

  const profile = await profileService.getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const jobs = await discoverJobsForProfile(profile);
  const ranked = rankJobs(profile, jobs);
  res.json(ranked);
});
