export interface JobMetadata {
  title: string;
  company: string;
  location: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
  benefits?: string[];
  description: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  applyUrl: string;
  source: string;
}

export interface MatchedJob extends JobMetadata {
  matchScore: number;
  missingRequirements: string[];
}
