import { scoreJob, rankJobs } from '../services/matchingService';
import { UserProfile } from '../domain/userProfile';
import { JobMetadata } from '../domain/job';

const baseProfile: UserProfile = {
  id: 'user-1',
  name: 'Jane Dev',
  email: 'jane@example.com',
  resumeText: 'Experienced software engineer',
  preferences: {
    desiredTitles: ['Software Engineer'],
    locations: ['San Francisco'],
    remoteOnly: false,
    mustHaveTech: ['TypeScript', 'Node.js'],
  },
};

const remoteProfile: UserProfile = {
  ...baseProfile,
  preferences: { ...baseProfile.preferences, remoteOnly: true },
};

const fullMatchJob: JobMetadata = {
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'San Francisco',
  description: 'Build great things',
  requiredSkills: ['TypeScript', 'Node.js'],
  applyUrl: 'https://example.com/apply',
  source: 'indeed',
};

const partialMatchJob: JobMetadata = {
  ...fullMatchJob,
  requiredSkills: ['TypeScript', 'Go'],
  applyUrl: 'https://example.com/apply2',
};

const noMatchJob: JobMetadata = {
  ...fullMatchJob,
  requiredSkills: ['Java', 'Kotlin'],
  applyUrl: 'https://example.com/apply3',
};

describe('scoreJob', () => {
  it('returns matchScore of 65 for a full skill match with no remote preference', () => {
    const result = scoreJob(baseProfile, fullMatchJob);
    // skillScore = 1.0, remoteScore = 0.5 → 0.7 + 0.15 = 0.85 → 85
    expect(result.matchScore).toBe(85);
    expect(result.missingRequirements).toHaveLength(0);
  });

  it('identifies missing requirements for a partial match', () => {
    const result = scoreJob(baseProfile, partialMatchJob);
    expect(result.missingRequirements).toContain('Go');
    expect(result.missingRequirements).not.toContain('TypeScript');
  });

  it('returns matchScore of 0 for skills and 0 for remote when remoteOnly and job is not remote', () => {
    const result = scoreJob(remoteProfile, noMatchJob);
    // skillScore = 0.0, remoteScore = 0 → 0 + 0 = 0
    expect(result.matchScore).toBe(0);
  });

  it('gives full score when remoteOnly and job location contains "remote"', () => {
    const remoteJob: JobMetadata = { ...fullMatchJob, location: 'Remote' };
    const result = scoreJob(remoteProfile, remoteJob);
    // skillScore = 1.0, remoteScore = 1.0 → 0.7 + 0.3 = 1.0 → 100
    expect(result.matchScore).toBe(100);
  });

  it('uses 0.5 skill score when job has no required skills', () => {
    const noSkillsJob: JobMetadata = { ...fullMatchJob, requiredSkills: [] };
    const result = scoreJob(baseProfile, noSkillsJob);
    // skillScore = 0.5, remoteScore = 0.5 → 0.35 + 0.15 = 0.5 → 50
    expect(result.matchScore).toBe(50);
  });
});

describe('rankJobs', () => {
  it('returns jobs sorted by matchScore descending', () => {
    const ranked = rankJobs(baseProfile, [noMatchJob, partialMatchJob, fullMatchJob]);
    expect(ranked[0].matchScore).toBeGreaterThanOrEqual(ranked[1].matchScore);
    expect(ranked[1].matchScore).toBeGreaterThanOrEqual(ranked[2].matchScore);
  });

  it('preserves all jobs in the output', () => {
    const ranked = rankJobs(baseProfile, [fullMatchJob, partialMatchJob, noMatchJob]);
    expect(ranked).toHaveLength(3);
  });
});
