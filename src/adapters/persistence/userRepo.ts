import { UserProfile } from '../../domain/userProfile';

/**
 * In-memory user repository.
 * Replace with a real DB implementation (Prisma / Knex / etc.) when ready.
 */
const store = new Map<string, UserProfile>();

export const userRepo = {
  async upsert(profile: UserProfile): Promise<UserProfile> {
    store.set(profile.id, profile);
    return profile;
  },

  async findById(id: string): Promise<UserProfile | null> {
    return store.get(id) ?? null;
  },

  async list(): Promise<UserProfile[]> {
    return Array.from(store.values());
  },

  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  },
};
