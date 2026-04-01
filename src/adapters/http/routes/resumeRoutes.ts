import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../../config';
import { azureBlobStorage } from '../../storage/azureBlobStorage';
import { resumeRepo } from '../../persistence/resumeRepo';
import { parseResumeText } from '../../../services/resumeParseService';
import { generateDocx, generatePdf } from '../../../services/resumeDownloadService';
import { AuthRequest } from '../middleware/authMiddleware';
import { logAuditEvent } from '../../../services/auditLogger';
import { ResumeSection, ResumeSectionStyle, ResumeSectionType } from '../../../domain/resume';

export const resumeRoutes = Router();

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (Object.keys(MIME_TO_EXT).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are accepted'));
    }
  },
});

/**
 * Extracts plain text from an uploaded file buffer.
 * Falls back to UTF-8 text for txt files; uses pdf-parse / mammoth for others.
 */
async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }
  if (mimetype === 'application/pdf') {
    // Dynamically require to avoid bundler issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as {
      extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return buffer.toString('utf-8');
}

/**
 * POST /api/resume/upload
 * Uploads a resume file to Azure Blob Storage (if configured),
 * extracts text, parses it into sections, and stores the result.
 */
resumeRoutes.post('/upload', upload.single('resume'), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!req.file) {
    res.status(400).json({ error: 'A resume file is required' });
    return;
  }

  let fileUrl: string | undefined;
  const ext = MIME_TO_EXT[req.file.mimetype] ?? 'bin';
  const blobName = `resumes/${userId}.${ext}`;

  if (config.azureStorageConnectionString) {
    try {
      fileUrl = await azureBlobStorage.upload(blobName, req.file.buffer, req.file.mimetype);
      logAuditEvent('resume_uploaded', { userId, resource: 'POST /api/resume/upload', success: true, ip: req.ip });
    } catch (err) {
      console.error('Azure blob upload failed:', err);
      logAuditEvent('resume_uploaded', { userId, resource: 'POST /api/resume/upload', success: false, ip: req.ip, details: { error: 'blob_upload_failed' } });
      res.status(500).json({ error: 'Failed to upload resume file to storage' });
      return;
    }
  }

  let text: string;
  try {
    text = await extractText(req.file.buffer, req.file.mimetype);
  } catch (err) {
    console.error('Resume text extraction failed:', err);
    res.status(422).json({ error: 'Could not extract text from the uploaded file' });
    return;
  }

  const sections = parseResumeText(text);
  const parsedResume = await resumeRepo.upsert({
    userId,
    sections,
    fileUrl,
    fileName: req.file.originalname,
    updatedAt: new Date(),
  });

  res.status(201).json(parsedResume);
});

/**
 * GET /api/resume
 * Returns the parsed resume for the authenticated user.
 */
resumeRoutes.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
    return;
  }
  res.json(resume);
});

/**
 * POST /api/resume/sections
 * Adds a new section to the user's parsed resume.
 * Body: { type, title, content, style?, order? }
 */
resumeRoutes.post('/sections', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
    return;
  }

  const { type, title, content, style, order } = req.body as {
    type?: ResumeSectionType;
    title?: string;
    content?: string;
    style?: ResumeSectionStyle;
    order?: number;
  };

  if (!title?.trim() || content === undefined) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }

  const maxOrder = resume.sections.reduce((m, s) => Math.max(m, s.order), -1);
  const newSection: ResumeSection = {
    id: uuidv4(),
    type: type ?? 'custom',
    title: title.trim(),
    content,
    order: order ?? maxOrder + 1,
    style,
  };

  resume.sections.push(newSection);
  resume.updatedAt = new Date();
  await resumeRepo.upsert(resume);

  res.status(201).json(newSection);
});

/**
 * PUT /api/resume/sections/:sectionId
 * Updates a single section.
 * Body: partial section fields (title, content, style, order, type)
 */
resumeRoutes.put('/sections/:sectionId', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { sectionId } = req.params;
  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found' });
    return;
  }

  const idx = resume.sections.findIndex(s => s.id === sectionId);
  if (idx === -1) {
    res.status(404).json({ error: 'Section not found' });
    return;
  }

  const updates = req.body as Partial<ResumeSection>;
  resume.sections[idx] = { ...resume.sections[idx], ...updates, id: sectionId };
  resume.updatedAt = new Date();
  await resumeRepo.upsert(resume);

  res.json(resume.sections[idx]);
});

/**
 * PUT /api/resume/sections
 * Replaces all sections (used for reordering via drag-and-drop).
 * Body: { sections: ResumeSection[] }
 */
resumeRoutes.put('/sections', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found' });
    return;
  }

  const { sections } = req.body as { sections: ResumeSection[] };
  if (!Array.isArray(sections)) {
    res.status(400).json({ error: 'sections must be an array' });
    return;
  }

  resume.sections = sections;
  resume.updatedAt = new Date();
  await resumeRepo.upsert(resume);

  res.json(resume);
});

/**
 * DELETE /api/resume/sections/:sectionId
 * Deletes a section from the resume.
 */
resumeRoutes.delete('/sections/:sectionId', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { sectionId } = req.params;
  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found' });
    return;
  }

  const before = resume.sections.length;
  resume.sections = resume.sections.filter(s => s.id !== sectionId);
  if (resume.sections.length === before) {
    res.status(404).json({ error: 'Section not found' });
    return;
  }

  resume.updatedAt = new Date();
  await resumeRepo.upsert(resume);

  res.json({ message: 'Section deleted' });
});

/**
 * POST /api/resume/ai-review
 * Runs a Claude AI review of the resume (requires ANTHROPIC_API_KEY env var).
 * Returns structured feedback per section.
 */
resumeRoutes.post('/ai-review', async (req: AuthRequest, res: Response) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'AI review is not configured. Set the ANTHROPIC_API_KEY environment variable to enable it.' });
    return;
  }

  const userId = req.userId!;
  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
    return;
  }

  const sortedSections = [...resume.sections].sort((a, b) => a.order - b.order);
  const resumeText = sortedSections
    .map(s => `## ${s.title}\n${s.content}`)
    .join('\n\n');

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are an expert resume reviewer for software engineering roles. 
Review the following resume and provide concise, actionable feedback for each section.
Return a JSON array of objects with the fields: sectionTitle (string), score (1-10), feedback (string), suggestions (string[]).

Resume:
${resumeText}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      res.status(502).json({ error: 'Unexpected AI response format' });
      return;
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      res.json({ raw: content.text });
      return;
    }

    const review = JSON.parse(jsonMatch[0]);
    res.json({ review });
  } catch (err) {
    console.error('AI review error:', err);
    res.status(502).json({ error: 'AI review failed. Please try again.' });
  }
});

/**
 * POST /api/resume/download
 * Generates and streams a downloadable resume in the requested format.
 * Body: { format: 'docx' | 'pdf' }
 */
resumeRoutes.post('/download', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { format } = req.body as { format?: string };

  if (format !== 'docx' && format !== 'pdf') {
    res.status(400).json({ error: 'format must be "docx" or "pdf"' });
    return;
  }

  const resume = await resumeRepo.findByUserId(userId);
  if (!resume) {
    res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
    return;
  }

  try {
    if (format === 'docx') {
      const buffer = await generateDocx(resume);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.docx"');
      res.send(buffer);
    } else {
      const buffer = await generatePdf(resume);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.send(buffer);
    }
  } catch (err) {
    console.error('Resume download generation failed:', err);
    res.status(500).json({ error: 'Failed to generate resume file' });
  }
});
