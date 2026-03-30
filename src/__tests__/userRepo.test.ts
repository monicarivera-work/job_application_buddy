import { userRepo } from '../adapters/persistence/userRepo';
import { UserProfile } from '../domain/userProfile';

const profile: UserProfile = {
  id: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  resumeText: 'Resume content',
  preferences: {
    desiredTitles: ['Engineer'],
    locations: ['Remote'],
    remoteOnly: true,
  },
};

describe('userRepo', () => {
  it('upserts and retrieves a profile', async () => {
    const saved = await userRepo.upsert(profile);
    expect(saved).toEqual(profile);

    const found = await userRepo.findById(profile.id);
    expect(found).toEqual(profile);
  });

  it('returns null for an unknown id', async () => {
    const found = await userRepo.findById('non-existent');
    expect(found).toBeNull();
  });

  it('overwrites an existing profile on upsert', async () => {
    const updated = { ...profile, name: 'Updated Name' };
    await userRepo.upsert(updated);
    const found = await userRepo.findById(profile.id);
    expect(found?.name).toBe('Updated Name');
  });

  it('lists all stored profiles', async () => {
    const all = await userRepo.list();
    expect(all.some(p => p.id === profile.id)).toBe(true);
  });

  it('deletes a profile', async () => {
    const deleted = await userRepo.delete(profile.id);
    expect(deleted).toBe(true);
    const found = await userRepo.findById(profile.id);
    expect(found).toBeNull();
  });
});
