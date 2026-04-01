import { ParsedResume } from '../../domain/resume';

const store = new Map<string, ParsedResume>();

export const resumeRepo = {
  async upsert(resume: ParsedResume): Promise<ParsedResume> {
    store.set(resume.userId, { ...resume });
    return resume;
  },

  async findByUserId(userId: string): Promise<ParsedResume | null> {
    return store.get(userId) ?? null;
  },

  async delete(userId: string): Promise<boolean> {
    return store.delete(userId);
  },
};
