export type ApplicationStatus =
  | 'pending'
  | 'submitted'
  | 'rejected'
  | 'interview'
  | 'offer'
  | 'withdrawn';

export interface ApplicationRecord {
  id?: string;
  userId: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
  appliedAt: Date;
  status: ApplicationStatus;
  notes?: string;
}
