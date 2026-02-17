export type PlanTier = 'explorer' | 'ultra';
export type CanonicalPlanType = 'EXPLORER' | 'ULTRA';

const ULTRA_ALIASES = new Set([
  'ultra',
  'pro',
  'premium',
  'enterprise',
  'elite',
]);

const EXPLORER_ALIASES = new Set([
  'explorer',
  'basic',
  'free',
  'trial',
]);

const normalize = (value?: string | null): string => (value || '').toLowerCase().trim();

export const normalizePlanTierValue = (value?: string | null): PlanTier => {
  const normalized = normalize(value);
  if (ULTRA_ALIASES.has(normalized)) return 'ultra';
  if (EXPLORER_ALIASES.has(normalized)) return 'explorer';
  return 'explorer';
};

export const canonicalPlanTypeForTier = (tier: PlanTier): CanonicalPlanType => (
  tier === 'ultra' ? 'ULTRA' : 'EXPLORER'
);

export const resolvePlanTierFromProfile = (
  profile: Partial<{
    role: string;
    tier: string;
    plan_tier: string;
    planType: string;
    plan_type: string;
    subscription: { tier?: string };
  }>
): PlanTier => {
  const role = normalize(profile.role);
  if (role === 'admin') return 'ultra';

  const directTier = normalize(profile.plan_tier);
  if (ULTRA_ALIASES.has(directTier) || EXPLORER_ALIASES.has(directTier)) {
    return normalizePlanTierValue(directTier);
  }

  const planTypeCandidate = profile.planType || profile.plan_type;
  const normalizedType = normalize(planTypeCandidate);
  if (ULTRA_ALIASES.has(normalizedType) || EXPLORER_ALIASES.has(normalizedType)) {
    return normalizePlanTierValue(normalizedType);
  }

  const fallbackTierCandidate = profile.subscription?.tier || profile.tier;
  return normalizePlanTierValue(fallbackTierCandidate);
};
