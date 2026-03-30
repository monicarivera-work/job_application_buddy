import { JobMetadata } from '../../../domain/job';
import { UserProfile } from '../../../domain/userProfile';

/**
 * Stub: fetches jobs from a generic RSS feed (e.g., company career pages, job boards).
 * Replace feedUrl with actual RSS endpoints and add XML parsing logic.
 */
export async function searchGenericRss(
  profile: UserProfile,
  feedUrl: string
): Promise<JobMetadata[]> {
  const title = profile.preferences.desiredTitles[0] ?? 'Software Engineer';
  // TODO: fetch and parse the RSS/Atom feed at feedUrl
  return [
    {
      title,
      company: 'RSS Feed Company',
      location: profile.preferences.remoteOnly ? 'Remote' : profile.preferences.locations[0] ?? 'USA',
      description: `${title} position sourced from ${feedUrl}.`,
      requiredSkills: [],
      applyUrl: feedUrl,
      source: 'rss',
    },
  ];
}
