import { Router, Request, Response } from 'express';
import { profileService } from '../../../services/profileService';
import { UserProfile } from '../../../domain/userProfile';
import { logAuditEvent } from '../../../services/auditLogger';
import { AuthRequest } from '../middleware/authMiddleware';

export const profileRoutes = Router();

/**
 * GET /api/profile/:id
 * Returns the stored profile for the given user ID.
 */
profileRoutes.get('/:id', async (req: AuthRequest, res: Response) => {
  const profile = await profileService.getProfile(req.params.id);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  logAuditEvent('profile_accessed', { userId: req.userId, resource: `GET /api/profile/${req.params.id}`, success: true, ip: req.ip });
  res.json(profile);
});

/**
 * POST /api/profile
 * Creates or updates a user profile.
 * Body: UserProfile JSON
 */
profileRoutes.post('/', async (req: AuthRequest, res: Response) => {
  const body = req.body as UserProfile;
  if (!body.id?.trim() || !body.name?.trim() || !body.email?.trim()) {
    res.status(400).json({ error: 'id, name, and email are required and must be non-empty' });
    return;
  }
  const saved = await profileService.upsertProfile(body);
  logAuditEvent('profile_updated', { userId: req.userId, resource: 'POST /api/profile', success: true, ip: req.ip, details: { profileId: body.id } });
  res.status(201).json(saved);
});
