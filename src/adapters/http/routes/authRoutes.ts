import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../../config';
import { authRepo } from '../../persistence/authRepo';
import { azureBlobStorage } from '../../storage/azureBlobStorage';

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
    } catch (err) {
      console.error('Azure blob upload failed:', err);
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

  const token = jwt.sign({ sub: creds.id, email: creds.email }, config.jwtSecret, {
    expiresIn: '7d',
  });

  res.status(201).json({ token, userId: creds.id, name: creds.name, resumeFileUrl });
});

/** POST /api/auth/login */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const creds = await authRepo.findByEmail(email);
  if (!creds) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, creds.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign({ sub: creds.id, email: creds.email }, config.jwtSecret, {
    expiresIn: '7d',
  });

  res.json({ token, userId: creds.id, name: creds.name, resumeFileUrl: creds.resumeFileUrl });
});

export { router as authRoutes };
