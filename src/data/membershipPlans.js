import { MEMBERSHIP_BILLING_CYCLES, MEMBERSHIP_PLANS } from '../utils/constants'

export const membershipBillingOptions = [
  {
    id: MEMBERSHIP_BILLING_CYCLES.MONTHLY,
    label: 'Monthly',
    note: 'Flexible month-to-month access',
  },
  {
    id: MEMBERSHIP_BILLING_CYCLES.YEARLY,
    label: 'Yearly',
    note: '12 months with 20% off',
  },
]

export const membershipPlans = [
  {
    id: MEMBERSHIP_PLANS.FREE,
    name: 'Free Fan',
    tone: 'free',
    eyebrow: 'Best for getting started',
    summary: 'Create your account, explore the roster, and start booking with confidence.',
    pricing: {
      [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 0,
      [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 0,
    },
    ctaLabel: 'Included with every account',
    features: [
      'Browse every talent profile and service',
      'Browse event access and merch links',
      'Track bookings, payments, and account activity',
      'Talent messaging stays locked until you join a paid plan',
    ],
  },
  {
    id: MEMBERSHIP_PLANS.INNER_CIRCLE,
    name: 'Inner Circle',
    tone: 'inner',
    eyebrow: 'Best for one favorite',
    summary: 'Stay close to one chosen talent with direct access, private updates, and members-only moments.',
    pricing: {
      [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 500,
      [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 4800,
    },
    ctaLabel: 'Apply for Inner Circle',
    features: [
      'Everything in Free Fan',
      'Message one specific talent you choose',
      'Priority handling on that talent lane',
      'Join the Signature Club for your chosen talent with private updates and curated drops',
      'Members-only drops and event access',
    ],
  },
  {
    id: MEMBERSHIP_PLANS.CROWN_ACCESS,
    name: 'Crown Access',
    tone: 'crown',
    eyebrow: 'Our most elevated tier',
    summary: 'For fans who want broad access, priority treatment, and the most complete CrownPoint experience.',
    pricing: {
      [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 2500,
      [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 24000,
    },
    ctaLabel: 'Apply for Crown Access',
    features: [
      'Everything in Inner Circle',
      'Message every talent on the platform',
      'VIP event priority and premium queueing',
      'Join Crown Society, our most exclusive fan club tier with elite first-look access and private moments',
      'One live call request included each month',
    ],
  },
]

export const membershipJourney = [
  {
    step: '01',
    title: 'Pick your plan',
    description: 'Choose Inner Circle for one artist or Crown Access for the full roster.',
  },
  {
    step: '02',
    title: 'Complete payment',
    description: 'Pay by bank transfer, gift card, or cryptocurrency using the method that suits you.',
  },
  {
    step: '03',
    title: 'Send your proof',
    description: 'Upload a receipt, reference, or screenshot so our team can verify your application promptly.',
  },
  {
    step: '04',
    title: 'Access confirmed',
    description: 'Once approved, your membership becomes active and private messaging opens right away.',
  },
]

export const getMembershipPlanById = (planId) =>
  membershipPlans.find((plan) => plan.id === planId) ?? membershipPlans[0]

export const isValidMembershipBillingCycle = (billingCycle) =>
  membershipBillingOptions.some((option) => option.id === billingCycle)

export const getMembershipPriceUsd = (
  planId,
  billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
) => {
  const plan = getMembershipPlanById(planId)
  return plan.pricing?.[billingCycle] ?? plan.pricing?.[MEMBERSHIP_BILLING_CYCLES.MONTHLY] ?? 0
}

export const getMembershipPriceLabel = (
  billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
) =>
  billingCycle === MEMBERSHIP_BILLING_CYCLES.YEARLY ? 'per year' : 'per month'
