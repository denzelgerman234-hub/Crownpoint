import { getMembershipPriceUsd } from '../data/membershipPlans'
import api from '../utils/api'
import { getTalentSnapshotById } from './talentService'
import {
  BACKEND_REQUIRED_MESSAGE,
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  SUPABASE_AUTH_ENABLED,
} from '../utils/backendConfig'
import {
  MEMBERSHIP_BILLING_CYCLES,
  MEMBERSHIP_DURATION_DAYS_BY_CYCLE,
  MEMBERSHIP_PLANS,
  MEMBERSHIP_STATUS,
  PAYMENT_METHODS,
} from '../utils/constants'
import { getCurrencyConfig, getCurrencyPreference } from '../utils/currency'
import { canUserMessageTalent } from '../utils/memberships'
import { getUserById, updateUserMembership } from './authService'

const MEMBERSHIP_QUEUE_KEY = 'crownpoint_membership_queue'
const MEMBERSHIP_UPDATED_EVENT = 'crownpoint:membership-updated'
const MEMBERSHIP_API_START_HINT =
  'Start `npm run api` so membership requests can persist through the backend API.'
const MEMBERSHIP_BACKEND_ENABLED = SUPABASE_AUTH_ENABLED
const MEMBERSHIP_LOCAL_FALLBACKS_ENABLED = LOCAL_BACKEND_FALLBACKS_ENABLED

let hasWarnedMembershipBackendUnavailable = false

const getLegacySeedMembershipQueue = () => [
  {
    id: 301,
    userId: 901,
    fanName: 'Marcus Williams',
    email: 'marcus@example.com',
    plan: MEMBERSHIP_PLANS.INNER_CIRCLE,
    billingCycle: MEMBERSHIP_BILLING_CYCLES.MONTHLY,
    talentId: 5,
    talentName: 'Kai Cenat',
    amountUsd: 500,
    currencyCode: 'GBP',
    region: 'United Kingdom',
    paymentMethod: PAYMENT_METHODS.BANK,
    proofSummary: 'Transfer receipt uploaded with matching reference and account name.',
    proofFileName: 'kai-membership-proof.jpg',
    submittedAt: new Date(Date.now() - 14 * 60000).toISOString(),
    status: MEMBERSHIP_STATUS.UNDER_REVIEW,
    risk: 'low',
  },
  {
    id: 302,
    userId: 902,
    fanName: 'Sofia Reyes',
    email: 'sofia@example.com',
    plan: MEMBERSHIP_PLANS.CROWN_ACCESS,
    billingCycle: MEMBERSHIP_BILLING_CYCLES.YEARLY,
    talentId: null,
    talentName: 'All talents',
    amountUsd: 24000,
    currencyCode: 'EUR',
    region: 'Spain',
    paymentMethod: PAYMENT_METHODS.CRYPTO,
    proofSummary: 'Wallet hash included, but the sending wallet is new and needs review.',
    proofFileName: 'crown-access-hash.txt',
    submittedAt: new Date(Date.now() - 28 * 60000).toISOString(),
    status: MEMBERSHIP_STATUS.FLAGGED,
    risk: 'medium',
  },
]

const readApiErrorMessage = (error, fallbackMessage) => {
  const responseMessage = String(error?.response?.data?.message ?? '').trim()
  const errorMessage = String(error?.message ?? '').trim()

  if (responseMessage) {
    return responseMessage
  }

  if (!error?.response && (!errorMessage || errorMessage.toLowerCase() === 'network error')) {
    return fallbackMessage
  }

  return errorMessage || fallbackMessage
}

const warnMembershipBackendUnavailable = (error) => {
  if (hasWarnedMembershipBackendUnavailable) {
    return
  }

  hasWarnedMembershipBackendUnavailable = true
  console.warn(
    `Falling back to browser-stored membership requests because the backend API is unavailable. ${readApiErrorMessage(error, MEMBERSHIP_API_START_HINT)}`,
  )
}

const shouldFallbackToLocalMembershipStore = (error) =>
  !error?.response || Number(error.response.status) >= 500

const normalizeMembershipRequest = (item = {}) => {
  const billingCycle = item.billingCycle ?? MEMBERSHIP_BILLING_CYCLES.MONTHLY

  return {
    ...item,
    id: Number(item.id ?? 0) || item.id,
    userId: item.userId == null ? null : Number(item.userId) || null,
    talentId: item.talentId == null ? null : Number(item.talentId) || null,
    billingCycle,
    amountUsd:
      item.billingCycle && typeof item.amountUsd === 'number'
        ? item.amountUsd
        : getMembershipPriceUsd(item.plan, billingCycle),
  }
}

const stripLegacySeedMembershipQueue = (queue = []) => {
  const seededIds = new Set(getLegacySeedMembershipQueue().map((item) => item.id))
  return queue.filter((item) => !seededIds.has(item.id))
}

const readMembershipQueueFromStorage = () => {
  if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return []
  }

  const storedQueue = window.localStorage.getItem(MEMBERSHIP_QUEUE_KEY)

  if (!storedQueue) {
    return []
  }

  try {
    const parsedQueue = JSON.parse(storedQueue)
    return stripLegacySeedMembershipQueue(
      Array.isArray(parsedQueue) ? parsedQueue.map(normalizeMembershipRequest) : [],
    )
  } catch {
    window.localStorage.removeItem(MEMBERSHIP_QUEUE_KEY)
    return []
  }
}

const sortByNewest = (queue) =>
  [...queue].sort((left, right) => new Date(right.submittedAt) - new Date(left.submittedAt))

let membershipQueueCache = sortByNewest(readMembershipQueueFromStorage())

const emitMembershipUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MEMBERSHIP_UPDATED_EVENT))
  }
}

const syncMembershipQueueCache = (queue, { emit = false, persist = true } = {}) => {
  membershipQueueCache = sortByNewest(
    stripLegacySeedMembershipQueue(
      Array.isArray(queue) ? queue.map(normalizeMembershipRequest) : [],
    ),
  )

  if (persist && MEMBERSHIP_LOCAL_FALLBACKS_ENABLED && typeof window !== 'undefined') {
    window.localStorage.setItem(MEMBERSHIP_QUEUE_KEY, JSON.stringify(membershipQueueCache))
  }

  if (emit) {
    emitMembershipUpdate()
  }

  return membershipQueueCache
}

const resolvePlanAmount = (plan, billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY) =>
  getMembershipPriceUsd(plan, billingCycle)

const calculatePlanExpiry = (
  currentPlanExpiry,
  billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
) => {
  const now = Date.now()
  const currentExpiry = currentPlanExpiry ? new Date(currentPlanExpiry).getTime() : null
  const effectiveStart = currentExpiry && currentExpiry > now ? currentExpiry : now
  const durationDays =
    MEMBERSHIP_DURATION_DAYS_BY_CYCLE[billingCycle] ??
    MEMBERSHIP_DURATION_DAYS_BY_CYCLE[MEMBERSHIP_BILLING_CYCLES.MONTHLY]

  return new Date(
    effectiveStart + durationDays * 24 * 60 * 60 * 1000,
  ).toISOString()
}

const buildUnlockedTalents = (request) => {
  if (request.plan === MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return []
  }

  return request.talentId ? [Number(request.talentId)] : []
}

const hasActiveInnerCircleAccess = (user, talentId) => {
  const normalizedTalentId = Number(talentId)

  if (!user || !normalizedTalentId) {
    return false
  }

  return canUserMessageTalent(user, normalizedTalentId)
}

const submitMembershipRequestLocally = ({
  userId,
  plan,
  billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
  talentId,
  paymentMethod,
  proofFileName,
  proofSummary,
  currencyCode = getCurrencyPreference(),
}) => {
  const user = getUserById(userId)

  if (!user) {
    throw new Error('Sign in before submitting a membership request.')
  }

  if (getUserMembershipRequests(userId).some((item) => item.status === MEMBERSHIP_STATUS.UNDER_REVIEW)) {
    throw new Error('You already have a membership request under review.')
  }

  if (plan === MEMBERSHIP_PLANS.INNER_CIRCLE && !talentId) {
    throw new Error('Choose the talent you want unlocked for Inner Circle.')
  }

  if (plan === MEMBERSHIP_PLANS.INNER_CIRCLE && hasActiveInnerCircleAccess(user, talentId)) {
    throw new Error('You already have active access to this talent.')
  }

  const talent = talentId ? getTalentSnapshotById(talentId) : null
  const nextRequest = {
    id: Date.now(),
    userId: user.id,
    fanName: user.name,
    email: user.email,
    plan,
    billingCycle,
    talentId: talent?.id ?? null,
    talentName: talent?.name ?? 'All talents',
    amountUsd: resolvePlanAmount(plan, billingCycle),
    currencyCode,
    region: getCurrencyConfig(currencyCode).regionLabel,
    paymentMethod,
    proofSummary,
    proofFileName,
    submittedAt: new Date().toISOString(),
    status: MEMBERSHIP_STATUS.UNDER_REVIEW,
    risk: paymentMethod === PAYMENT_METHODS.CRYPTO ? 'medium' : 'low',
  }

  syncMembershipQueueCache([nextRequest, ...membershipQueueCache], { emit: true })
  return nextRequest
}

const reviewMembershipRequestLocally = (requestId, status) => {
  let reviewedRequest = null
  let reviewTimestamp = null
  let previousStatus = null
  let wasAlreadyActivated = false

  const nextQueue = membershipQueueCache.map((item) => {
    if (Number(item.id) !== Number(requestId)) {
      return item
    }

    reviewTimestamp = new Date().toISOString()
    previousStatus = item.status
    wasAlreadyActivated = Boolean(item.activatedAt)
    reviewedRequest = normalizeMembershipRequest({
      ...item,
      status,
      activatedAt:
        status === MEMBERSHIP_STATUS.APPROVED ? item.activatedAt ?? reviewTimestamp : item.activatedAt,
      reviewedAt: reviewTimestamp,
    })

    return reviewedRequest
  })

  syncMembershipQueueCache(nextQueue, { emit: true })

  if (
    !reviewedRequest ||
    status !== MEMBERSHIP_STATUS.APPROVED ||
    previousStatus === MEMBERSHIP_STATUS.APPROVED ||
    wasAlreadyActivated
  ) {
    return reviewedRequest
  }

  const currentUser = getUserById(reviewedRequest.userId)

  if (!currentUser) {
    return reviewedRequest
  }

  updateUserMembership(reviewedRequest.userId, {
    plan: reviewedRequest.plan,
    planExpiry: calculatePlanExpiry(currentUser.planExpiry, reviewedRequest.billingCycle),
    planBillingCycle: reviewedRequest.billingCycle,
    talentsUnlocked: buildUnlockedTalents(reviewedRequest),
  })

  return reviewedRequest
}

export const getMembershipQueue = () => membershipQueueCache

export const refreshMembershipQueue = async () => {
  if (!MEMBERSHIP_BACKEND_ENABLED) {
    if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return getMembershipQueue()
  }

  try {
    const response = await api.get('/membership-requests')
    return syncMembershipQueueCache(response.data, { emit: true })
  } catch (error) {
    if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(
        readApiErrorMessage(error, BACKEND_REQUIRED_MESSAGE),
      )
    }

    if (error?.response?.status && Number(error.response.status) < 500) {
      return getMembershipQueue()
    }

    warnMembershipBackendUnavailable(error)
    return getMembershipQueue()
  }
}

export const subscribeToMembershipUpdates = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getMembershipQueue())
  const handleStorage = (event) => {
    if (event.key === MEMBERSHIP_QUEUE_KEY) {
      membershipQueueCache = sortByNewest(readMembershipQueueFromStorage())
      listener(getMembershipQueue())
    }
  }

  window.addEventListener(MEMBERSHIP_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(MEMBERSHIP_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
  }
}

export const getUserMembershipRequests = (userId) =>
  sortByNewest(getMembershipQueue().filter((item) => item.userId === Number(userId)))

export const getLatestMembershipRequest = (userId) => getUserMembershipRequests(userId)[0] ?? null

export const hasPendingMembershipRequest = (userId) =>
  getUserMembershipRequests(userId).some((item) => item.status === MEMBERSHIP_STATUS.UNDER_REVIEW)

export const submitMembershipRequest = async ({
  userId,
  plan,
  billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
  talentId,
  paymentMethod,
  proofFileName,
  proofSummary,
  currencyCode = getCurrencyPreference(),
}) => {
  if (!MEMBERSHIP_BACKEND_ENABLED) {
    if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return submitMembershipRequestLocally({
      userId,
      plan,
      billingCycle,
      talentId,
      paymentMethod,
      proofFileName,
      proofSummary,
      currencyCode,
    })
  }

  try {
    const response = await api.post('/membership-requests', {
      userId,
      plan,
      billingCycle,
      talentId,
      paymentMethod,
      proofFileName,
      proofSummary,
      currencyCode,
      region: getCurrencyConfig(currencyCode).regionLabel,
    })
    const createdRequest = normalizeMembershipRequest(response.data)
    syncMembershipQueueCache(
      [createdRequest, ...membershipQueueCache.filter((item) => Number(item.id) !== Number(createdRequest.id))],
      { emit: true },
    )
    return createdRequest
  } catch (error) {
    if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED || !shouldFallbackToLocalMembershipStore(error)) {
      throw new Error(
        readApiErrorMessage(error, 'We could not submit your membership request right now.'),
      )
    }

    warnMembershipBackendUnavailable(error)
    return submitMembershipRequestLocally({
      userId,
      plan,
      billingCycle,
      talentId,
      paymentMethod,
      proofFileName,
      proofSummary,
      currencyCode,
    })
  }
}

export const reviewMembershipRequest = async (requestId, status) => {
  if (!MEMBERSHIP_BACKEND_ENABLED) {
    if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return reviewMembershipRequestLocally(requestId, status)
  }

  try {
    const response = await api.patch(`/membership-requests/${requestId}`, { status })
    const reviewedRequest = normalizeMembershipRequest(response.data)
    syncMembershipQueueCache(
      membershipQueueCache.map((item) =>
        Number(item.id) === Number(reviewedRequest.id) ? reviewedRequest : item,
      ),
      { emit: true },
    )
    return reviewedRequest
  } catch (error) {
    if (!MEMBERSHIP_LOCAL_FALLBACKS_ENABLED || !shouldFallbackToLocalMembershipStore(error)) {
      throw new Error(
        readApiErrorMessage(error, 'We could not update that membership request right now.'),
      )
    }

    warnMembershipBackendUnavailable(error)
    return reviewMembershipRequestLocally(requestId, status)
  }
}

export const removeUserMembershipRequests = (userId) => {
  const normalizedUserId = Number(userId)
  const currentQueue = getMembershipQueue()
  const nextQueue = currentQueue.filter((item) => item.userId !== normalizedUserId)

  if (nextQueue.length !== currentQueue.length) {
    syncMembershipQueueCache(nextQueue, { emit: true })
  }

  return currentQueue.length - nextQueue.length
}
