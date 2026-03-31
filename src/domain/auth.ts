export interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  resumeFileUrl?: string;
  createdAt: Date;
}
