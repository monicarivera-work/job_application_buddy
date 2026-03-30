export interface UserPreferences {
  desiredTitles: string[];
  locations: string[];
  remoteOnly: boolean;
  minSalary?: number;
  maxSalary?: number;
  mustHaveTech?: string[];
  avoidCompanies?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  resumeText: string;
  preferences: UserPreferences;
}
