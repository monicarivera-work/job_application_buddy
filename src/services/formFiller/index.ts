import { playwrightClient } from './playwrightClient';
import { UserProfile } from '../../domain/userProfile';
import { MatchedJob } from '../../domain/job';

interface SubmitParams {
  profile: UserProfile;
  job: MatchedJob;
  coverLetter: string;
  answers: Record<string, string>;
  files: Record<string, string>; // fieldName -> absolute file path
}

/**
 * Automates form submission on an ATS or company career portal.
 * Site-specific selector logic should be added inside `playwrightClient.run`.
 */
export const formFiller = {
  async submitApplication(params: SubmitParams): Promise<void> {
    await playwrightClient.run(async (page) => {
      await page.goto(params.job.applyUrl, { waitUntil: 'networkidle' });

      // TODO: add site-specific selectors & flows.
      // Example pattern:
      //   await page.fill('input[name="fullName"]', params.profile.name);
      //   await page.fill('input[name="email"]', params.profile.email);
      //   if (params.files['resume']) {
      //     await page.setInputFiles('input[type="file"][name="resume"]', params.files['resume']);
      //   }
      //   await page.click('button[type="submit"]');
    });
  },
};
