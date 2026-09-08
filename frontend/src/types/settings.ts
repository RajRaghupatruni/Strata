export type UserProfile = {
  id: number;
  display_name: string;
  target_rank?: string | null;
  preferred_agents: string[];
  preferred_roles: string[];
  known_weak_areas: string[];
  improvement_priorities: string[];
  personal_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UserProfileInput = {
  display_name: string;
  target_rank?: string;
  preferred_agents: string[];
  preferred_roles: string[];
  known_weak_areas: string[];
  improvement_priorities: string[];
  personal_notes?: string;
};

