import { applicationRepo } from '../adapters/persistence/applicationRepo';
import { ApplicationRecord } from '../domain/application';

const record: Omit<ApplicationRecord, 'id'> = {
  userId: 'user-42',
  jobTitle: 'Backend Engineer',
  company: 'Widgets Inc.',
  applyUrl: 'https://widgets.inc/jobs/42',
  appliedAt: new Date('2024-01-01'),
  status: 'submitted',
};

describe('applicationRepo', () => {
  it('logs a submission and assigns an id', async () => {
    const saved = await applicationRepo.logSubmission(record);
    expect(saved.id).toBeDefined();
    expect(saved.status).toBe('submitted');
  });

  it('finds a submission by id', async () => {
    const saved = await applicationRepo.logSubmission(record);
    const found = await applicationRepo.findById(saved.id!);
    expect(found).not.toBeNull();
    expect(found?.company).toBe('Widgets Inc.');
  });

  it('returns null for an unknown id', async () => {
    const found = await applicationRepo.findById('non-existent');
    expect(found).toBeNull();
  });

  it('lists applications by userId', async () => {
    const saved = await applicationRepo.logSubmission(record);
    const list = await applicationRepo.listByUser('user-42');
    expect(list.some(r => r.id === saved.id)).toBe(true);
  });

  it('updates application status', async () => {
    const saved = await applicationRepo.logSubmission(record);
    const updated = await applicationRepo.updateStatus(saved.id!, 'interview', 'Phone screen scheduled');
    expect(updated?.status).toBe('interview');
    expect(updated?.notes).toBe('Phone screen scheduled');
  });

  it('returns null when updating a non-existent application', async () => {
    const result = await applicationRepo.updateStatus('ghost-id', 'rejected');
    expect(result).toBeNull();
  });
});
