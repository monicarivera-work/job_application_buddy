import { JobMetadata } from '../../domain/job';
import { UserProfile } from '../../domain/userProfile';
import { searchLinkedIn } from './sources/linkedinSource';
import { searchIndeed } from './sources/indeedSource';

/**
 * Aggregates job listings from all configured sources, de-duplicates by applyUrl,
 * and returns a normalized list of JobMetadata.
 */
export async function discoverJobsForProfile(profile: UserProfile): Promise<JobMetadata[]> {
  const [linkedinJobs, indeedJobs] = await Promise.all([
    searchLinkedIn(profile),
    searchIndeed(profile),
  ]);

  const all = [...linkedinJobs, ...indeedJobs];

  // De-duplicate by applyUrl
  const seen = new Set<string>();
  const unique: JobMetadata[] = [];
  for (const job of all) {
    if (!seen.has(job.applyUrl)) {
      seen.add(job.applyUrl);
      unique.push(job);
    }
  }

  return unique;
}
