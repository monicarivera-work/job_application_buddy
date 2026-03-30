import { JobMetadata } from '../../../domain/job';
import { UserProfile } from '../../../domain/userProfile';

/**
 * Stub: searches LinkedIn for jobs matching the user profile.
 * Replace with real API/scraping logic once credentials are available.
 */
export async function searchLinkedIn(profile: UserProfile): Promise<JobMetadata[]> {
  const title = profile.preferences.desiredTitles[0] ?? 'Software Engineer';
  return [
    {
      title,
      company: 'LinkedIn Example Co.',
      location: profile.preferences.remoteOnly ? 'Remote' : profile.preferences.locations[0] ?? 'USA',
      description: `Exciting ${title} role at a fast-growing company.`,
      requiredSkills: profile.preferences.mustHaveTech ?? [],
      applyUrl: 'https://www.linkedin.com/jobs/view/example',
      source: 'linkedin',
    },
  ];
}
