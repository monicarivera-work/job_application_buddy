import { authRepo } from '../adapters/persistence/authRepo';
import { userRepo } from '../adapters/persistence/userRepo';
import { applicationRepo } from '../adapters/persistence/applicationRepo';
import { UserCredentials } from '../domain/auth';
import { UserProfile } from '../domain/userProfile';

const testCreds: UserCredentials = {
  id: 'gdpr-user-1',
  email: 'gdpr@example.com',
  passwordHash: '$2a$10$abc',
  name: 'GDPR User',
  createdAt: new Date('2024-01-01'),
};

const testProfile: UserProfile = {
  id: 'gdpr-user-1',
  name: 'GDPR User',
  email: 'gdpr@example.com',
  resumeText: 'Resume content',
  preferences: {
    desiredTitles: ['Engineer'],
    locations: ['Remote'],
    remoteOnly: true,
  },
};

describe('GDPR – authRepo.delete', () => {
  it('deletes an existing user credential and returns true', async () => {
    await authRepo.create(testCreds);
    const deleted = await authRepo.delete(testCreds.id);
    expect(deleted).toBe(true);

    const found = await authRepo.findById(testCreds.id);
    expect(found).toBeNull();
  });

  it('returns false when trying to delete a non-existent user', async () => {
    const deleted = await authRepo.delete('non-existent-gdpr-user');
    expect(deleted).toBe(false);
  });
});

describe('GDPR – applicationRepo.deleteByUser', () => {
  it('deletes all applications for a user and returns the count', async () => {
    const userId = 'gdpr-app-user';
    await applicationRepo.logSubmission({ userId, jobTitle: 'Engineer', company: 'Acme', applyUrl: 'https://acme.com/jobs/1', appliedAt: new Date(), status: 'submitted' });
    await applicationRepo.logSubmission({ userId, jobTitle: 'Developer', company: 'Beta', applyUrl: 'https://beta.com/jobs/2', appliedAt: new Date(), status: 'pending' });

    const count = await applicationRepo.deleteByUser(userId);
    expect(count).toBeGreaterThanOrEqual(2);

    const remaining = await applicationRepo.listByUser(userId);
    expect(remaining).toHaveLength(0);
  });

  it('returns 0 when the user has no applications', async () => {
    const count = await applicationRepo.deleteByUser('no-apps-user');
    expect(count).toBe(0);
  });
});

describe('GDPR – full erasure (authRepo + userRepo + applicationRepo)', () => {
  it('removes all data associated with a user across repos', async () => {
    const userId = 'gdpr-full-erase-user';
    const creds: UserCredentials = { ...testCreds, id: userId, email: 'erase@example.com' };
    const profile: UserProfile = { ...testProfile, id: userId, email: 'erase@example.com' };

    await authRepo.create(creds);
    await userRepo.upsert(profile);
    await applicationRepo.logSubmission({ userId, jobTitle: 'Engineer', company: 'Acme', applyUrl: 'https://acme.com/jobs/1', appliedAt: new Date(), status: 'submitted' });

    // Simulate GDPR erasure
    const [authDeleted, profileDeleted, appsDeleted] = await Promise.all([
      authRepo.delete(userId),
      userRepo.delete(userId),
      applicationRepo.deleteByUser(userId),
    ]);

    expect(authDeleted).toBe(true);
    expect(profileDeleted).toBe(true);
    expect(appsDeleted).toBeGreaterThanOrEqual(1);

    expect(await authRepo.findById(userId)).toBeNull();
    expect(await userRepo.findById(userId)).toBeNull();
    expect(await applicationRepo.listByUser(userId)).toHaveLength(0);
  });
});
