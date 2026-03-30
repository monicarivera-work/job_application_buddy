import { UserProfile } from '../domain/userProfile';
import { userRepo } from '../adapters/persistence/userRepo';

export const profileService = {
  async upsertProfile(profile: UserProfile): Promise<UserProfile> {
    return userRepo.upsert(profile);
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    return userRepo.findById(userId);
  },
};
