import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../../config';
import { authRepo } from '../../persistence/authRepo';
import { userRepo } from '../../persistence/userRepo';
import { applicationRepo } from '../../persistence/applicationRepo';
import { azureBlobStorage } from '../../storage/azureBlobStorage';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { logAuditEvent } from '../../../services/auditLogger';

const router = Router();

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are accepted'));
    }
  },
});

/** POST /api/auth/register */
router.post('/register', upload.single('resume'), async (req: Request, res: Response) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  const ip = req.ip;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = await authRepo.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();

  let resumeFileUrl: string | undefined;
  if (req.file && config.azureStorageConnectionString) {
    const ext = MIME_TO_EXT[req.file.mimetype] ?? 'bin';
    const blobName = `resumes/${id}.${ext}`;
    try {
      resumeFileUrl = await azureBlobStorage.upload(blobName, req.file.buffer, req.file.mimetype);
      logAuditEvent('resume_uploaded', { userId: id, resource: 'POST /api/auth/register', success: true, ip });
    } catch (err) {
      console.error('Azure blob upload failed:', err);
      logAuditEvent('resume_uploaded', { userId: id, resource: 'POST /api/auth/register', success: false, ip, details: { error: 'blob_upload_failed' } });
      res.status(500).json({ error: 'Failed to upload resume file' });
      return;
    }
  }

  const creds = await authRepo.create({
    id,
    email,
    passwordHash,
    name,
    resumeFileUrl,
    createdAt: new Date(),
  });

  logAuditEvent('user_registered', { userId: creds.id, resource: 'POST /api/auth/register', success: true, ip });

  const token = jwt.sign({ sub: creds.id, email: creds.email }, config.jwtSecret, {
    expiresIn: '7d',
  });

  res.status(201).json({ token, userId: creds.id, name: creds.name, resumeFileUrl });
});

/** POST /api/auth/login */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip = req.ip;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const creds = await authRepo.findByEmail(email);
  if (!creds) {
    logAuditEvent('user_login_failed', { resource: 'POST /api/auth/login', success: false, ip, details: { reason: 'account_not_found' } });
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, creds.passwordHash);
  if (!valid) {
    logAuditEvent('user_login_failed', { userId: creds.id, resource: 'POST /api/auth/login', success: false, ip, details: { reason: 'wrong_password' } });
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  logAuditEvent('user_login_success', { userId: creds.id, resource: 'POST /api/auth/login', success: true, ip });

  const token = jwt.sign({ sub: creds.id, email: creds.email }, config.jwtSecret, {
    expiresIn: '7d',
  });

  res.json({ token, userId: creds.id, name: creds.name, resumeFileUrl: creds.resumeFileUrl });
});

/**
 * GET /api/auth/me/data
 * GDPR Article 15 & 20 – Right of access and data portability.
 * Returns a complete export of all personal data held for the authenticated user.
 */
router.get('/me/data', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const ip = req.ip;

  const [creds, profile, applications] = await Promise.all([
    authRepo.findById(userId),
    userRepo.findById(userId),
    applicationRepo.listByUser(userId),
  ]);

  if (!creds) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  logAuditEvent('user_data_exported', { userId, resource: 'GET /api/auth/me/data', success: true, ip });

  // Return all personal data – password hash is intentionally excluded from the export.
  res.json({
    account: {
      id: creds.id,
      email: creds.email,
      name: creds.name,
      resumeFileUrl: creds.resumeFileUrl,
      createdAt: creds.createdAt,
    },
    profile: profile ?? null,
    applications,
  });
});

/**
 * DELETE /api/auth/account
 * GDPR Article 17 – Right to erasure ("right to be forgotten").
 * Permanently deletes all personal data associated with the authenticated user.
 */
router.delete('/account', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const ip = req.ip;

  const [authDeleted, profileDeleted, appsDeleted] = await Promise.all([
    authRepo.delete(userId),
    userRepo.delete(userId),
    applicationRepo.deleteByUser(userId),
  ]);

  if (!authDeleted) {
    logAuditEvent('user_account_deleted', { userId, resource: 'DELETE /api/auth/account', success: false, ip, details: { reason: 'user_not_found' } });
    res.status(404).json({ error: 'User not found' });
    return;
  }

  logAuditEvent('user_account_deleted', {
    userId,
    resource: 'DELETE /api/auth/account',
    success: true,
    ip,
    details: { profileDeleted, applicationsDeleted: appsDeleted },
  });

  res.json({ message: 'Your account and all associated data have been permanently deleted.' });
});

export { router as authRoutes };
