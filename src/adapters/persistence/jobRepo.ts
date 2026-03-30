import { JobMetadata } from '../../domain/job';
import { v4 as uuidv4 } from 'uuid';

interface StoredJob extends JobMetadata {
  id: string;
}

/**
 * In-memory job repository.
 * Replace with a real DB implementation (Prisma / Knex / etc.) when ready.
 */
const store = new Map<string, StoredJob>();

export const jobRepo = {
  async save(job: JobMetadata): Promise<StoredJob> {
    const stored: StoredJob = { id: uuidv4(), ...job };
    store.set(stored.id, stored);
    return stored;
  },

  async findById(id: string): Promise<StoredJob | null> {
    return store.get(id) ?? null;
  },

  async list(): Promise<StoredJob[]> {
    return Array.from(store.values());
  },

  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  },
};
