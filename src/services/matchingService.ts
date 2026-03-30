import { JobMetadata, MatchedJob } from '../domain/job';
import { UserProfile } from '../domain/userProfile';

/**
 * Scores a single job against a user profile using skill overlap and remote preference.
 *
 * Scoring breakdown:
 *   - Skill score (70%): fraction of required skills that appear in the user's mustHaveTech list
 *   - Remote score (30%): 1.0 if remoteOnly matches job location, 0.5 when indifferent
 */
export function scoreJob(profile: UserProfile, job: JobMetadata): MatchedJob {
  const skills = profile.preferences.mustHaveTech ?? [];
  const required = job.requiredSkills ?? [];

  const matchedSkills = required.filter(r =>
    skills.some(s => r.toLowerCase().includes(s.toLowerCase()))
  );

  const skillScore = required.length
    ? matchedSkills.length / required.length
    : 0.5;

  const remoteScore =
    profile.preferences.remoteOnly
      ? job.location.toLowerCase().includes('remote') ? 1 : 0
      : 0.5;

  const matchScore = Math.round((skillScore * 0.7 + remoteScore * 0.3) * 100);

  const missingRequirements = required.filter(
    r => !matchedSkills.includes(r)
  );

  return { ...job, matchScore, missingRequirements };
}

/**
 * Scores and ranks a list of jobs for a given profile (highest score first).
 */
export function rankJobs(profile: UserProfile, jobs: JobMetadata[]): MatchedJob[] {
  return jobs.map(j => scoreJob(profile, j)).sort((a, b) => b.matchScore - a.matchScore);
}
