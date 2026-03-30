import { UserProfile } from '../domain/userProfile';
import { MatchedJob } from '../domain/job';
import { formFiller } from './formFiller';
import { applicationRepo } from '../adapters/persistence/applicationRepo';

export interface ApplicationPlan {
  job: MatchedJob;
  coverLetterDraft: string;
  /**
   * Answers to standard application questions, keyed by question text or field name.
   * Examples:
   *   - 'Why do you want to work here?' → 'I admire your commitment to …'
   *   - 'Expected salary' → '120000'
   *   - 'Years of experience with TypeScript' → '5'
   *
   * Populated by the LLM integration (TODO) or pre-filled by the user in the UI.
   */
  answers: Record<string, string>;
  specialRequirements: string[];
}

export const applicationOrchestrator = {
  /**
   * Builds a draft application plan for a matched job.
   * TODO: integrate an LLM for tailored cover letter generation and Q&A.
   */
  async buildApplicationPlan(profile: UserProfile, job: MatchedJob): Promise<ApplicationPlan> {
    const coverLetterDraft =
      `Dear Hiring Team at ${job.company},\n\n` +
      `I am excited to apply for the ${job.title} role. ` +
      `With my background in ${(profile.preferences.mustHaveTech ?? []).join(', ')}, ` +
      `I believe I would be a strong fit for your team.\n\n` +
      `Best regards,\n${profile.name}`;

    const answers: Record<string, string> = {};
    const specialRequirements: string[] = []; // e.g., "coding test link", "video intro"

    return { job, coverLetterDraft, answers, specialRequirements };
  },

  /**
   * Submits an approved application plan via the form filler,
   * then records the submission in the application repository.
   */
  async submitApprovedApplication(
    profile: UserProfile,
    plan: ApplicationPlan,
    uploadedFiles: Record<string, string> // fieldName -> absolute file path
  ): Promise<void> {
    await formFiller.submitApplication({
      profile,
      job: plan.job,
      coverLetter: plan.coverLetterDraft,
      answers: plan.answers,
      files: uploadedFiles,
    });

    await applicationRepo.logSubmission({
      userId: profile.id,
      jobTitle: plan.job.title,
      company: plan.job.company,
      appliedAt: new Date(),
      applyUrl: plan.job.applyUrl,
      status: 'submitted',
    });
  },
};
