import { ApplicationRecord } from '../../domain/application';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory application repository.
 * Replace with a real DB implementation (Prisma / Knex / etc.) when ready.
 */
const store = new Map<string, ApplicationRecord>();

export const applicationRepo = {
  async logSubmission(record: Omit<ApplicationRecord, 'id'>): Promise<ApplicationRecord> {
    const stored: ApplicationRecord = { id: uuidv4(), ...record };
    store.set(stored.id!, stored);
    return stored;
  },

  async findById(id: string): Promise<ApplicationRecord | null> {
    return store.get(id) ?? null;
  },

  async listByUser(userId: string): Promise<ApplicationRecord[]> {
    return Array.from(store.values()).filter(r => r.userId === userId);
  },

  async updateStatus(
    id: string,
    status: ApplicationRecord['status'],
    notes?: string
  ): Promise<ApplicationRecord | null> {
    const record = store.get(id);
    if (!record) return null;
    record.status = status;
    if (notes !== undefined) record.notes = notes;
    return record;
  },

  async deleteByUser(userId: string): Promise<number> {
    let count = 0;
    for (const [id, record] of store.entries()) {
      if (record.userId === userId) {
        store.delete(id);
        count++;
      }
    }
    return count;
  },
};
