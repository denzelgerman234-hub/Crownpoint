import { createAvatarDataUrl, getInitials } from '../utils/avatar'
import {
  removeSignupRecordFromDevStore,
  saveSignupRecordToDevStore,
} from './devSignupRecordService'
import {
  CONTACT_METHODS,
  IDENTITY_VERIFICATION_STATUS,
  MEMBERSHIP_BILLING_CYCLES,
  MEMBERSHIP_PLANS,
  ROLES,
} from '../utils/constants'
import { supabase } from '../lib/supabaseClient'
import api from '../utils/api'
import { isAdultDateOfBirth } from '../utils/profile'
import { normalizeStoredUpload } from './storageService'

const USERS_KEY = 'crownpoint_users'
const TOKEN_KEY = 'crownpoint_token'
const CURRENT_USER_KEY = 'crownpoint_user'
const DELETED_SEED_USERS_KEY = 'crownpoint_deleted_seed_users'
const PENDING_SUPABASE_SIGNUPS_KEY = 'crownpoint_pending_supabase_signups'
const USER_UPDATED_EVENT = 'crownpoint:user-updated'
const PROFILE_TABLE = 'user_profiles'
export const DEMO_USER_ID = 1
export const DEMO_USER_EMAIL = 'amara@example.com'
const SUPABASE_AUTH_ENABLED =
  import.meta.env.VITE_USE_SUPABASE_AUTH === 'true' &&
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
export const AUTH_USES_SUPABASE = SUPABASE_AUTH_ENABLED

const defaultMembership = {
  plan: MEMBERSHIP_PLANS.FREE,
  planExpiry: null,
  planBillingCycle: null,
  talentsUnlocked: [],
}

const defaultUserProfile = {
  phone: '',
  dateOfBirth: '',
  city: '',
  country: '',
  countryCode: '',
  phoneDialCode: '',
  bio: '',
  admirationReason: '',
  hobbies: '',
  interests: '',
  favoriteTalent: '',
  occupation: '',
  preferredContactMethod: CONTACT_METHODS.EMAIL,
}

const createEmptyStoredUpload = () => ({
  uploadId: '',
  bucket: '',
  publicUrl: '',
  previewUrl: '',
  fileName: '',
  mimeType: '',
  storagePath: '',
  size: 0,
  uploadedAt: null,
})

const defaultVerificationDocument = createEmptyStoredUpload()

const defaultIdentityVerification = {
  status: IDENTITY_VERIFICATION_STATUS.NOT_SUBMITTED,
  submittedAt: null,
  ageVerifiedAt: null,
  isAdultVerified: false,
  documents: {
    idFront: { ...defaultVerificationDocument },
    idBack: { ...defaultVerificationDocument },
    ssn: { ...defaultVerificationDocument },
  },
}

const normalizeManagedUpload = (upload = {}) => ({
  ...createEmptyStoredUpload(),
  ...normalizeStoredUpload(upload),
})

const normalizeVerificationDocument = (document = {}) => normalizeManagedUpload(document)

const seedUsers = () => [
  {
    id: DEMO_USER_ID,
    name: 'Amara Okafor',
    email: DEMO_USER_EMAIL,
    password: 'welcome123',
    role: ROLES.FAN,
    initials: 'AO',
    avatarUrl: createAvatarDataUrl('Amara Okafor'),
    createdAt: '2025-11-01T09:00:00.000Z',
    profile: {
      phone: '+1 404 555 0182',
      dateOfBirth: '1996-03-14',
      city: 'Atlanta',
      country: 'United States',
      bio: 'Entertainment enthusiast who loves curated experiences, private access, and thoughtful celebrity gifting.',
      admirationReason: 'I admire how some celebrities stay disciplined, polished, and generous with their fans.',
      hobbies: 'Travel, fashion, concert weekends, and collecting signed memorabilia.',
      interests: 'Music rollouts, film premieres, luxury experiences, and behind-the-scenes content.',
      favoriteTalent: 'Bruno Mars',
      occupation: 'Brand partnerships manager',
      preferredContactMethod: CONTACT_METHODS.PHONE,
    },
    verification: {
      status: IDENTITY_VERIFICATION_STATUS.VERIFIED,
      submittedAt: '2025-11-01T09:10:00.000Z',
      ageVerifiedAt: '2025-11-01T09:10:00.000Z',
      isAdultVerified: true,
    },
    agreements: {
      interactionConfidentialityAcceptedAt: '2025-11-01T09:12:00.000Z',
    },
    ...defaultMembership,
  },
  {
    id: 2,
    name: 'CrownPoint Admin',
    email: 'admin@crownpoint.local',
    password: 'CrownPointAdmin123!',
    role: ROLES.ADMIN,
    initials: 'CA',
    avatarUrl: createAvatarDataUrl('CrownPoint Admin'),
    createdAt: '2025-11-01T09:00:00.000Z',
    profile: {
      city: 'London',
      country: 'United Kingdom',
      bio: 'Internal operations account for CrownPoint administration.',
      preferredContactMethod: CONTACT_METHODS.EMAIL,
    },
    verification: {
      status: IDENTITY_VERIFICATION_STATUS.VERIFIED,
      submittedAt: '2025-11-01T09:00:00.000Z',
      ageVerifiedAt: '2025-11-01T09:00:00.000Z',
      isAdultVerified: true,
    },
    ...defaultMembership,
  },
]

const normalizeUserRecord = (user = {}) => ({
  ...defaultMembership,
  ...user,
  avatarStorage: normalizeManagedUpload(user?.avatarStorage),
  profileUpdatedAt: user.profileUpdatedAt ?? null,
  profile: {
    ...defaultUserProfile,
    ...(user.profile ?? {}),
  },
  verification: {
    ...defaultIdentityVerification,
    ...(user.verification ?? {}),
    documents: {
      idFront: normalizeVerificationDocument(user?.verification?.documents?.idFront),
      idBack: normalizeVerificationDocument(user?.verification?.documents?.idBack),
      ssn: normalizeVerificationDocument(user?.verification?.documents?.ssn),
    },
  },
  createdAt: user.createdAt ?? null,
  talentsUnlocked: Array.isArray(user.talentsUnlocked)
    ? user.talentsUnlocked.map((talentId) => Number(talentId)).filter(Boolean)
    : [],
})

const emitUserUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(USER_UPDATED_EVENT))
  }
}

const readDeletedSeedUserEmails = () => {
  const storedDeletedSeedUsers = localStorage.getItem(DELETED_SEED_USERS_KEY)

  if (!storedDeletedSeedUsers) {
    return new Set()
  }

  try {
    const parsedDeletedSeedUsers = JSON.parse(storedDeletedSeedUsers)

    return new Set(
      (Array.isArray(parsedDeletedSeedUsers) ? parsedDeletedSeedUsers : [])
        .map((email) => String(email ?? '').trim().toLowerCase())
        .filter(Boolean),
    )
  } catch {
    localStorage.removeItem(DELETED_SEED_USERS_KEY)
    return new Set()
  }
}

const writeDeletedSeedUserEmails = (emails) => {
  localStorage.setItem(DELETED_SEED_USERS_KEY, JSON.stringify([...emails]))
}

const mergeSeedUsers = (users) => {
  const deletedSeedUserEmails = readDeletedSeedUserEmails()
  const seededByEmail = new Map(
    seedUsers()
      .filter((user) => !deletedSeedUserEmails.has(user.email.toLowerCase()))
      .map((user) => [user.email.toLowerCase(), normalizeUserRecord(user)]),
  )
  const existingUsers = users.map(normalizeUserRecord)

  existingUsers.forEach((user) => {
    seededByEmail.delete(user.email.toLowerCase())
  })

  return [...existingUsers, ...seededByEmail.values()]
}

const readUsers = () => {
  const storedUsers = localStorage.getItem(USERS_KEY)

  if (!storedUsers) {
    const initialUsers = mergeSeedUsers([])
    localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers))
    return initialUsers
  }

  const parsedUsers = JSON.parse(storedUsers).map(normalizeUserRecord)
  const nextUsers = mergeSeedUsers(parsedUsers)

  if (nextUsers.length !== parsedUsers.length) {
    writeUsers(nextUsers)
  }

  return nextUsers
}

const writeUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users.map(normalizeUserRecord)))
}

const sanitizeUser = ({ password: _password, ...user }) => {
  const normalizedUser = normalizeUserRecord(user)

  return {
    ...normalizedUser,
    avatarUrl: normalizedUser.avatarUrl || createAvatarDataUrl(normalizedUser.name),
    initials: normalizedUser.initials || getInitials(normalizedUser.name),
  }
}

const normalizeAuthRole = (value) => String(value ?? '').trim().toUpperCase()

const collectAuthRoles = (metadata = {}) => {
  const roles = []
  const singleRole = normalizeAuthRole(metadata.role)

  if (singleRole) {
    roles.push(singleRole)
  }

  if (Array.isArray(metadata.roles)) {
    roles.push(...metadata.roles.map(normalizeAuthRole).filter(Boolean))
  }

  return roles
}

const isSupabaseAdminUser = (user = {}) =>
  [
    ...collectAuthRoles(user.app_metadata),
    ...collectAuthRoles(user.user_metadata),
  ].includes(ROLES.ADMIN)

const mapSupabaseAdminUser = (user = {}) => {
  const displayName =
    String(user.user_metadata?.name ?? user.user_metadata?.full_name ?? '').trim() ||
    String(user.email ?? 'CrownPoint Admin').split('@')[0] ||
    'CrownPoint Admin'

  return sanitizeUser({
    id: user.id,
    authUserId: user.id,
    name: displayName,
    email: String(user.email ?? '').trim().toLowerCase(),
    role: ROLES.ADMIN,
    initials: getInitials(displayName),
    avatarUrl: user.user_metadata?.avatar_url || createAvatarDataUrl(displayName),
    createdAt: user.created_at ?? new Date().toISOString(),
    profile: {
      city: String(user.user_metadata?.city ?? '').trim(),
      country: String(user.user_metadata?.country ?? '').trim(),
      bio: 'Supabase authenticated CrownPoint administrator.',
      preferredContactMethod: CONTACT_METHODS.EMAIL,
    },
    verification: {
      status: IDENTITY_VERIFICATION_STATUS.VERIFIED,
      submittedAt: user.created_at ?? new Date().toISOString(),
      ageVerifiedAt: user.created_at ?? new Date().toISOString(),
      isAdultVerified: true,
    },
    ...defaultMembership,
  })
}

const trimText = (value) => String(value ?? '').trim()

const normalizeStoredRole = (value, fallback = ROLES.FAN) => {
  const normalizedRole = normalizeAuthRole(value)
  return Object.values(ROLES).includes(normalizedRole) ? normalizedRole : fallback
}

const normalizeStoredPlan = (value) =>
  Object.values(MEMBERSHIP_PLANS).includes(value) ? value : MEMBERSHIP_PLANS.FREE

const normalizeStoredBillingCycle = (value) =>
  Object.values(MEMBERSHIP_BILLING_CYCLES).includes(value) ? value : null

const readStoredToken = () =>
  typeof window === 'undefined' ? '' : trimText(window.localStorage.getItem(TOKEN_KEY))

const readStoredCurrentUser = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const storedUser = window.localStorage.getItem(CURRENT_USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return sanitizeUser(JSON.parse(storedUser))
  } catch {
    window.localStorage.removeItem(CURRENT_USER_KEY)
    return null
  }
}

const writeCurrentSession = (user, token = '') => {
  if (typeof window === 'undefined') {
    return
  }

  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(TOKEN_KEY)
  }

  if (user) {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sanitizeUser(user)))
  } else {
    window.localStorage.removeItem(CURRENT_USER_KEY)
  }

  emitUserUpdate()
}

const readSupabaseErrorMessage = (error, fallbackMessage) =>
  trimText(error?.message) || trimText(error?.details) || trimText(error?.hint) || fallbackMessage

const readSupabaseErrorCode = (error) =>
  trimText(error?.code || error?.error_code).toLowerCase()

const buildAppRedirectUrl = (path = '/auth') => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return new URL(path, window.location.origin).toString()
  } catch {
    return ''
  }
}

const isSupabaseRateLimitMessage = (message = '') =>
  message.includes('rate limit') ||
  message.includes('over_email_send_rate_limit') ||
  message.includes('email rate limit exceeded') ||
  message.includes('security purposes, you can only request this after')

const mapSupabaseAuthError = (
  error,
  {
    fallbackMessage = 'We could not complete that request right now.',
    email = '',
    checkPendingSignup = false,
  } = {},
) => {
  const message = readSupabaseErrorMessage(error, fallbackMessage)
  const normalizedMessage = trimText(message).toLowerCase()
  const normalizedCode = readSupabaseErrorCode(error)
  const normalizedEmail = trimText(email).toLowerCase()
  const hasPendingSignup =
    checkPendingSignup && Boolean(getPendingSupabaseSignupDraft(normalizedEmail))

  if (
    normalizedCode === 'email_not_confirmed' ||
    normalizedMessage.includes('email not confirmed')
  ) {
    return 'Sign-in is blocked because email confirmation is still enabled in Supabase. This project is configured to sign users in immediately after signup.'
  }

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid grant')
  ) {
    if (hasPendingSignup) {
      return 'Your account was created, but Supabase is still waiting for email confirmation. This project is meant to skip that step, so the live auth settings need to stay aligned.'
    }

    return 'Incorrect email or password.'
  }

  if (isSupabaseRateLimitMessage(normalizedMessage) || normalizedCode.includes('rate_limit')) {
    return 'Too many email requests were sent just now. Please wait a little and use the latest email already in your inbox before trying again.'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'That email already has an account. Sign in instead, or use password reset if you forgot the password.'
  }

  return message || fallbackMessage
}

const isSupabaseBackedUser = (user = {}) => Boolean(trimText(user?.authUserId))

const sanitizePersistedVerificationDocument = (document = {}) => {
  const normalizedDocument = normalizeVerificationDocument(document)
  const { previewUrl: _previewUrl, ...persistedDocument } = normalizedDocument
  return persistedDocument
}

const sanitizePersistedAvatarStorage = (upload = {}) => {
  const normalizedUpload = normalizeManagedUpload(upload)
  const { previewUrl: _previewUrl, ...persistedUpload } = normalizedUpload
  return persistedUpload
}

const sanitizePersistedVerification = (verification = {}) => {
  const normalizedVerification =
    verification && typeof verification === 'object' ? verification : {}

  return {
    ...defaultIdentityVerification,
    ...normalizedVerification,
    documents: {
      idFront: sanitizePersistedVerificationDocument(normalizedVerification?.documents?.idFront),
      idBack: sanitizePersistedVerificationDocument(normalizedVerification?.documents?.idBack),
      ssn: sanitizePersistedVerificationDocument(normalizedVerification?.documents?.ssn),
    },
  }
}

const sanitizePersistedAgreements = (agreements = {}) =>
  agreements && typeof agreements === 'object' ? agreements : {}

const buildSupabaseUserDraft = (authUser = {}, user = {}) => {
  const avatarStorage = normalizeManagedUpload(user?.avatarStorage)
  const fallbackName =
    trimText(user?.name) ||
    trimText(authUser.user_metadata?.name) ||
    trimText(authUser.email).split('@')[0] ||
    'CrownPoint Member'

  return sanitizeUser({
    ...defaultMembership,
    ...user,
    id: Number(user?.id) || Date.now(),
    authUserId: trimText(user?.authUserId || authUser.id),
    name: fallbackName,
    email: trimText(user?.email || authUser.email).toLowerCase(),
    role: normalizeStoredRole(user?.role, isSupabaseAdminUser(authUser) ? ROLES.ADMIN : ROLES.FAN),
    initials: trimText(user?.initials) || getInitials(fallbackName),
    avatarUrl:
      trimText(avatarStorage.publicUrl) ||
      trimText(user?.avatarUrl) ||
      trimText(authUser.user_metadata?.avatar_url) ||
      createAvatarDataUrl(fallbackName),
    avatarStorage,
    createdAt: user?.createdAt ?? authUser.created_at ?? new Date().toISOString(),
    profileUpdatedAt: user?.profileUpdatedAt ?? null,
    profile: {
      ...defaultUserProfile,
      ...(user?.profile ?? {}),
    },
    verification: sanitizePersistedVerification(user?.verification),
    agreements: sanitizePersistedAgreements(user?.agreements),
    plan: normalizeStoredPlan(user?.plan),
    planExpiry: user?.planExpiry ?? null,
    planBillingCycle: normalizeStoredBillingCycle(user?.planBillingCycle),
    talentsUnlocked: Array.isArray(user?.talentsUnlocked)
      ? user.talentsUnlocked.map((talentId) => Number(talentId)).filter(Boolean)
      : [],
  })
}

const readPendingSupabaseSignupDrafts = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  const storedDrafts = window.localStorage.getItem(PENDING_SUPABASE_SIGNUPS_KEY)

  if (!storedDrafts) {
    return {}
  }

  try {
    const parsedDrafts = JSON.parse(storedDrafts)

    if (!parsedDrafts || typeof parsedDrafts !== 'object' || Array.isArray(parsedDrafts)) {
      window.localStorage.removeItem(PENDING_SUPABASE_SIGNUPS_KEY)
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsedDrafts)
        .map(([email, draft]) => {
          const normalizedEmail = trimText(email).toLowerCase()

          if (!normalizedEmail || !draft || typeof draft !== 'object') {
            return null
          }

          return [normalizedEmail, buildSupabaseUserDraft({}, draft)]
        })
        .filter(Boolean),
    )
  } catch {
    window.localStorage.removeItem(PENDING_SUPABASE_SIGNUPS_KEY)
    return {}
  }
}

const writePendingSupabaseSignupDrafts = (drafts) => {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedDrafts = Object.fromEntries(
    Object.entries(drafts ?? {})
      .map(([email, draft]) => {
        const normalizedEmail = trimText(email).toLowerCase()

        if (!normalizedEmail || !draft || typeof draft !== 'object') {
          return null
        }

        return [normalizedEmail, buildSupabaseUserDraft({}, draft)]
      })
      .filter(Boolean),
  )

  if (Object.keys(normalizedDrafts).length) {
    window.localStorage.setItem(
      PENDING_SUPABASE_SIGNUPS_KEY,
      JSON.stringify(normalizedDrafts),
    )
    return
  }

  window.localStorage.removeItem(PENDING_SUPABASE_SIGNUPS_KEY)
}

const savePendingSupabaseSignupDraft = (user) => {
  const normalizedEmail = trimText(user?.email).toLowerCase()

  if (!normalizedEmail || typeof window === 'undefined') {
    return null
  }

  const drafts = readPendingSupabaseSignupDrafts()
  const nextDraft = buildSupabaseUserDraft({}, {
    ...user,
    email: normalizedEmail,
    profileUpdatedAt: user?.profileUpdatedAt ?? new Date().toISOString(),
  })

  drafts[normalizedEmail] = nextDraft
  writePendingSupabaseSignupDrafts(drafts)
  return nextDraft
}

const getPendingSupabaseSignupDraft = (email) => {
  const normalizedEmail = trimText(email).toLowerCase()

  if (!normalizedEmail) {
    return null
  }

  return readPendingSupabaseSignupDrafts()[normalizedEmail] ?? null
}

const removePendingSupabaseSignupDraft = (email) => {
  const normalizedEmail = trimText(email).toLowerCase()

  if (!normalizedEmail || typeof window === 'undefined') {
    return
  }

  const drafts = readPendingSupabaseSignupDrafts()

  if (!drafts[normalizedEmail]) {
    return
  }

  delete drafts[normalizedEmail]
  writePendingSupabaseSignupDrafts(drafts)
}

const mapSupabaseProfileRecord = (record = {}, authUser = {}) => {
  const profileRecord = record && typeof record === 'object' ? record : {}
  const avatarStorage = normalizeManagedUpload(profileRecord.avatar_storage)
  const displayName =
    trimText(profileRecord.name) ||
    trimText(authUser.user_metadata?.name) ||
    trimText(profileRecord.email || authUser.email).split('@')[0] ||
    'CrownPoint Member'

  return sanitizeUser({
    id: Number(profileRecord.public_id) || Date.now(),
    authUserId: trimText(profileRecord.id || authUser.id),
    name: displayName,
    email: trimText(profileRecord.email || authUser.email).toLowerCase(),
    role: normalizeStoredRole(profileRecord.role, isSupabaseAdminUser(authUser) ? ROLES.ADMIN : ROLES.FAN),
    initials: trimText(profileRecord.initials) || getInitials(displayName),
    avatarUrl:
      trimText(avatarStorage.publicUrl) ||
      trimText(profileRecord.avatar_url) ||
      trimText(authUser.user_metadata?.avatar_url) ||
      createAvatarDataUrl(displayName),
    avatarStorage,
    createdAt: profileRecord.created_at ?? authUser.created_at ?? new Date().toISOString(),
    profileUpdatedAt: profileRecord.profile_updated_at ?? null,
    profile: profileRecord.profile && typeof profileRecord.profile === 'object' ? profileRecord.profile : {},
    verification: sanitizePersistedVerification(profileRecord.verification),
    agreements: sanitizePersistedAgreements(profileRecord.agreements),
    plan: normalizeStoredPlan(profileRecord.plan),
    planExpiry: profileRecord.plan_expiry ?? null,
    planBillingCycle: normalizeStoredBillingCycle(profileRecord.plan_billing_cycle),
    talentsUnlocked: Array.isArray(profileRecord.talents_unlocked)
      ? profileRecord.talents_unlocked.map((talentId) => Number(talentId)).filter(Boolean)
      : [],
  })
}

const buildSupabaseProfileRecord = (authUser = {}, user = {}) => {
  const normalizedUser = buildSupabaseUserDraft(authUser, user)

  return {
    id: trimText(normalizedUser.authUserId || authUser.id),
    email: trimText(normalizedUser.email).toLowerCase(),
    name: trimText(normalizedUser.name),
    role: normalizeStoredRole(normalizedUser.role),
    initials: trimText(normalizedUser.initials),
    avatar_url: trimText(normalizedUser.avatarUrl),
    avatar_storage: sanitizePersistedAvatarStorage(normalizedUser.avatarStorage),
    profile: normalizedUser.profile,
    verification: sanitizePersistedVerification(normalizedUser.verification),
    agreements: sanitizePersistedAgreements(normalizedUser.agreements),
    plan: normalizeStoredPlan(normalizedUser.plan),
    plan_expiry: normalizedUser.planExpiry ?? null,
    plan_billing_cycle: normalizedUser.planBillingCycle ?? null,
    talents_unlocked: normalizedUser.talentsUnlocked,
    profile_updated_at: normalizedUser.profileUpdatedAt ?? null,
  }
}

const readSupabaseProfileByAuthUserId = async (authUserId) => {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('*')
    .eq('id', trimText(authUserId))
    .maybeSingle()

  if (error) {
    throw new Error(readSupabaseErrorMessage(error, 'We could not load your profile right now.'))
  }

  return data ?? null
}

const writeSupabaseProfile = async (authUser, user) => {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .upsert(buildSupabaseProfileRecord(authUser, user), { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    throw new Error(readSupabaseErrorMessage(error, 'We could not save your profile right now.'))
  }

  return mapSupabaseProfileRecord(data, authUser)
}

const syncPendingSupabaseSignupDraft = async (authUser, currentUser) => {
  const pendingDraft = getPendingSupabaseSignupDraft(authUser?.email || currentUser?.email)

  if (!pendingDraft) {
    return currentUser
  }

  if (
    trimText(pendingDraft.authUserId) &&
    trimText(authUser?.id) &&
    trimText(pendingDraft.authUserId) !== trimText(authUser.id)
  ) {
    return currentUser
  }

  const normalizedCurrentUser = normalizeUserRecord(currentUser)
  const normalizedDraft = normalizeUserRecord(pendingDraft)
  const mergedUser = buildSupabaseUserDraft(authUser, {
    ...normalizedCurrentUser,
    name: trimText(normalizedDraft.name) || normalizedCurrentUser.name,
    initials: trimText(normalizedDraft.initials) || normalizedCurrentUser.initials,
    avatarUrl: trimText(normalizedDraft.avatarUrl) || normalizedCurrentUser.avatarUrl,
    avatarStorage:
      normalizedDraft.avatarStorage?.uploadId
        ? normalizedDraft.avatarStorage
        : normalizedCurrentUser.avatarStorage,
    createdAt: normalizedCurrentUser.createdAt ?? normalizedDraft.createdAt,
    profileUpdatedAt:
      normalizedDraft.profileUpdatedAt ||
      normalizedCurrentUser.profileUpdatedAt ||
      new Date().toISOString(),
    profile: {
      ...normalizedCurrentUser.profile,
      ...normalizedDraft.profile,
    },
    verification: {
      ...normalizedCurrentUser.verification,
      ...normalizedDraft.verification,
      documents: {
        ...normalizedCurrentUser.verification.documents,
        ...normalizedDraft.verification.documents,
      },
    },
    agreements: {
      ...sanitizePersistedAgreements(normalizedCurrentUser.agreements),
      ...sanitizePersistedAgreements(normalizedDraft.agreements),
    },
  })

  const persistedUser = await writeSupabaseProfile(authUser, mergedUser)
  removePendingSupabaseSignupDraft(authUser?.email || currentUser?.email)
  return persistedUser
}

const ensureSupabaseUserProfile = async (authUser, fallbackUser = null) => {
  if (!authUser) {
    throw new Error('Sign in before continuing.')
  }

  if (isSupabaseAdminUser(authUser)) {
    return mapSupabaseAdminUser(authUser)
  }

  const profileRecord = await readSupabaseProfileByAuthUserId(authUser.id)

  if (profileRecord) {
    return mapSupabaseProfileRecord(profileRecord, authUser)
  }

  return writeSupabaseProfile(authUser, fallbackUser ?? buildSupabaseUserDraft(authUser))
}

const syncSupabaseSessionUser = async (sessionOverride = null) => {
  const session =
    sessionOverride ??
    (await supabase.auth.getSession()).data.session

  if (!session?.user) {
    writeCurrentSession(null, '')
    return null
  }

  const nextUser = await ensureSupabaseUserProfile(session.user)
  const hydratedUser = await syncPendingSupabaseSignupDraft(session.user, nextUser)
  writeCurrentSession(hydratedUser, session.access_token ?? readStoredToken())
  return hydratedUser
}

const syncCurrentUserIfNeeded = (nextUser) => {
  const currentUser = readStoredCurrentUser()

  if (!currentUser || currentUser.id !== nextUser.id) {
    return
  }

  writeCurrentSession(nextUser, readStoredToken())
}

const rememberDeletedSeedUser = (user) => {
  const normalizedEmail = String(user?.email ?? '').trim().toLowerCase()
  const isSeedUser = seedUsers().some((seededUser) => seededUser.email.toLowerCase() === normalizedEmail)

  if (!isSeedUser) {
    return
  }

  const deletedSeedUsers = readDeletedSeedUserEmails()
  deletedSeedUsers.add(normalizedEmail)
  writeDeletedSeedUserEmails(deletedSeedUsers)
}

export const setCurrentSession = (user, token = readStoredToken()) => {
  writeCurrentSession(user, token)
}

export const clearCurrentSession = () => {
  if (SUPABASE_AUTH_ENABLED) {
    supabase.auth.signOut().catch(() => {})
  }

  writeCurrentSession(null, '')
}

export const hydrateCurrentUser = async () =>
  SUPABASE_AUTH_ENABLED ? syncSupabaseSessionUser() : getCurrentUser()

export const subscribeToUserUpdates = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getCurrentUser())
  window.addEventListener(USER_UPDATED_EVENT, handleUpdate)

  let authSubscription = null

  if (SUPABASE_AUTH_ENABLED) {
    hydrateCurrentUser().catch((error) => {
      console.warn(error)
      writeCurrentSession(null, '')
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSupabaseSessionUser(session).catch((error) => {
        console.warn(error)
        writeCurrentSession(null, '')
      })
    })

    authSubscription = data.subscription
  }

  return () => {
    window.removeEventListener(USER_UPDATED_EVENT, handleUpdate)
    authSubscription?.unsubscribe()
  }
}

export const getUsers = () => {
  const currentUser = readStoredCurrentUser()
  const localUsers = readUsers().map(sanitizeUser)

  if (currentUser && !localUsers.some((user) => user.id === currentUser.id)) {
    return [currentUser, ...localUsers]
  }

  return localUsers
}

export const isDemoUserId = (userId) => Number(userId) === DEMO_USER_ID

export const isDemoUser = (user) =>
  Number(user?.id) === DEMO_USER_ID ||
  String(user?.email ?? '').trim().toLowerCase() === DEMO_USER_EMAIL

export const getUserById = (userId) => {
  const normalizedUserId = Number(userId)
  const currentUser = readStoredCurrentUser()

  if (currentUser && Number(currentUser.id) === normalizedUserId) {
    return currentUser
  }

  const user = readUsers().find((candidate) => candidate.id === normalizedUserId)
  return user ? sanitizeUser(user) : null
}

export const updateUserProfile = async (userId, profileUpdates = {}) => {
  if (SUPABASE_AUTH_ENABLED) {
    return updateUserAccount(userId, { profile: profileUpdates })
  }

  let updatedUser = null
  const profileUpdatedAt = new Date().toISOString()

  const nextUsers = readUsers().map((user) => {
    if (user.id !== Number(userId)) {
      return user
    }

    updatedUser = normalizeUserRecord({
      ...user,
      profileUpdatedAt,
      profile: {
        ...normalizeUserRecord(user).profile,
        ...profileUpdates,
      },
    })

    return updatedUser
  })

  if (!updatedUser) {
    return null
  }

  writeUsers(nextUsers)
  syncCurrentUserIfNeeded(updatedUser)
  return sanitizeUser(updatedUser)
}

export const updateUserAccount = async (
  userId,
  {
    name,
    email,
    avatarUrl,
    avatarStorage,
    password,
    profile: profileUpdates = {},
  } = {},
) => {
  if (SUPABASE_AUTH_ENABLED) {
    const normalizedUserId = Number(userId)
    const currentUser = readStoredCurrentUser()

    if (!currentUser || Number(currentUser.id) !== normalizedUserId || !isSupabaseBackedUser(currentUser)) {
      throw new Error('We could not find that account to update it.')
    }

    const normalizedName = trimText(name ?? currentUser.name)
    const normalizedEmail = trimText(email ?? currentUser.email).toLowerCase()
    const normalizedPassword = trimText(password)
    const profileUpdatedAt = new Date().toISOString()

    if (!normalizedName) {
      throw new Error('Please enter your full name before saving changes.')
    }

    if (!normalizedEmail) {
      throw new Error('Please enter an email address before saving changes.')
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const authUser = sessionData.session?.user

    if (!authUser || trimText(authUser.id) !== trimText(currentUser.authUserId)) {
      throw new Error('Sign in again before saving account changes.')
    }

    let nextAuthUser = authUser
    const authUpdatePayload = {
      data: {
        name: normalizedName,
      },
    }
    const shouldUpdateEmail = normalizedEmail !== currentUser.email
    const shouldUpdatePassword = Boolean(normalizedPassword)
    const shouldUpdateName = normalizedName !== trimText(authUser.user_metadata?.name)

    if (shouldUpdateEmail) {
      authUpdatePayload.email = normalizedEmail
    }

    if (shouldUpdatePassword) {
      authUpdatePayload.password = normalizedPassword
    }

    if (shouldUpdateEmail || shouldUpdatePassword || shouldUpdateName) {
      const { data, error } = await supabase.auth.updateUser(authUpdatePayload)

      if (error) {
        throw new Error(readSupabaseErrorMessage(error, 'We could not update that account right now.'))
      }

      nextAuthUser = data?.user ?? authUser
    }

    const nextUser = buildSupabaseUserDraft(nextAuthUser, {
      ...currentUser,
      name: normalizedName,
      email: normalizedEmail,
      initials: getInitials(normalizedName),
      avatarUrl: trimText(avatarUrl ?? currentUser.avatarUrl) || createAvatarDataUrl(normalizedName),
      avatarStorage: avatarStorage ?? currentUser.avatarStorage,
      profileUpdatedAt,
      profile: {
        ...normalizeUserRecord(currentUser).profile,
        ...profileUpdates,
      },
    })
    const persistedUser = await writeSupabaseProfile(nextAuthUser, nextUser)
    setCurrentSession(persistedUser, sessionData.session?.access_token ?? readStoredToken())
    return persistedUser
  }

  const normalizedUserId = Number(userId)
  const users = readUsers()
  const currentUser = users.find((user) => user.id === normalizedUserId)

  if (!currentUser) {
    throw new Error('We could not find that account to update it.')
  }

  const normalizedName = String(name ?? currentUser.name).trim()
  const normalizedEmail = String(email ?? currentUser.email).trim().toLowerCase()
  const normalizedPassword = String(password ?? '').trim()
  const profileUpdatedAt = new Date().toISOString()

  if (!normalizedName) {
    throw new Error('Please enter your full name before saving changes.')
  }

  if (!normalizedEmail) {
    throw new Error('Please enter an email address before saving changes.')
  }

  if (
    users.some(
      (user) => user.id !== normalizedUserId && user.email.toLowerCase() === normalizedEmail,
    )
  ) {
    throw new Error('That email is already in use by another account.')
  }

  let updatedUser = null

  const nextUsers = users.map((user) => {
    if (user.id !== normalizedUserId) {
      return user
    }

    updatedUser = normalizeUserRecord({
      ...user,
      name: normalizedName,
      email: normalizedEmail,
      password: normalizedPassword || user.password,
      initials: getInitials(normalizedName),
      avatarUrl: String(avatarUrl ?? user.avatarUrl ?? '').trim() || createAvatarDataUrl(normalizedName),
      avatarStorage: avatarStorage ?? user.avatarStorage,
      profileUpdatedAt,
      profile: {
        ...normalizeUserRecord(user).profile,
        ...profileUpdates,
      },
    })

    return updatedUser
  })

  writeUsers(nextUsers)
  syncCurrentUserIfNeeded(updatedUser)
  return sanitizeUser(updatedUser)
}

export const updateUserMembership = (userId, membershipUpdates) => {
  if (SUPABASE_AUTH_ENABLED) {
    const normalizedUserId = Number(userId)
    const currentUser = readStoredCurrentUser()

    if (
      currentUser &&
      Number(currentUser.id) === normalizedUserId &&
      isSupabaseBackedUser(currentUser)
    ) {
      const updatedUser = sanitizeUser({
        ...currentUser,
        ...membershipUpdates,
        talentsUnlocked: Array.isArray(membershipUpdates.talentsUnlocked)
          ? membershipUpdates.talentsUnlocked.map((talentId) => Number(talentId)).filter(Boolean)
          : normalizeUserRecord(currentUser).talentsUnlocked,
      })

      setCurrentSession(updatedUser)
      supabase.auth.getSession()
        .then(({ data }) => {
          const authUser = data.session?.user

          if (!authUser || trimText(authUser.id) !== trimText(currentUser.authUserId)) {
            return
          }

          return writeSupabaseProfile(authUser, updatedUser)
        })
        .catch((error) => {
          console.warn(error)
        })

      return updatedUser
    }
  }

  let updatedUser = null

  const nextUsers = readUsers().map((user) => {
    if (user.id !== Number(userId)) {
      return user
    }

    updatedUser = {
      ...user,
      ...membershipUpdates,
      talentsUnlocked: Array.isArray(membershipUpdates.talentsUnlocked)
        ? membershipUpdates.talentsUnlocked.map((talentId) => Number(talentId)).filter(Boolean)
        : normalizeUserRecord(user).talentsUnlocked,
    }

    return updatedUser
  })

  if (!updatedUser) {
    return null
  }

  writeUsers(nextUsers)
  syncCurrentUserIfNeeded(updatedUser)
  return sanitizeUser(updatedUser)
}

export const deleteUserRecord = async (userId, { clearSession = true } = {}) => {
  const normalizedUserId = Number(userId)
  const currentUser = readStoredCurrentUser()

  if (
    SUPABASE_AUTH_ENABLED &&
    currentUser &&
    Number(currentUser.id) === normalizedUserId &&
    isSupabaseBackedUser(currentUser)
  ) {
    const deletedUser = sanitizeUser(currentUser)

    try {
      const response = await api.delete('/users/me')

      if (clearSession) {
        clearCurrentSession()
      } else {
        emitUserUpdate()
      }

      return {
        deletedUser,
        removedThreadCount: Number(response?.data?.removedThreadCount ?? 0) || 0,
        removedEventBookingCount: Number(response?.data?.removedEventBookingCount ?? 0) || 0,
        removedMembershipCount: Number(response?.data?.removedMembershipCount ?? 0) || 0,
        removedOrderCount: Number(response?.data?.removedOrderCount ?? 0) || 0,
      }
    } catch (error) {
      throw new Error(
        trimText(error?.response?.data?.message) ||
          trimText(error?.message) ||
          'We could not delete that account right now.',
      )
    }
  }

  const users = readUsers()
  const userToDelete = users.find((user) => user.id === normalizedUserId)

  if (!userToDelete) {
    throw new Error('We could not find that account to delete.')
  }

  rememberDeletedSeedUser(userToDelete)
  writeUsers(users.filter((user) => user.id !== normalizedUserId))

  if (clearSession && currentUser?.id === normalizedUserId) {
    clearCurrentSession()
  } else if (currentUser?.id !== normalizedUserId) {
    emitUserUpdate()
  }

  return sanitizeUser(userToDelete)
}

export const login = async (email, password) => {
  const users = readUsers()
  const normalizedEmail = email.trim().toLowerCase()
  const matchedUser = users.find((user) => user.email.toLowerCase() === normalizedEmail)

  if (!matchedUser || matchedUser.password !== password) {
    throw new Error('Incorrect email or password.')
  }

  return Promise.resolve({
    token: `mock_token_${matchedUser.id}`,
    user: sanitizeUser(matchedUser),
  })
}

export const loginAdmin = async (email, password) => {
  if (SUPABASE_AUTH_ENABLED) {
    const normalizedEmail = trimText(email).toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error || !data?.user || !data?.session?.access_token) {
      throw new Error(
        mapSupabaseAuthError(error, {
          fallbackMessage: 'Incorrect email or password.',
          email: normalizedEmail,
        }),
      )
    }

    if (!isSupabaseAdminUser(data.user)) {
      await supabase.auth.signOut()
      throw new Error('That account does not have admin access.')
    }

    return {
      token: data.session.access_token,
      user: mapSupabaseAdminUser(data.user),
    }
  }

  const response = await login(email, password)

  if (response.user.role !== ROLES.ADMIN) {
    throw new Error('That account does not have admin access.')
  }

  return response
}

export const loginPublicUser = async (email, password) => {
  if (SUPABASE_AUTH_ENABLED) {
    const normalizedEmail = trimText(email).toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error || !data?.user || !data?.session?.access_token) {
      throw new Error(
        mapSupabaseAuthError(error, {
          fallbackMessage: 'Incorrect email or password.',
          email: normalizedEmail,
          checkPendingSignup: true,
        }),
      )
    }

    if (isSupabaseAdminUser(data.user)) {
      await supabase.auth.signOut()
      throw new Error('Use the admin sign-in page for admin access.')
    }

    const user = await syncSupabaseSessionUser(data.session)
    return { token: data.session.access_token, user }
  }

  const response = await login(email, password)

  if (response.user.role === ROLES.ADMIN) {
    throw new Error('Use the admin sign-in page for admin access.')
  }

  return response
}

export const resendSignupConfirmation = async (email) => {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error('Email confirmations are not enabled in this environment.')
  }

  const normalizedEmail = trimText(email).toLowerCase()

  if (!normalizedEmail) {
    throw new Error('Enter your email address first so we know where to resend the confirmation link.')
  }

  const redirectUrl = buildAppRedirectUrl('/auth?mode=signin') || undefined
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: redirectUrl
      ? {
          emailRedirectTo: redirectUrl,
        }
      : undefined,
  })

  if (error) {
    throw new Error(
      mapSupabaseAuthError(error, {
        fallbackMessage: 'We could not resend the confirmation email right now.',
        email: normalizedEmail,
        checkPendingSignup: true,
      }),
    )
  }

  return true
}

export const requestPasswordReset = async (email) => {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error('Password reset is not enabled in this environment.')
  }

  const normalizedEmail = trimText(email).toLowerCase()

  if (!normalizedEmail) {
    throw new Error('Enter your email address first so we know where to send the reset link.')
  }

  const redirectUrl = buildAppRedirectUrl('/auth?mode=signin&flow=recovery') || undefined
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: redirectUrl,
  })

  if (error) {
    throw new Error(
      mapSupabaseAuthError(error, {
        fallbackMessage: 'We could not send a password reset email right now.',
        email: normalizedEmail,
      }),
    )
  }

  return true
}

export const completePasswordReset = async (password) => {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error('Password reset is not enabled in this environment.')
  }

  const nextPassword = String(password ?? '')

  if (!nextPassword.trim()) {
    throw new Error('Enter a new password before saving it.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const authUser = sessionData.session?.user

  if (!authUser) {
    throw new Error('Open the password reset link from your email again, then choose a new password.')
  }

  const { error } = await supabase.auth.updateUser({
    password: nextPassword,
  })

  if (error) {
    throw new Error(
      mapSupabaseAuthError(error, {
        fallbackMessage: 'We could not update your password right now.',
      }),
    )
  }

  return syncSupabaseSessionUser()
}

export const register = async ({
  admirationReason,
  avatarUpload,
  avatarUrl,
  avatarName,
  avatarUploadId,
  bio,
  city,
  country,
  countryCode,
  dateOfBirth,
  email,
  favoriteTalent,
  hobbies,
  interests,
  name,
  ndaAccepted,
  ndaAcceptedAt,
  occupation,
  password,
  phone,
  phoneDialCode,
  preferredContactMethod,
  verificationDocuments,
}) => {
  const users = readUsers()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()
  const normalizedPhone = String(phone ?? '').trim()
  const normalizedDateOfBirth = String(dateOfBirth ?? '').trim()
  const normalizedDocuments = {
    idFront: normalizeVerificationDocument(verificationDocuments?.idFront),
    idBack: normalizeVerificationDocument(verificationDocuments?.idBack),
    ssn: normalizeVerificationDocument(verificationDocuments?.ssn),
  }

  if (!normalizedName) {
    throw new Error('Please enter your full name before creating an account.')
  }

  if (!normalizedPhone) {
    throw new Error('Add a phone number so the concierge team can reach you when needed.')
  }

  if (!normalizedDateOfBirth || !isAdultDateOfBirth(normalizedDateOfBirth)) {
    throw new Error('CrownPoint accounts are limited to adults who are 18 or older.')
  }

  if (!ndaAccepted) {
    throw new Error('You must accept the confidentiality agreement before creating an account.')
  }

  const createdAt = new Date().toISOString()
  const hasSubmittedVerification = Object.values(normalizedDocuments).some((document) => document.uploadId)
  const normalizedAvatarUpload = normalizeManagedUpload(avatarUpload)
  const newUser = {
    id: Date.now(),
    name: normalizedName,
    email: normalizedEmail,
    password,
    role: ROLES.FAN,
    initials: getInitials(normalizedName),
    avatarUrl:
      trimText(normalizedAvatarUpload.publicUrl) ||
      avatarUrl?.trim() ||
      createAvatarDataUrl(normalizedName),
    avatarStorage: normalizedAvatarUpload,
    createdAt,
    profile: {
      phone: normalizedPhone,
      dateOfBirth: normalizedDateOfBirth,
      city: String(city ?? '').trim(),
      country: String(country ?? '').trim(),
      countryCode: String(countryCode ?? '').trim().toUpperCase(),
      phoneDialCode: String(phoneDialCode ?? '').trim(),
      bio: String(bio ?? '').trim(),
      admirationReason: String(admirationReason ?? '').trim(),
      hobbies: String(hobbies ?? '').trim(),
      interests: String(interests ?? '').trim(),
      favoriteTalent: String(favoriteTalent ?? '').trim(),
      occupation: String(occupation ?? '').trim(),
      preferredContactMethod:
        preferredContactMethod && Object.values(CONTACT_METHODS).includes(preferredContactMethod)
          ? preferredContactMethod
          : CONTACT_METHODS.EMAIL,
    },
    verification: {
      status: hasSubmittedVerification
        ? IDENTITY_VERIFICATION_STATUS.PENDING_REVIEW
        : IDENTITY_VERIFICATION_STATUS.NOT_SUBMITTED,
      submittedAt: hasSubmittedVerification ? createdAt : null,
      ageVerifiedAt: createdAt,
      isAdultVerified: true,
      documents: normalizedDocuments,
    },
    agreements: {
      interactionConfidentialityAcceptedAt: ndaAcceptedAt || createdAt,
    },
    ...defaultMembership,
  }

  if (SUPABASE_AUTH_ENABLED) {
    const redirectUrl = buildAppRedirectUrl('/auth?mode=signin')
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: normalizedName,
        },
        ...(redirectUrl
          ? {
              emailRedirectTo: redirectUrl,
            }
          : {}),
      },
    })

    if (error || !data?.user) {
      throw new Error(
        mapSupabaseAuthError(error, {
          fallbackMessage: 'We could not create that account right now.',
          email: normalizedEmail,
        }),
      )
    }

    if (!data.session?.user || !data.session?.access_token) {
      savePendingSupabaseSignupDraft({
        ...newUser,
        authUserId: data.user.id,
      })

      return {
        token: null,
        user: null,
        requiresConfirmation: true,
      }
    }

    removePendingSupabaseSignupDraft(normalizedEmail)
    const persistedUser = await writeSupabaseProfile(data.user, {
      ...newUser,
      authUserId: data.user.id,
    })
    setCurrentSession(persistedUser, data.session.access_token)

    return {
      token: data.session.access_token,
      user: persistedUser,
      requiresConfirmation: false,
    }
  }

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('That email is already in use.')
  }

  let devSignupRecord = null

  try {
    devSignupRecord = saveSignupRecordToDevStore({
      user: newUser,
      password,
      avatarUploadId,
      avatarName,
      verificationDocuments: normalizedDocuments,
      ndaAcceptedAt: ndaAcceptedAt || createdAt,
    })
    writeUsers([...users, newUser])
  } catch (error) {
    if (devSignupRecord?.id) {
      removeSignupRecordFromDevStore(devSignupRecord.id)
    }

    throw error
  }

  return Promise.resolve({
    token: `mock_token_${newUser.id}`,
    user: sanitizeUser(newUser),
    requiresConfirmation: false,
  })
}

export const logout = clearCurrentSession

export const getCurrentUser = () => readStoredCurrentUser()
