import { v4 as uuidv4 } from 'uuid';
import { ResumeSection, ResumeSectionType } from '../domain/resume';

/**
 * Headers (case-insensitive) that identify each resume section type.
 */
const SECTION_PATTERNS: Array<{ type: ResumeSectionType; patterns: RegExp }> = [
  { type: 'contact',      patterns: /^(contact( information)?|personal( information)?|address|phone|email|linkedin|github|website)/i },
  { type: 'summary',      patterns: /^(summary|professional summary|objective|profile|about me|career objective)/i },
  { type: 'experience',   patterns: /^(experience|work experience|professional experience|employment|employment history|work history|positions held)/i },
  { type: 'education',    patterns: /^(education|academic background|academic history|qualifications|degrees?)/i },
  { type: 'skills',       patterns: /^(skills?|technical skills?|core competencies|competencies|technologies|tech stack|languages?|tools?)/i },
  { type: 'projects',     patterns: /^(projects?|personal projects?|side projects?|portfolio|open[ -]?source)/i },
  { type: 'certifications', patterns: /^(certifications?|certificates?|licenses?|credentials?|accreditations?)/i },
];

/**
 * Parses plain-text resume content into labelled sections.
 */
export function parseResumeText(text: string): ResumeSection[] {
  const lines = text.split('\n');
  const sections: ResumeSection[] = [];
  let currentType: ResumeSectionType | null = null;
  let currentTitle = '';
  let currentLines: string[] = [];
  let order = 0;

  const flush = () => {
    if (!currentTitle && currentLines.every(l => !l.trim())) return;
    const content = currentLines.join('\n').trim();
    if (!content) return;
    sections.push({
      id: uuidv4(),
      type: currentType ?? 'custom',
      title: currentTitle || 'Other',
      content,
      order: order++,
    });
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // Detect section headers: short lines (≤60 chars) that match known patterns
    // OR lines that are ALL-CAPS (common resume section headers)
    const isHeader = trimmed.length > 0 && trimmed.length <= 60 &&
      (SECTION_PATTERNS.some(p => p.patterns.test(trimmed)) ||
       /^[A-Z][A-Z\s\-&/()]+$/.test(trimmed));

    if (isHeader) {
      flush();
      currentTitle = trimmed;
      currentType = SECTION_PATTERNS.find(p => p.patterns.test(trimmed))?.type ?? 'custom';
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  // If nothing parsed into sections, treat the whole text as a summary
  if (sections.length === 0) {
    sections.push({
      id: uuidv4(),
      type: 'summary',
      title: 'Resume',
      content: text.trim(),
      order: 0,
    });
  }

  return sections;
}
