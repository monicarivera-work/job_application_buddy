import { discoverJobsForProfile } from '../services/jobDiscoveryService';
import { UserProfile } from '../domain/userProfile';

const profile: UserProfile = {
  id: 'user-1',
  name: 'Dev User',
  email: 'dev@example.com',
  resumeText: 'Full-stack developer',
  preferences: {
    desiredTitles: ['Full Stack Engineer'],
    locations: ['Austin, TX'],
    remoteOnly: false,
    mustHaveTech: ['React', 'Node.js'],
  },
};

describe('discoverJobsForProfile', () => {
  it('returns jobs from all sources', async () => {
    const jobs = await discoverJobsForProfile(profile);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('returns unique jobs (no duplicate applyUrls)', async () => {
    const jobs = await discoverJobsForProfile(profile);
    const urls = jobs.map(j => j.applyUrl);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  it('all returned jobs have required fields', async () => {
    const jobs = await discoverJobsForProfile(profile);
    for (const job of jobs) {
      expect(job.title).toBeTruthy();
      expect(job.company).toBeTruthy();
      expect(job.applyUrl).toBeTruthy();
      expect(job.source).toBeTruthy();
    }
  });
});
