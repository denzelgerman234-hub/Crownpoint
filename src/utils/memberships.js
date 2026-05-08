import { MEMBERSHIP_BILLING_CYCLES, MEMBERSHIP_PLANS } from './constants'

export const membershipPlanLabels = {
  [MEMBERSHIP_PLANS.FREE]: 'Free Fan',
  [MEMBERSHIP_PLANS.INNER_CIRCLE]: 'Inner Circle',
  [MEMBERSHIP_PLANS.CROWN_ACCESS]: 'Crown Access',
}

export const membershipBillingCycleLabels = {
  [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 'Monthly',
  [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 'Yearly',
}

const toTimestamp = (value) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export const getPlanLabel = (plan) =>
  membershipPlanLabels[plan] ?? membershipPlanLabels[MEMBERSHIP_PLANS.FREE]

export const getBillingCycleLabel = (billingCycle) =>
  membershipBillingCycleLabels[billingCycle] ?? null

export const getMembershipSelectionLabel = (plan, billingCycle) => {
  const planLabel = getPlanLabel(plan)
  const cycleLabel =
    getBillingCycleLabel(billingCycle) ??
    (plan !== MEMBERSHIP_PLANS.FREE
      ? membershipBillingCycleLabels[MEMBERSHIP_BILLING_CYCLES.MONTHLY]
      : null)

  return cycleLabel ? `${planLabel} / ${cycleLabel}` : planLabel
}

export const getUnlockedTalentIds = (user) =>
  Array.isArray(user?.talentsUnlocked)
    ? user.talentsUnlocked.map((talentId) => Number(talentId)).filter(Boolean)
    : []

export const getCurrentPlan = (user, now = Date.now()) => {
  if (!user?.plan || user.plan === MEMBERSHIP_PLANS.FREE) {
    return MEMBERSHIP_PLANS.FREE
  }

  const planExpiry = toTimestamp(user.planExpiry)

  if (planExpiry && planExpiry < now) {
    return MEMBERSHIP_PLANS.FREE
  }

  return user.plan
}

export const getCurrentPlanBillingCycle = (user, now = Date.now()) => {
  const currentPlan = getCurrentPlan(user, now)

  if (currentPlan === MEMBERSHIP_PLANS.FREE) {
    return null
  }

  return getBillingCycleLabel(user?.planBillingCycle)
    ? user.planBillingCycle
    : MEMBERSHIP_BILLING_CYCLES.MONTHLY
}

export const hasActiveMembership = (user, now = Date.now()) =>
  getCurrentPlan(user, now) !== MEMBERSHIP_PLANS.FREE

export const canUserMessageTalent = (user, talentId, now = Date.now()) => {
  const currentPlan = getCurrentPlan(user, now)
  const numericTalentId = Number(talentId)

  if (currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return true
  }

  if (currentPlan === MEMBERSHIP_PLANS.INNER_CIRCLE) {
    return getUnlockedTalentIds(user).includes(numericTalentId)
  }

  return false
}

export const getMembershipScopeCopy = (user, unlockedCount) => {
  const currentPlan = getCurrentPlan(user)

  if (currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return 'All talents available to message'
  }

  if (currentPlan === MEMBERSHIP_PLANS.INNER_CIRCLE) {
    return `${unlockedCount || 1} talent available to message`
  }

  return 'Membership inbox locked'
}
