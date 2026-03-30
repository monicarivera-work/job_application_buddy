import { JobMetadata } from '../../../domain/job';
import { UserProfile } from '../../../domain/userProfile';

/**
 * Stub: searches Indeed for jobs matching the user profile.
 * Replace with real API/scraping logic once credentials are available.
 */
export async function searchIndeed(profile: UserProfile): Promise<JobMetadata[]> {
  const title = profile.preferences.desiredTitles[0] ?? 'Software Engineer';
  return [
    {
      title,
      company: 'Indeed Example Inc.',
      location: profile.preferences.remoteOnly ? 'Remote' : profile.preferences.locations[0] ?? 'USA',
      description: `Join our team as a ${title}. Great benefits and remote-friendly culture.`,
      requiredSkills: profile.preferences.mustHaveTech ?? [],
      preferredSkills: [],
      applyUrl: 'https://www.indeed.com/viewjob?jk=example',
      source: 'indeed',
    },
  ];
}
