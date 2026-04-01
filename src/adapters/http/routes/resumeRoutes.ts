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
import { trackException, trackEvent, trackTrace } from '../../../services/telemetry';
import { ResumeSection, ResumeSectionStyle, ResumeSectionType } from '../../../domain/resume';
import {
  ResumeUploadError,
  ResumeExtractionError,
  ResumeNotFoundError,
  ResumeGenerationError,
  ResumeInvalidFormatError,
  AiServiceUnavailableError,
  AiResponseInvalidError,
  ValidationError,
  ErrorSeverity,
} from '../../../errors/AppError';

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
 * Supports .txt, .pdf (via pdf-parse) and .doc/.docx (via mammoth).
 * Throws ResumeExtractionError if parsing fails.
 */
async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  try {
    if (mimetype === 'text/plain') {
      return buffer.toString('utf-8');
    }
    if (mimetype === 'application/pdf') {
      // Dynamically require to avoid bundler issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      if (!result.text?.trim()) {
        throw new ResumeExtractionError('PDF file appears to contain no extractable text (may be image-only)');
      }
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
      if (!result.value?.trim()) {
        throw new ResumeExtractionError('Word document appears to contain no extractable text');
      }
      return result.value;
    }
    return buffer.toString('utf-8');
  } catch (err) {
    // Re-throw AppErrors unchanged; wrap native errors
    if (err instanceof ResumeExtractionError) throw err;
    throw new ResumeExtractionError(
      'Could not extract text from the uploaded file',
      { mimetype, cause: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * POST /api/resume/upload
 * Uploads a resume file to Azure Blob Storage (if configured),
 * extracts text, parses it into sections, and stores the result.
 */
resumeRoutes.post('/upload', upload.single('resume'), async (req: AuthRequest, res: Response, next) => {
  const userId = req.userId!;
  if (!req.file) {
    res.status(400).json({ error: 'A resume file is required' });
    return;
  }

  const mimetype = req.file.mimetype;
  if (!Object.keys(MIME_TO_EXT).includes(mimetype)) {
    const err = new ResumeInvalidFormatError(
      'Only PDF, DOC, DOCX, and TXT files are accepted',
      { mimetype },
    );
    trackException(err, userId, { resource: 'POST /api/resume/upload' });
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  let fileUrl: string | undefined;
  const ext = MIME_TO_EXT[mimetype] ?? 'bin';
  const blobName = `resumes/${userId}.${ext}`;

  if (config.azureStorageConnectionString) {
    try {
      fileUrl = await azureBlobStorage.upload(blobName, req.file.buffer, mimetype);
      logAuditEvent('resume_uploaded', { userId, resource: 'POST /api/resume/upload', success: true, ip: req.ip });
      trackEvent('resume_blob_upload_success', { userId, ext });
    } catch (err) {
      const uploadErr = new ResumeUploadError('Failed to upload resume file to storage', {
        blobName,
        cause: err instanceof Error ? err.message : String(err),
      });
      trackException(uploadErr, userId, { resource: 'POST /api/resume/upload' });
      logAuditEvent('resume_uploaded', { userId, resource: 'POST /api/resume/upload', success: false, ip: req.ip, details: { error: 'blob_upload_failed' } });
      next(uploadErr);
      return;
    }
  }

  let text: string;
  try {
    text = await extractText(req.file.buffer, mimetype);
    trackTrace(`Resume text extracted successfully for user ${userId}`, ErrorSeverity.Verbose, { ext });
  } catch (err) {
    trackException(err, userId, { resource: 'POST /api/resume/upload', ext });
    next(err);
    return;
  }

  try {
    const sections = parseResumeText(text);
    const parsedResume = await resumeRepo.upsert({
      userId,
      sections,
      fileUrl,
      fileName: req.file.originalname,
      updatedAt: new Date(),
    });
    trackEvent('resume_parsed', { userId, ext, sectionCount: String(sections.length) });
    res.status(201).json(parsedResume);
  } catch (err) {
    trackException(err, userId, { resource: 'POST /api/resume/upload', stage: 'parse_or_persist' });
    next(err);
  }
});

/**
 * GET /api/resume
 * Returns the parsed resume for the authenticated user.
 */
resumeRoutes.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const resume = await resumeRepo.findByUserId(userId);
    if (!resume) {
      res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
      return;
    }
    res.json(resume);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/resume/sections
 * Adds a new section to the user's parsed resume.
 * Body: { type, title, content, style?, order? }
 */
resumeRoutes.post('/sections', async (req: AuthRequest, res: Response, next) => {
  try {
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
      const err = new ValidationError('title and content are required');
      trackException(err, userId, { resource: 'POST /api/resume/sections' });
      res.status(err.statusCode).json({ error: err.message, code: err.code });
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
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/resume/sections/:sectionId
 * Updates a single section.
 * Body: partial section fields (title, content, style, order, type)
 */
resumeRoutes.put('/sections/:sectionId', async (req: AuthRequest, res: Response, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/resume/sections
 * Replaces all sections (used for reordering via drag-and-drop).
 * Body: { sections: ResumeSection[] }
 */
resumeRoutes.put('/sections', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const resume = await resumeRepo.findByUserId(userId);
    if (!resume) {
      res.status(404).json({ error: 'No resume found' });
      return;
    }

    const { sections } = req.body as { sections: ResumeSection[] };
    if (!Array.isArray(sections)) {
      const err = new ValidationError('sections must be an array');
      trackException(err, userId, { resource: 'PUT /api/resume/sections' });
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }

    resume.sections = sections;
    resume.updatedAt = new Date();
    await resumeRepo.upsert(resume);

    res.json(resume);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/resume/sections/:sectionId
 * Deletes a section from the resume.
 */
resumeRoutes.delete('/sections/:sectionId', async (req: AuthRequest, res: Response, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/resume/ai-review
 * Runs a Claude AI review of the resume (requires ANTHROPIC_API_KEY env var).
 * Returns structured feedback per section.
 */
resumeRoutes.post('/ai-review', async (req: AuthRequest, res: Response, next) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new AiServiceUnavailableError(
      'AI review is not configured. Set the ANTHROPIC_API_KEY environment variable to enable it.',
    );
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  const userId = req.userId!;
  try {
    const resume = await resumeRepo.findByUserId(userId);
    if (!resume) {
      res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
      return;
    }

    const sortedSections = [...resume.sections].sort((a, b) => a.order - b.order);
    const resumeText = sortedSections
      .map(s => `## ${s.title}\n${s.content}`)
      .join('\n\n');

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
      const err = new AiResponseInvalidError('Unexpected AI response format');
      trackException(err, userId, { resource: 'POST /api/resume/ai-review' });
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      res.json({ raw: content.text });
      return;
    }

    const review = JSON.parse(jsonMatch[0]);
    trackEvent('resume_ai_review_completed', { userId });
    res.json({ review });
  } catch (err) {
    trackException(err, userId, { resource: 'POST /api/resume/ai-review' });
    next(new AiServiceUnavailableError(
      'AI review failed. Please try again.',
      { cause: err instanceof Error ? err.message : String(err) },
    ));
  }
});

/**
 * POST /api/resume/download
 * Generates and streams a downloadable resume in the requested format.
 * Body: { format: 'docx' | 'pdf' }
 */
resumeRoutes.post('/download', async (req: AuthRequest, res: Response, next) => {
  const userId = req.userId!;
  const { format } = req.body as { format?: string };

  if (format !== 'docx' && format !== 'pdf') {
    const err = new ValidationError('format must be "docx" or "pdf"');
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  try {
    const resume = await resumeRepo.findByUserId(userId);
    if (!resume) {
      res.status(404).json({ error: 'No resume found. Please upload a resume first.' });
      return;
    }

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
    trackEvent('resume_downloaded', { userId, format });
  } catch (err) {
    const genErr = new ResumeGenerationError(
      'Failed to generate resume file',
      { format, cause: err instanceof Error ? err.message : String(err) },
    );
    trackException(genErr, userId, { resource: 'POST /api/resume/download', format });
    next(genErr);
  }
});
