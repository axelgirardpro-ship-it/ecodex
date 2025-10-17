export interface PlanTier {
  id: string;
  tier_code: string;
  plan_type: 'freemium' | 'pro';
  display_name_fr: string;
  display_name_en: string;
  max_users: number;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkspaceWithTier {
  id: string;
  name: string;
  owner_email?: string;
  plan_type: 'freemium' | 'pro';
  plan_tier: string | null;
  user_count: number;
  pending_invitations: number;
  created_at: string;
  tier_info?: PlanTier;
}

export interface TierLimitCheck {
  allowed: boolean;
  current_count: number;
  max_users: number;
  active_users: number;
  pending_invitations: number;
  tier_code: string;
  error?: string;
}

