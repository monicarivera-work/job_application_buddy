export type ResumeSectionType =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'custom';

export interface ResumeSectionStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  content: string;
  order: number;
  style?: ResumeSectionStyle;
}

export interface ParsedResume {
  userId: string;
  sections: ResumeSection[];
  fileUrl?: string;
  fileName?: string;
  updatedAt: Date;
}
