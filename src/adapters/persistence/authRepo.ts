import { UserCredentials } from '../../domain/auth';

const store = new Map<string, UserCredentials>();

export const authRepo = {
  async create(creds: UserCredentials): Promise<UserCredentials> {
    store.set(creds.id, creds);
    return creds;
  },

  async findByEmail(email: string): Promise<UserCredentials | null> {
    for (const creds of store.values()) {
      if (creds.email.toLowerCase() === email.toLowerCase()) {
        return creds;
      }
    }
    return null;
  },

  async findById(id: string): Promise<UserCredentials | null> {
    return store.get(id) ?? null;
  },

  async updateResumeUrl(id: string, url: string): Promise<void> {
    const creds = store.get(id);
    if (creds) {
      creds.resumeFileUrl = url;
    }
  },
};
