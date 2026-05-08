import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildOptimizedAvatarSources } from '../shared/wikimediaImage.mjs'
import { createDefaultPaymentSettingsByCurrency } from '../src/data/paymentOptions.js'
import {
  createEmptyCheckoutContact,
  createEmptyShippingAddress,
  getShippingAddressSummary,
  normalizeCheckoutContact,
  normalizeShippingAddress,
} from '../src/utils/checkout.js'
import {
  MEMBERSHIP_BILLING_CYCLES,
  MEMBERSHIP_DURATION_DAYS_BY_CYCLE,
  MEMBERSHIP_PLANS,
  MEMBERSHIP_STATUS,
  ORDER_STATUS,
  ORDER_TYPES,
  PAYMENT_METHODS,
} from '../src/utils/constants.js'
import {
  normalizeAverageRating,
  normalizeNonNegativeNumber,
  normalizeReviewRating,
  normalizeTalent,
  trimText,
} from './talentRecordModel.mjs'

const API_PORT = Number(process.env.PORT || process.env.TALENT_API_PORT || 3001)
const TALENTS_TABLE = 'talents'
const USER_PROFILES_TABLE = 'user_profiles'
const PAYMENT_SETTINGS_TABLE = 'payment_settings'
const MEMBERSHIP_REQUESTS_TABLE = 'membership_requests'
const ORDERS_TABLE = 'orders'
const EVENT_BOOKING_REQUESTS_TABLE = 'event_booking_requests'
const MESSAGE_THREADS_TABLE = 'message_threads'
const THREAD_MESSAGES_TABLE = 'thread_messages'
const PAYMENT_PROOFS_BUCKET = 'payment-proofs'
const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments'
const PROFILE_AVATARS_BUCKET = 'profile-avatars'
const VERIFICATION_DOCUMENTS_BUCKET = 'verification-documents'
const FEATURED_TALENT_LIMIT = 6
const EVENT_BOOKING_REQUEST_STATUS = {
  NEW: 'NEW',
  IN_REVIEW: 'IN_REVIEW',
  IN_TOUCH: 'IN_TOUCH',
  CLOSED: 'CLOSED',
}
const MESSAGE_ROLES = {
  FAN: 'fan',
  TALENT: 'talent',
  SYSTEM: 'system',
}
const SUPABASE_PAGE_SIZE = 1000
const MESSAGE_THREAD_HYDRATION_BATCH_SIZE = 100
const MEMBERSHIP_PRICE_USD_BY_PLAN = {
  [MEMBERSHIP_PLANS.FREE]: {
    [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 0,
    [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 0,
  },
  [MEMBERSHIP_PLANS.INNER_CIRCLE]: {
    [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 500,
    [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 4800,
  },
  [MEMBERSHIP_PLANS.CROWN_ACCESS]: {
    [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 2500,
    [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 24000,
  },
}
const defaultPaymentSettingsByCurrency = createDefaultPaymentSettingsByCurrency()
const supportedPaymentCurrencyCodes = new Set(Object.keys(defaultPaymentSettingsByCurrency))
const projectRoot = process.cwd()
const distPath = path.resolve(
  projectRoot,
  process.env.FRONTEND_DIST_PATH || 'dist',
)
const catalogPath = path.resolve(
  projectRoot,
  process.env.TALENT_CATALOG_PATH || 'public/data/talents.catalog.json',
)
const directExecutionEntryPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
const currentModulePath = fileURLToPath(import.meta.url)
const runningAsStandaloneServer = directExecutionEntryPath === currentModulePath
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseServerConfigured = Boolean(supabaseUrl) && Boolean(supabaseServiceRoleKey)
const supabaseTalentsEnabled =
  String(process.env.VITE_USE_SUPABASE_TALENTS ?? '').toLowerCase() === 'true' &&
  supabaseServerConfigured
const supabaseAdmin = supabaseServerConfigured
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null
const adminUserIds = new Set(
  String(process.env.TALENT_API_ADMIN_USER_IDS ?? '2')
    .split(',')
    .map((value) => trimText(value))
    .filter(Boolean),
)
const supabaseAuthEnabled =
  String(process.env.VITE_USE_SUPABASE_AUTH ?? '').toLowerCase() === 'true'
const allowMockAdminTokens =
  String(process.env.TALENT_API_ALLOW_MOCK_ADMIN ?? (supabaseAuthEnabled ? 'false' : 'true'))
    .toLowerCase() === 'true'
const adminEmails = new Set(
  String(process.env.TALENT_API_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => trimText(value).toLowerCase())
    .filter(Boolean),
)
const localCatalogMirrorEnabled =
  String(
    process.env.TALENT_API_ENABLE_LOCAL_CATALOG_MIRROR ??
      (process.env.VERCEL ? 'false' : 'true'),
  ).toLowerCase() === 'true'

const createHttpError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  response.end(`${JSON.stringify(payload, null, 2)}\n`)
}

const sendEmpty = (response, statusCode = 204) => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  response.end()
}

const STATIC_FILE_CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

const readSafeStaticFile = async (requestPath = '/') => {
  const normalizedRequestPath = requestPath === '/' ? '/index.html' : requestPath
  const relativeFilePath = normalizedRequestPath.replace(/^\/+/, '')
  const resolvedFilePath = path.resolve(distPath, relativeFilePath)

  if (!resolvedFilePath.startsWith(distPath)) {
    return null
  }

  try {
    return {
      buffer: await readFile(resolvedFilePath),
      filePath: resolvedFilePath,
    }
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return null
    }

    throw error
  }
}

const sendStaticFile = (request, response, fileBuffer, filePath) => {
  const fileExtension = path.extname(filePath).toLowerCase()
  const contentType =
    STATIC_FILE_CONTENT_TYPES.get(fileExtension) || 'application/octet-stream'
  const isVersionedAsset =
    filePath.includes(`${path.sep}assets${path.sep}`) &&
    /-[A-Za-z0-9_-]{6,}\./.test(path.basename(filePath))

  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': isVersionedAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  response.end(fileBuffer)
}

const serveBuiltFrontend = async (request, response, requestUrl) => {
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    return false
  }

  const directFile = await readSafeStaticFile(requestUrl.pathname || '/')

  if (directFile) {
    sendStaticFile(request, response, directFile.buffer, directFile.filePath)
    return true
  }

  if (path.extname(requestUrl.pathname || '')) {
    return false
  }

  const appShell = await readSafeStaticFile('/index.html')

  if (!appShell) {
    return false
  }

  sendStaticFile(request, response, appShell.buffer, appShell.filePath)
  return true
}

const readCatalog = async () => {
  const fileBuffer = await readFile(catalogPath)
  const parsed = JSON.parse(fileBuffer.toString('utf8'))

  if (!Array.isArray(parsed)) {
    throw createHttpError(500, 'Talent catalog must contain a top-level array.')
  }

  return parsed
}

const writeCatalog = async (records) => {
  await mkdir(path.dirname(catalogPath), { recursive: true })
  await writeFile(catalogPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

const enrichTalentAvatarSources = (record = {}) => {
  const avatarSeed = String(record.avatarOriginalUrl ?? record.avatarUrl ?? '').trim()
  const avatarSources = buildOptimizedAvatarSources(avatarSeed)

  return {
    ...record,
    avatarUrl: avatarSources.avatarOriginalUrl,
    avatarOriginalUrl: avatarSources.avatarOriginalUrl,
    avatarThumbnailUrl: avatarSources.avatarThumbnailUrl,
    avatarSrcSet: avatarSources.avatarSrcSet,
  }
}

const normalizeTalentRecord = (record = {}, index = 0) =>
  normalizeTalent(enrichTalentAvatarSources(record), index)

const collectJsonBody = async (request) => {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim()

  if (!rawBody) {
    return {}
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    throw createHttpError(400, 'Send a valid JSON body.')
  }
}

const resolveTalentId = (value) => {
  const talentId = Number(value)
  return Number.isFinite(talentId) ? talentId : null
}

const getNextTalentId = (records = []) =>
  records.reduce((highestId, record) => {
    const talentId = Number(record?.id)
    return Number.isFinite(talentId) ? Math.max(highestId, talentId) : highestId
  }, 0) + 1

const readBearerToken = (request) => {
  const authorizationHeader = String(request.headers.authorization ?? '').trim()

  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return ''
  }

  return authorizationHeader.slice(7).trim()
}

const isMockAdminToken = (token) => {
  if (!token.startsWith('mock_token_')) {
    return false
  }

  const userId = trimText(token.slice('mock_token_'.length))
  return adminUserIds.has(userId)
}

const normalizeRole = (value) => trimText(value).toUpperCase()

const collectMetadataRoles = (metadata = {}) => {
  const roles = []
  const singleRole = normalizeRole(metadata.role)

  if (singleRole) {
    roles.push(singleRole)
  }

  if (Array.isArray(metadata.roles)) {
    roles.push(...metadata.roles.map(normalizeRole).filter(Boolean))
  }

  return roles
}

const isSupabaseAdminUser = (user = {}) => {
  const normalizedUser = user && typeof user === 'object' ? user : {}
  const roles = [
    ...collectMetadataRoles(normalizedUser.app_metadata),
    ...collectMetadataRoles(normalizedUser.user_metadata),
  ]
  const email = trimText(normalizedUser.email).toLowerCase()

  return roles.includes('ADMIN') || (email && adminEmails.has(email))
}

const requireAdminAccess = async (request) => {
  const token = readBearerToken(request)

  if (allowMockAdminTokens && isMockAdminToken(token)) {
    return
  }

  if (!token) {
    throw createHttpError(
      403,
      'Admin access is required for this talent change. Sign in through /admin-login and keep the local API running.',
    )
  }

  if (!supabaseAdmin) {
    throw createHttpError(
      503,
      'Supabase admin auth is not configured for talent changes. Add SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL on the API server.',
    )
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (!error && data?.user && isSupabaseAdminUser(data.user)) {
    return
  }

  throw createHttpError(
    403,
    'Admin access is required for this talent change. Sign in with a Supabase admin account or a permitted local admin session.',
  )
}

const ensureSupabaseApiConfigured = (fallbackMessage) => {
  if (supabaseAdmin) {
    return
  }

  throw createHttpError(
    503,
    fallbackMessage ||
      'The Supabase-backed API is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL on the API server.',
  )
}

const readAuthenticatedUser = async (request) => {
  const token = readBearerToken(request)

  if (!token) {
    return null
  }

  if (allowMockAdminTokens && isMockAdminToken(token)) {
    return null
  }

  ensureSupabaseApiConfigured()
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data?.user) {
    return null
  }

  return data.user
}

const requireAuthenticatedUser = async (request, message = 'Sign in before continuing.') => {
  const authUser = await readAuthenticatedUser(request)

  if (!authUser) {
    throw createHttpError(401, message)
  }

  return authUser
}

const readUserProfileByAuthUserId = async (authUserId) => {
  ensureSupabaseApiConfigured()
  const normalizedAuthUserId = trimText(authUserId)

  if (!normalizedAuthUserId) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(USER_PROFILES_TABLE)
    .select('*')
    .eq('id', normalizedAuthUserId)
    .maybeSingle()

  if (error) {
    throw createHttpError(502, `Supabase profile lookup failed: ${error.message}`)
  }

  return data ?? null
}

const requireUserProfileByAuthUserId = async (authUserId) => {
  const profile = await readUserProfileByAuthUserId(authUserId)

  if (!profile) {
    throw createHttpError(404, 'We could not find that user profile right now.')
  }

  return profile
}

const normalizeCurrencyCode = (value, fallback = 'USD') => {
  const normalized = trimText(value).toUpperCase()
  return supportedPaymentCurrencyCodes.has(normalized) ? normalized : fallback
}

const normalizePaymentMethod = (value, fallback = PAYMENT_METHODS.BANK) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(PAYMENT_METHODS).includes(normalized) ? normalized : fallback
}

const normalizeMembershipPlan = (value, fallback = MEMBERSHIP_PLANS.INNER_CIRCLE) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(MEMBERSHIP_PLANS).includes(normalized) ? normalized : fallback
}

const normalizeMembershipBillingCycle = (
  value,
  fallback = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(MEMBERSHIP_BILLING_CYCLES).includes(normalized) ? normalized : fallback
}

const normalizeMembershipStatus = (value, fallback = MEMBERSHIP_STATUS.UNDER_REVIEW) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(MEMBERSHIP_STATUS).includes(normalized) ? normalized : fallback
}

const normalizeOrderType = (value, fallback = ORDER_TYPES.SERVICE) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(ORDER_TYPES).includes(normalized) ? normalized : fallback
}

const normalizeOrderStatus = (value, fallback = ORDER_STATUS.PENDING_PAYMENT) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(ORDER_STATUS).includes(normalized) ? normalized : fallback
}

const normalizeRiskLevel = (value, fallback = 'low') => {
  const normalized = trimText(value).toLowerCase()
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : fallback
}

const toNumberOrNull = (value) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

const chunkArray = (items = [], chunkSize = 1) => {
  const normalizedChunkSize = Math.max(1, Number(chunkSize) || 1)
  const chunks = []

  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize))
  }

  return chunks
}

const readAllSupabaseRows = async (
  createQuery,
  {
    pageSize = SUPABASE_PAGE_SIZE,
    errorMessage = 'Supabase query failed.',
  } = {},
) => {
  const normalizedPageSize = Math.max(1, Number(pageSize) || SUPABASE_PAGE_SIZE)
  const rows = []

  for (let offset = 0; ; offset += normalizedPageSize) {
    const { data, error } = await createQuery().range(
      offset,
      offset + normalizedPageSize - 1,
    )

    if (error) {
      throw createHttpError(502, `${errorMessage}: ${error.message}`)
    }

    const nextRows = data ?? []
    rows.push(...nextRows)

    if (nextRows.length < normalizedPageSize) {
      return rows
    }
  }
}

const getMembershipRiskLevel = (paymentMethod) =>
  normalizePaymentMethod(paymentMethod) === PAYMENT_METHODS.CRYPTO ? 'medium' : 'low'

const getOrderRiskLevel = (paymentMethod) => {
  switch (normalizePaymentMethod(paymentMethod)) {
    case PAYMENT_METHODS.CRYPTO:
      return 'high'
    case PAYMENT_METHODS.GIFT_CARD:
      return 'medium'
    default:
      return 'low'
  }
}

const getOrderEtaForStatus = (status, orderType = ORDER_TYPES.SERVICE) => {
  switch (normalizeOrderStatus(status)) {
    case ORDER_STATUS.UNDER_REVIEW:
      return 'Awaiting payment check'
    case ORDER_STATUS.FLAGGED:
      return 'Flagged for manual review'
    case ORDER_STATUS.PAID:
      return normalizeOrderType(orderType) === ORDER_TYPES.TICKET
        ? 'Tickets are being released'
        : 'Payment approved / fulfillment preparing'
    case ORDER_STATUS.IN_PROGRESS:
      return normalizeOrderType(orderType) === ORDER_TYPES.TICKET
        ? 'Ticket confirmation preparing'
        : 'Fulfillment in motion'
    case ORDER_STATUS.COMPLETED:
      return 'Order completed'
    case ORDER_STATUS.FAILED:
      return 'Payment was rejected'
    case ORDER_STATUS.CANCELLED:
      return 'Order cancelled'
    default:
      return ''
  }
}

const buildOrderProofSummary = (order = {}) => {
  if (trimText(order.proofSummary)) {
    return trimText(order.proofSummary)
  }

  switch (normalizePaymentMethod(order.paymentMethod, '')) {
    case PAYMENT_METHODS.GIFT_CARD:
      return trimText(order.paymentProof)
        ? `Gift card code ${trimText(order.paymentProof)} submitted for manual validation.`
        : 'Gift card code submitted for manual validation.'
    case PAYMENT_METHODS.CRYPTO:
      return trimText(order.paymentProof)
        ? `Crypto transaction hash ${trimText(order.paymentProof)} submitted for verification.`
        : 'Crypto transaction hash submitted for verification.'
    case PAYMENT_METHODS.BANK:
    default:
      return trimText(order.paymentProofFileName)
        ? `Payment proof uploaded: ${trimText(order.paymentProofFileName)}.`
        : 'Payment proof uploaded for review.'
  }
}

const defaultOrderPayload = {
  userId: null,
  fanName: 'Guest Checkout',
  email: '',
  orderType: ORDER_TYPES.SERVICE,
  talent: null,
  talentName: 'Selected talent',
  service: null,
  event: null,
  ticketTier: null,
  recipient: '',
  occasion: '',
  tone: '',
  deliveryWindow: '',
  note: '',
  itemLabel: '',
  refCode: '',
  totalPrice: 0,
  items: [],
  status: ORDER_STATUS.PENDING_PAYMENT,
  paymentMethod: null,
  paymentProof: '',
  paymentProofFileName: '',
  giftCardBrand: '',
  cryptoAsset: '',
  cryptoNetwork: '',
  contact: createEmptyCheckoutContact(),
  shippingAddress: createEmptyShippingAddress(),
  proofSummary: '',
  region: 'Local testing',
  risk: 'low',
  eta: '',
  requestedFor: '',
  createdAt: null,
  submittedAt: null,
  reviewedAt: null,
}

const normalizeOrderPayload = (order = {}) => {
  const normalizedOrderType = normalizeOrderType(order.orderType)
  const totalPrice =
    typeof order.totalPrice === 'number'
      ? order.totalPrice
      : typeof order.amount === 'number'
        ? order.amount
        : Number(order.totalPrice ?? order.amount ?? 0) || 0
  const createdAt =
    order.createdAt ??
    order.submittedAt ??
    (order.date ? new Date(order.date).toISOString() : null)
  const submittedAt = order.submittedAt ?? createdAt
  const contact = normalizeCheckoutContact(order.contact)
  const shippingAddress = normalizeShippingAddress(order.shippingAddress)
  const requestedFor =
    trimText(order.requestedFor) ||
    (normalizedOrderType === ORDER_TYPES.SHOP ? getShippingAddressSummary(shippingAddress) : '')
  const normalized = {
    ...defaultOrderPayload,
    ...order,
    userId: order.userId == null ? null : toNumberOrNull(order.userId),
    fanName: trimText(order.fanName) || defaultOrderPayload.fanName,
    email: trimText(order.email),
    orderType: normalizedOrderType,
    contact,
    shippingAddress,
    refCode: trimText(order.refCode).toUpperCase(),
    totalPrice,
    items: Array.isArray(order.items) ? order.items : [],
    talentName: trimText(order.talentName || order.talent?.name) || defaultOrderPayload.talentName,
    paymentMethod: trimText(order.paymentMethod) ? normalizePaymentMethod(order.paymentMethod) : null,
    paymentProof: trimText(order.paymentProof),
    paymentProofFileName: trimText(order.paymentProofFileName),
    proofUpload: normalizeStoredUpload(order.proofUpload),
    giftCardBrand: trimText(order.giftCardBrand),
    cryptoAsset: trimText(order.cryptoAsset),
    cryptoNetwork: trimText(order.cryptoNetwork),
    recipient: trimText(order.recipient),
    occasion: trimText(order.occasion),
    tone: trimText(order.tone),
    deliveryWindow: trimText(order.deliveryWindow),
    note: trimText(order.note),
    itemLabel: trimText(order.itemLabel),
    requestedFor,
    region: trimText(order.region || shippingAddress.country) || defaultOrderPayload.region,
    createdAt,
    submittedAt,
    reviewedAt: order.reviewedAt ?? null,
  }

  return {
    ...normalized,
    proofSummary: buildOrderProofSummary(normalized),
    risk: normalizeRiskLevel(order.risk, getOrderRiskLevel(normalized.paymentMethod)),
    eta: trimText(order.eta) || getOrderEtaForStatus(normalized.status, normalized.orderType),
  }
}

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
  if (normalizeMembershipPlan(request.plan) === MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return []
  }

  const talentId = toNumberOrNull(request.talentId)
  return talentId ? [talentId] : []
}

const getMembershipPriceUsd = (
  plan,
  billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY,
) =>
  MEMBERSHIP_PRICE_USD_BY_PLAN[normalizeMembershipPlan(plan)]?.[
    normalizeMembershipBillingCycle(billingCycle)
  ] ??
  MEMBERSHIP_PRICE_USD_BY_PLAN[normalizeMembershipPlan(plan)]?.[
    MEMBERSHIP_BILLING_CYCLES.MONTHLY
  ] ??
  0

const normalizeStoredUpload = (upload = {}) => {
  const normalizedUpload = upload && typeof upload === 'object' ? upload : {}

  return {
    uploadId: trimText(normalizedUpload.uploadId),
    bucket: trimText(normalizedUpload.bucket),
    storagePath: trimText(normalizedUpload.storagePath),
    fileName: trimText(normalizedUpload.fileName || normalizedUpload.name),
    mimeType: trimText(normalizedUpload.mimeType || normalizedUpload.type),
    size: Number(normalizedUpload.size ?? 0) || 0,
    uploadedAt: normalizedUpload.uploadedAt ?? normalizedUpload.createdAt ?? null,
  }
}

const sanitizePaymentSettingsText = (value) => trimText(value)

const normalizePaymentSettingsBankDetails = (details = []) =>
  (Array.isArray(details) ? details : [])
    .map((detail, index) => ({
      id: trimText(detail?.id) || `bank-${index + 1}`,
      label: sanitizePaymentSettingsText(detail?.label),
      value: sanitizePaymentSettingsText(detail?.value),
    }))
    .filter((detail) => detail.label || detail.value)

const normalizePaymentSettingsGiftCards = (giftCards = []) =>
  (Array.isArray(giftCards) ? giftCards : [])
    .map((card, index) => ({
      id: trimText(card?.id) || `gift-card-${index + 1}`,
      label: sanitizePaymentSettingsText(card?.label),
    }))
    .filter((card) => card.label)

const normalizePaymentSettingsCryptoAssets = (cryptoAssets = []) =>
  (Array.isArray(cryptoAssets) ? cryptoAssets : [])
    .map((asset, assetIndex) => ({
      id: trimText(asset?.id) || `asset-${assetIndex + 1}`,
      label: sanitizePaymentSettingsText(asset?.label),
      networks: (Array.isArray(asset?.networks) ? asset.networks : [])
        .map((network, networkIndex) => ({
          id: trimText(network?.id) || `network-${assetIndex + 1}-${networkIndex + 1}`,
          label: sanitizePaymentSettingsText(network?.label),
          wallet: sanitizePaymentSettingsText(network?.wallet),
        }))
        .filter((network) => network.label || network.wallet),
    }))
    .filter((asset) => asset.label || asset.networks.length)

const normalizePaymentSettingsPayload = (settings = {}, currencyCode) => {
  const defaults = defaultPaymentSettingsByCurrency[normalizeCurrencyCode(currencyCode)]
  const bank = settings?.bank && typeof settings.bank === 'object' ? settings.bank : {}

  return {
    currencyCode: normalizeCurrencyCode(currencyCode),
    bank: {
      referencePrefix:
        sanitizePaymentSettingsText(bank.referencePrefix) || defaults.bank.referencePrefix,
      instructions:
        sanitizePaymentSettingsText(bank.instructions) || defaults.bank.instructions,
      details: normalizePaymentSettingsBankDetails(bank.details).length
        ? normalizePaymentSettingsBankDetails(bank.details)
        : defaults.bank.details,
    },
    giftCards: normalizePaymentSettingsGiftCards(settings?.giftCards).length
      ? normalizePaymentSettingsGiftCards(settings?.giftCards)
      : defaults.giftCards,
    cryptoAssets: normalizePaymentSettingsCryptoAssets(settings?.cryptoAssets).length
      ? normalizePaymentSettingsCryptoAssets(settings?.cryptoAssets)
      : defaults.cryptoAssets,
  }
}

const toPaymentSettingsRecord = (record = {}, currencyCode) => ({
  currencyCode: normalizeCurrencyCode(record.currency_code || currencyCode),
  settings: normalizePaymentSettingsPayload(record.settings, record.currency_code || currencyCode),
  updatedAt: record.updated_at ?? record.created_at ?? null,
  updatedBy: trimText(record.updated_by_name),
  revision: Number(record.revision ?? 0) || 0,
})

const listPaymentSettingsInSupabase = async () => {
  ensureSupabaseApiConfigured()
  const { data, error } = await supabaseAdmin
    .from(PAYMENT_SETTINGS_TABLE)
    .select('*')
    .order('currency_code', { ascending: true })

  if (error) {
    throw createHttpError(502, `Supabase payment settings read failed: ${error.message}`)
  }

  const recordsByCurrencyCode = new Map(
    (data ?? []).map((record) => [
      normalizeCurrencyCode(record.currency_code),
      toPaymentSettingsRecord(record, record.currency_code),
    ]),
  )

  return [...supportedPaymentCurrencyCodes]
    .sort()
    .map((currencyCode) => {
      const existingRecord = recordsByCurrencyCode.get(currencyCode)

      if (existingRecord) {
        return existingRecord
      }

      return {
        currencyCode,
        settings: normalizePaymentSettingsPayload(
          defaultPaymentSettingsByCurrency[currencyCode],
          currencyCode,
        ),
        updatedAt: null,
        updatedBy: '',
        revision: 0,
      }
    })
}

const updatePaymentSettingsInSupabase = async (request, currencyCode, payload = {}) => {
  ensureSupabaseApiConfigured()
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode)
  const authUser = await readAuthenticatedUser(request)
  const updatedByName =
    trimText(payload.updatedByName) ||
    trimText(authUser?.user_metadata?.name) ||
    trimText(authUser?.email) ||
    'Admin desk'
  const settings = normalizePaymentSettingsPayload(payload.settings, normalizedCurrencyCode)

  const { data: currentRecord, error: currentRecordError } = await supabaseAdmin
    .from(PAYMENT_SETTINGS_TABLE)
    .select('revision')
    .eq('currency_code', normalizedCurrencyCode)
    .maybeSingle()

  if (currentRecordError) {
    throw createHttpError(
      502,
      `Supabase payment settings lookup failed: ${currentRecordError.message}`,
    )
  }

  const nextRevision = (Number(currentRecord?.revision ?? 0) || 0) + 1
  const { data, error } = await supabaseAdmin
    .from(PAYMENT_SETTINGS_TABLE)
    .upsert({
      currency_code: normalizedCurrencyCode,
      settings,
      updated_by_auth_user_id: trimText(authUser?.id) || null,
      updated_by_name: updatedByName,
      revision: nextRevision,
    }, {
      onConflict: 'currency_code',
    })
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase payment settings write failed: ${error.message}`)
  }

  return toPaymentSettingsRecord(data, normalizedCurrencyCode)
}

const fromMembershipRequestRow = (record = {}) => ({
  id: Number(record.id) || 0,
  userId: toNumberOrNull(record.user_public_id),
  authUserId: trimText(record.auth_user_id),
  fanName: trimText(record.fan_name),
  email: trimText(record.email).toLowerCase(),
  plan: normalizeMembershipPlan(record.plan),
  billingCycle: normalizeMembershipBillingCycle(record.billing_cycle),
  talentId: toNumberOrNull(record.talent_id),
  talentName: trimText(record.talent_name) || 'All talents',
  amountUsd: Number(record.amount_usd ?? 0) || 0,
  currencyCode: normalizeCurrencyCode(record.currency_code),
  region: trimText(record.region),
  paymentMethod: normalizePaymentMethod(record.payment_method),
  proofSummary: trimText(record.proof_summary),
  proofFileName: trimText(record.proof_file_name),
  proofUpload: normalizeStoredUpload(record.proof_upload),
  submittedAt: record.submitted_at ?? record.created_at ?? new Date().toISOString(),
  status: normalizeMembershipStatus(record.status),
  risk: normalizeRiskLevel(record.risk, getMembershipRiskLevel(record.payment_method)),
  activatedAt: record.activated_at ?? null,
  reviewedAt: record.reviewed_at ?? null,
})

const toMembershipRequestRow = (request = {}) => ({
  auth_user_id: trimText(request.authUserId),
  user_public_id: toNumberOrNull(request.userId),
  fan_name: trimText(request.fanName),
  email: trimText(request.email).toLowerCase(),
  plan: normalizeMembershipPlan(request.plan),
  billing_cycle: normalizeMembershipBillingCycle(request.billingCycle),
  talent_id: toNumberOrNull(request.talentId),
  talent_name: trimText(request.talentName) || 'All talents',
  amount_usd: Number(request.amountUsd ?? 0) || 0,
  currency_code: normalizeCurrencyCode(request.currencyCode),
  region: trimText(request.region),
  payment_method: normalizePaymentMethod(request.paymentMethod),
  proof_summary: trimText(request.proofSummary),
  proof_file_name: trimText(request.proofFileName),
  proof_upload: normalizeStoredUpload(request.proofUpload),
  status: normalizeMembershipStatus(request.status),
  risk: normalizeRiskLevel(request.risk, getMembershipRiskLevel(request.paymentMethod)),
  activated_at: request.activatedAt ?? null,
  reviewed_at: request.reviewedAt ?? null,
  submitted_at: request.submittedAt ?? new Date().toISOString(),
})

const fromOrderRow = (record = {}) => {
  const payload =
    record.order_payload && typeof record.order_payload === 'object'
      ? record.order_payload
      : {}

  return normalizeOrderPayload({
    ...payload,
    id: Number(record.id) || 0,
    userId: toNumberOrNull(record.user_public_id) ?? payload.userId ?? null,
    authUserId: trimText(record.auth_user_id) || trimText(payload.authUserId),
    fanName: trimText(record.fan_name) || payload.fanName,
    email: trimText(record.email) || payload.email,
    orderType: normalizeOrderType(record.order_type, payload.orderType),
    talentName: trimText(record.talent_name) || payload.talentName,
    refCode: trimText(record.ref_code) || payload.refCode,
    totalPrice: Number(record.total_price ?? payload.totalPrice ?? 0) || 0,
    status: normalizeOrderStatus(record.status, payload.status),
    paymentMethod: trimText(record.payment_method)
      ? normalizePaymentMethod(record.payment_method)
      : payload.paymentMethod,
    paymentProof: trimText(record.payment_proof) || payload.paymentProof,
    paymentProofFileName: trimText(record.payment_proof_file_name) || payload.paymentProofFileName,
    proofSummary: trimText(record.proof_summary) || payload.proofSummary,
    proofUpload: normalizeStoredUpload(record.proof_upload || payload.proofUpload),
    requestedFor: trimText(record.requested_for) || payload.requestedFor,
    region: trimText(record.region) || payload.region,
    risk: normalizeRiskLevel(record.risk, payload.risk || getOrderRiskLevel(record.payment_method)),
    eta: trimText(record.eta) || payload.eta,
    createdAt: record.created_at ?? payload.createdAt,
    submittedAt: record.submitted_at ?? payload.submittedAt,
    reviewedAt: record.reviewed_at ?? payload.reviewedAt ?? null,
  })
}

const toOrderRow = (order = {}) => {
  const normalizedOrder = normalizeOrderPayload(order)

  return {
    auth_user_id: trimText(normalizedOrder.authUserId) || null,
    user_public_id: toNumberOrNull(normalizedOrder.userId),
    fan_name: trimText(normalizedOrder.fanName) || defaultOrderPayload.fanName,
    email: trimText(normalizedOrder.email),
    order_type: normalizeOrderType(normalizedOrder.orderType),
    talent_id: toNumberOrNull(normalizedOrder.talent?.id ?? normalizedOrder.talentId),
    talent_name: trimText(normalizedOrder.talentName || normalizedOrder.talent?.name) || defaultOrderPayload.talentName,
    ref_code: trimText(normalizedOrder.refCode).toUpperCase(),
    total_price: Number(normalizedOrder.totalPrice ?? 0) || 0,
    status: normalizeOrderStatus(normalizedOrder.status, ORDER_STATUS.UNDER_REVIEW),
    payment_method: normalizedOrder.paymentMethod
      ? normalizePaymentMethod(normalizedOrder.paymentMethod)
      : null,
    payment_proof: trimText(normalizedOrder.paymentProof),
    payment_proof_file_name: trimText(normalizedOrder.paymentProofFileName),
    proof_summary: trimText(normalizedOrder.proofSummary),
    proof_upload: normalizeStoredUpload(normalizedOrder.proofUpload),
    requested_for: trimText(normalizedOrder.requestedFor),
    region: trimText(normalizedOrder.region),
    risk: normalizeRiskLevel(normalizedOrder.risk, getOrderRiskLevel(normalizedOrder.paymentMethod)),
    eta: trimText(normalizedOrder.eta),
    order_payload: normalizedOrder,
    reviewed_at: normalizedOrder.reviewedAt ?? null,
    submitted_at: normalizedOrder.submittedAt ?? new Date().toISOString(),
    created_at: normalizedOrder.createdAt ?? new Date().toISOString(),
  }
}

const normalizeEventBookingStatus = (
  value,
  fallback = EVENT_BOOKING_REQUEST_STATUS.NEW,
) => {
  const normalized = trimText(value).toUpperCase()
  return Object.values(EVENT_BOOKING_REQUEST_STATUS).includes(normalized)
    ? normalized
    : fallback
}

const normalizeEventDate = (value) => {
  const normalizedValue = trimText(value)

  if (!normalizedValue) {
    return null
  }

  const normalizedDate = new Date(normalizedValue)

  if (Number.isNaN(normalizedDate.getTime())) {
    return null
  }

  return normalizedDate.toISOString().slice(0, 10)
}

const defaultEventBookingPayload = {
  userId: null,
  authUserId: '',
  talentId: null,
  talentName: '',
  celebrityName: '',
  eventDate: '',
  approximateBudget: '',
  eventType: '',
  eventLocation: '',
  additionalInfo: '',
  fullName: '',
  organizationName: '',
  jobTitle: '',
  phoneNumber: '',
  emailAddress: '',
  fullAddress: '',
  nearestAirport: '',
  status: EVENT_BOOKING_REQUEST_STATUS.NEW,
  submittedAt: null,
  reviewedAt: null,
}

const normalizeEventBookingPayload = (request = {}) => ({
  ...defaultEventBookingPayload,
  ...request,
  id: Number(request.id) || 0,
  userId: request.userId == null ? null : toNumberOrNull(request.userId),
  authUserId: trimText(request.authUserId),
  talentId: toNumberOrNull(request.talentId),
  talentName: trimText(request.talentName),
  celebrityName: trimText(request.celebrityName),
  eventDate: normalizeEventDate(request.eventDate) ?? '',
  approximateBudget: trimText(request.approximateBudget),
  eventType: trimText(request.eventType),
  eventLocation: trimText(request.eventLocation),
  additionalInfo: trimText(request.additionalInfo),
  fullName: trimText(request.fullName),
  organizationName: trimText(request.organizationName),
  jobTitle: trimText(request.jobTitle),
  phoneNumber: trimText(request.phoneNumber),
  emailAddress: trimText(request.emailAddress).toLowerCase(),
  fullAddress: trimText(request.fullAddress),
  nearestAirport: trimText(request.nearestAirport),
  status: normalizeEventBookingStatus(request.status),
  submittedAt: request.submittedAt ?? new Date().toISOString(),
  reviewedAt: request.reviewedAt ?? null,
})

const fromEventBookingRow = (record = {}) =>
  normalizeEventBookingPayload({
    id: Number(record.id) || 0,
    userId: toNumberOrNull(record.user_public_id),
    authUserId: trimText(record.auth_user_id),
    talentId: toNumberOrNull(record.talent_id),
    talentName: trimText(record.talent_name),
    celebrityName: trimText(record.celebrity_name),
    eventDate: record.event_date ?? '',
    approximateBudget: trimText(record.approximate_budget),
    eventType: trimText(record.event_type),
    eventLocation: trimText(record.event_location),
    additionalInfo: trimText(record.additional_info),
    fullName: trimText(record.full_name),
    organizationName: trimText(record.organization_name),
    jobTitle: trimText(record.job_title),
    phoneNumber: trimText(record.phone_number),
    emailAddress: trimText(record.email_address),
    fullAddress: trimText(record.full_address),
    nearestAirport: trimText(record.nearest_airport),
    status: normalizeEventBookingStatus(record.status),
    submittedAt: record.submitted_at ?? record.created_at ?? new Date().toISOString(),
    reviewedAt: record.reviewed_at ?? null,
  })

const toEventBookingRow = (request = {}) => {
  const normalizedRequest = normalizeEventBookingPayload(request)

  return {
    auth_user_id: trimText(normalizedRequest.authUserId) || null,
    user_public_id: toNumberOrNull(normalizedRequest.userId),
    talent_id: toNumberOrNull(normalizedRequest.talentId),
    talent_name: trimText(normalizedRequest.talentName),
    celebrity_name: trimText(normalizedRequest.celebrityName),
    event_date: normalizeEventDate(normalizedRequest.eventDate),
    approximate_budget: trimText(normalizedRequest.approximateBudget),
    event_type: trimText(normalizedRequest.eventType),
    event_location: trimText(normalizedRequest.eventLocation),
    additional_info: trimText(normalizedRequest.additionalInfo),
    full_name: trimText(normalizedRequest.fullName),
    organization_name: trimText(normalizedRequest.organizationName),
    job_title: trimText(normalizedRequest.jobTitle),
    phone_number: trimText(normalizedRequest.phoneNumber),
    email_address: trimText(normalizedRequest.emailAddress).toLowerCase(),
    full_address: trimText(normalizedRequest.fullAddress),
    nearest_airport: trimText(normalizedRequest.nearestAirport),
    status: normalizeEventBookingStatus(normalizedRequest.status),
    reviewed_at: normalizedRequest.reviewedAt ?? null,
    submitted_at: normalizedRequest.submittedAt ?? new Date().toISOString(),
  }
}

const normalizeMessageRole = (value, fallback = MESSAGE_ROLES.SYSTEM) => {
  const normalized = trimText(value).toLowerCase()
  return Object.values(MESSAGE_ROLES).includes(normalized) ? normalized : fallback
}

const normalizeMessageAttachmentMetadata = (attachment = {}) => {
  const normalizedUpload = normalizeStoredUpload(attachment)
  const kind = trimText(attachment.kind).toLowerCase()
  const attachmentId = trimText(attachment.id || normalizedUpload.uploadId)
  const attachmentName = trimText(attachment.name || normalizedUpload.fileName)

  if (
    !attachmentId ||
    !attachmentName ||
    !['image', 'audio', 'pdf', 'docx'].includes(kind)
  ) {
    return null
  }

  return {
    id: attachmentId,
    uploadId: trimText(normalizedUpload.uploadId) || attachmentId,
    name: attachmentName,
    fileName: attachmentName,
    mimeType: trimText(attachment.mimeType || normalizedUpload.mimeType),
    size: Number(attachment.size ?? normalizedUpload.size ?? 0) || 0,
    kind,
    bucket: trimText(attachment.bucket || normalizedUpload.bucket),
    storagePath: trimText(attachment.storagePath || normalizedUpload.storagePath),
    createdAt:
      attachment.createdAt ??
      normalizedUpload.uploadedAt ??
      attachment.storedAt ??
      null,
  }
}

const normalizeMessageAttachments = (attachments = []) =>
  Array.isArray(attachments)
    ? attachments.map(normalizeMessageAttachmentMetadata).filter(Boolean)
    : []

const formatAttachmentPreview = (attachments = []) => {
  const attachmentCounts = attachments.reduce(
    (counts, attachment) => {
      const kind = attachment?.kind

      if (kind && counts[kind] !== undefined) {
        counts[kind] += 1
      }

      return counts
    },
    {
      image: 0,
      audio: 0,
      pdf: 0,
      docx: 0,
    },
  )

  const previewParts = []

  if (attachmentCounts.image > 0) {
    previewParts.push(
      `${attachmentCounts.image} image${attachmentCounts.image === 1 ? '' : 's'}`,
    )
  }

  if (attachmentCounts.audio > 0) {
    previewParts.push(
      `${attachmentCounts.audio} audio file${attachmentCounts.audio === 1 ? '' : 's'}`,
    )
  }

  if (attachmentCounts.pdf > 0) {
    previewParts.push(
      `${attachmentCounts.pdf} PDF${attachmentCounts.pdf === 1 ? '' : 's'}`,
    )
  }

  if (attachmentCounts.docx > 0) {
    previewParts.push(
      `${attachmentCounts.docx} DOCX file${attachmentCounts.docx === 1 ? '' : 's'}`,
    )
  }

  return previewParts.length > 0 ? `Sent ${previewParts.join(', ')}` : 'Attachment sent'
}

const buildMessagePreview = (message = null) => {
  const textPreview = trimText(message?.text)

  if (textPreview) {
    return textPreview
  }

  return Array.isArray(message?.attachments) && message.attachments.length > 0
    ? formatAttachmentPreview(message.attachments)
    : ''
}

const toThreadRouteId = (threadRecordId) => `thread-${Number(threadRecordId) || 0}`

const toMessageRouteId = (messageRecordId) => `message-${Number(messageRecordId) || 0}`

const toThreadRecordId = (value) => {
  const normalizedValue = trimText(value)
  const numericValue = normalizedValue.startsWith('thread-')
    ? normalizedValue.slice('thread-'.length)
    : normalizedValue

  return toNumberOrNull(numericValue)
}

const getMembershipInboxTopic = (plan) => {
  const normalizedPlan = normalizeMembershipPlan(plan, MEMBERSHIP_PLANS.FREE)

  if (normalizedPlan === MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return 'Crown Access inbox'
  }

  if (normalizedPlan === MEMBERSHIP_PLANS.INNER_CIRCLE) {
    return 'Inner Circle inbox'
  }

  return 'Private inbox'
}

const getMessageAccessTalentIds = (profile = {}, talents = []) => {
  const normalizedPlan = normalizeMembershipPlan(profile.plan, MEMBERSHIP_PLANS.FREE)

  if (normalizedPlan === MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return talents.map((talent) => Number(talent.id)).filter(Boolean)
  }

  if (normalizedPlan === MEMBERSHIP_PLANS.INNER_CIRCLE) {
    return Array.isArray(profile.talents_unlocked)
      ? profile.talents_unlocked.map((talentId) => Number(talentId)).filter(Boolean)
      : []
  }

  return []
}

const fromThreadMessageRow = (record = {}) => ({
  id: toMessageRouteId(record.id),
  backendMessageId: Number(record.id) || 0,
  senderRole: normalizeMessageRole(record.sender_role),
  senderLabel: trimText(record.sender_label) || 'System',
  text: trimText(record.message_text),
  attachments: normalizeMessageAttachments(record.attachments),
  createdAt: record.created_at ?? null,
})

const isLegacyWelcomeMessageRow = (record = {}, thread = {}) => {
  const senderRole = normalizeMessageRole(record.sender_role ?? record.senderRole)
  const messageText = trimText(record.message_text ?? record.text)
  const talentName = trimText(thread.talent_name ?? thread.talentName) || 'Talent'

  return (
    (senderRole === MESSAGE_ROLES.SYSTEM &&
      messageText === `${talentName}'s private inbox is now open.`) ||
    (senderRole === MESSAGE_ROLES.TALENT &&
      messageText === 'Thanks for reaching out. Send a note whenever you are ready.')
  )
}

const threadHasFanConversation = (thread = {}) =>
  Array.isArray(thread.messages) &&
  thread.messages.some((message) => normalizeMessageRole(message.senderRole) === MESSAGE_ROLES.FAN)

const fromMessageThreadRow = (record = {}, messages = []) => {
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const lastMessage = normalizedMessages[normalizedMessages.length - 1] ?? null
  const talentName = trimText(record.talent_name)
  const storedPreview = trimText(record.preview)

  return {
    id: toThreadRouteId(record.id),
    backendThreadId: Number(record.id) || 0,
    fanUserId: toNumberOrNull(record.fan_user_public_id),
    fanAuthUserId: trimText(record.fan_auth_user_id),
    fanName: trimText(record.fan_name) || 'Member',
    fanEmail: trimText(record.fan_email).toLowerCase(),
    talentId: toNumberOrNull(record.talent_id),
    talentName,
    topic: trimText(record.topic) || 'Private inbox',
    preview:
      storedPreview && storedPreview !== `${talentName}'s private inbox is ready for your first message.`
        ? storedPreview
        : buildMessagePreview(lastMessage),
    createdAt: record.created_at ?? null,
    lastActiveAt: record.last_active_at ?? lastMessage?.createdAt ?? record.created_at ?? null,
    messages: normalizedMessages,
  }
}

const readThreadMessagesByThreadIds = async (threadIds = []) => {
  const normalizedThreadIds = Array.from(
    new Set(threadIds.map((threadId) => toNumberOrNull(threadId)).filter(Boolean)),
  )

  if (!normalizedThreadIds.length) {
    return []
  }

  const messageRows = []

  for (const threadIdBatch of chunkArray(
    normalizedThreadIds,
    MESSAGE_THREAD_HYDRATION_BATCH_SIZE,
  )) {
    const nextRows = await readAllSupabaseRows(
      () =>
        supabaseAdmin
          .from(THREAD_MESSAGES_TABLE)
          .select('*')
          .in('thread_id', threadIdBatch)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      {
        errorMessage: 'Supabase message read failed',
      },
    )

    messageRows.push(...nextRows)
  }

  return messageRows
}

const hydrateMessageThreads = async (threadRows = []) => {
  const messages = await readThreadMessagesByThreadIds(
    threadRows.map((threadRow) => Number(threadRow.id) || 0),
  )
  const messagesByThreadId = new Map()

  messages.forEach((messageRow) => {
    const threadId = Number(messageRow.thread_id) || 0
    const nextThreadMessages = messagesByThreadId.get(threadId) ?? []
    nextThreadMessages.push(messageRow)
    messagesByThreadId.set(threadId, nextThreadMessages)
  })

  return threadRows.map((threadRow) => {
    const nextMessages = (messagesByThreadId.get(Number(threadRow.id) || 0) ?? [])
      .filter((messageRow) => !isLegacyWelcomeMessageRow(messageRow, threadRow))
      .map((messageRow) => fromThreadMessageRow(messageRow))

    return fromMessageThreadRow(threadRow, nextMessages)
  })
}

const getMessageAccessContextForAuthUser = async (authUser) => {
  ensureSupabaseApiConfigured()
  const profile = await requireUserProfileByAuthUserId(authUser.id)
  const allTalents = await listTalents()
  const accessibleTalentIds = getMessageAccessTalentIds(profile, allTalents)

  return {
    accessibleTalentIds,
    allTalents,
    profile,
  }
}

const readMessageThreadRowForFanTalent = async (authUserId, talentId) => {
  const normalizedTalentId = toNumberOrNull(talentId)

  if (!normalizedTalentId) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .select('*')
    .eq('fan_auth_user_id', trimText(authUserId))
    .eq('talent_id', normalizedTalentId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw createHttpError(502, `Supabase message thread lookup failed: ${error.message}`)
  }

  return data ?? null
}

const createMessageThreadForFan = async ({ authUser, profile, talent }) => {
  const fanName =
    trimText(profile.name) ||
    trimText(authUser.user_metadata?.name) ||
    trimText(profile.email || authUser.email).split('@')[0] ||
    'Member'
  const fanEmail = trimText(profile.email || authUser.email).toLowerCase()
  const topic = getMembershipInboxTopic(profile.plan)
  const { data, error } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .insert({
      fan_auth_user_id: trimText(authUser.id),
      fan_user_public_id: toNumberOrNull(profile.public_id),
      fan_name: fanName,
      fan_email: fanEmail,
      talent_id: Number(talent.id) || 0,
      talent_name: trimText(talent.name),
      topic,
      preview: '',
      last_active_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase message thread create failed: ${error.message}`)
  }

  return data
}

const listMessageThreadsForAuthUser = async (authUser, { talentId = null } = {}) => {
  ensureSupabaseApiConfigured()
  const normalizedTalentId = toNumberOrNull(talentId)
  const buildThreadQuery = () =>
    supabaseAdmin
      .from(MESSAGE_THREADS_TABLE)
      .select('*')
      .order('last_active_at', { ascending: false })
      .order('id', { ascending: false })

  if (isSupabaseAdminUser(authUser)) {
    const data = await readAllSupabaseRows(
      () =>
        normalizedTalentId
          ? buildThreadQuery().eq('talent_id', normalizedTalentId)
          : buildThreadQuery(),
      {
        errorMessage: 'Supabase message thread read failed',
      },
    )

    return (await hydrateMessageThreads(data ?? [])).filter((thread) =>
      threadHasFanConversation(thread),
    )
  }

  const { accessibleTalentIds } = await getMessageAccessContextForAuthUser(authUser)

  if (!accessibleTalentIds.length) {
    return []
  }

  const visibleTalentIds = normalizedTalentId ? [normalizedTalentId] : accessibleTalentIds
  const data = await readAllSupabaseRows(
    () =>
      buildThreadQuery()
        .eq('fan_auth_user_id', trimText(authUser.id))
        .in('talent_id', visibleTalentIds),
    {
      errorMessage: 'Supabase message thread read failed',
    },
  )

  return (await hydrateMessageThreads(data ?? [])).filter((thread) =>
    threadHasFanConversation(thread),
  )
}

const readMessageThreadById = async (threadId) => {
  ensureSupabaseApiConfigured()
  const normalizedThreadId = toNumberOrNull(threadId)

  if (!normalizedThreadId) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .select('*')
    .eq('id', normalizedThreadId)
    .maybeSingle()

  if (error) {
    throw createHttpError(502, `Supabase message thread lookup failed: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const [thread] = await hydrateMessageThreads([data])
  return thread ?? null
}

const createMessageInSupabase = async (request, threadId, payload = {}) => {
  ensureSupabaseApiConfigured()
  const authUser = await requireAuthenticatedUser(
    request,
    'Sign in before sending a message.',
  )
  const normalizedThreadId = toThreadRecordId(threadId)

  if (!normalizedThreadId) {
    throw createHttpError(400, 'Choose a valid message thread before sending a reply.')
  }

  const { data: threadRecord, error: threadRecordError } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .select('*')
    .eq('id', normalizedThreadId)
    .maybeSingle()

  if (threadRecordError) {
    throw createHttpError(502, `Supabase message thread lookup failed: ${threadRecordError.message}`)
  }

  if (!threadRecord) {
    return null
  }

  const isAdmin = isSupabaseAdminUser(authUser)

  if (
    !isAdmin &&
    trimText(threadRecord.fan_auth_user_id) !== trimText(authUser.id)
  ) {
    throw createHttpError(403, 'That message thread is not available for this account.')
  }

  if (!isAdmin) {
    const { accessibleTalentIds } = await getMessageAccessContextForAuthUser(authUser)

    if (!accessibleTalentIds.includes(toNumberOrNull(threadRecord.talent_id))) {
      throw createHttpError(403, 'That message thread is not available for this account.')
    }
  }

  const text = trimText(payload.text)
  const attachments = normalizeMessageAttachments(payload.attachments)

  if (!text && !attachments.length) {
    throw createHttpError(400, 'Write a message or attach a file before sending it.')
  }

  const senderRole = isAdmin
    ? normalizeMessageRole(payload.senderRole, MESSAGE_ROLES.TALENT)
    : MESSAGE_ROLES.FAN
  const senderLabel =
    trimText(payload.senderLabel) ||
    (senderRole === MESSAGE_ROLES.FAN
      ? trimText(threadRecord.fan_name)
      : senderRole === MESSAGE_ROLES.TALENT
        ? trimText(threadRecord.talent_name)
        : 'System')

  const createdAt = new Date().toISOString()
  const { error: messageInsertError } = await supabaseAdmin
    .from(THREAD_MESSAGES_TABLE)
    .insert({
      thread_id: normalizedThreadId,
      sender_role: senderRole,
      sender_label: senderLabel || 'System',
      message_text: text,
      attachments,
      created_at: createdAt,
    })

  if (messageInsertError) {
    throw createHttpError(502, `Supabase message create failed: ${messageInsertError.message}`)
  }

  const { error: threadUpdateError } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .update({
      preview: buildMessagePreview({ text, attachments }),
      last_active_at: createdAt,
    })
    .eq('id', normalizedThreadId)

  if (threadUpdateError) {
    throw createHttpError(502, `Supabase message thread update failed: ${threadUpdateError.message}`)
  }

  return readMessageThreadById(normalizedThreadId)
}

const createMessageThreadInSupabase = async (request, payload = {}) => {
  ensureSupabaseApiConfigured()
  const authUser = await requireAuthenticatedUser(
    request,
    'Sign in before starting a conversation.',
  )

  if (isSupabaseAdminUser(authUser)) {
    throw createHttpError(403, 'Admin accounts can only reply to existing fan conversations.')
  }

  const normalizedTalentId = toNumberOrNull(payload.talentId)

  if (!normalizedTalentId) {
    throw createHttpError(400, 'Choose a valid talent before starting a conversation.')
  }

  const text = trimText(payload.text)
  const attachments = normalizeMessageAttachments(payload.attachments)

  if (!text && !attachments.length) {
    throw createHttpError(400, 'Write a message or attach a file before sending it.')
  }

  const { accessibleTalentIds, allTalents, profile } = await getMessageAccessContextForAuthUser(
    authUser,
  )

  if (!accessibleTalentIds.includes(normalizedTalentId)) {
    throw createHttpError(403, 'Your current membership does not include that talent inbox.')
  }

  const talent = allTalents.find((candidate) => Number(candidate.id) === normalizedTalentId)

  if (!talent) {
    throw createHttpError(404, 'That talent could not be found.')
  }

  let threadRecord = await readMessageThreadRowForFanTalent(authUser.id, normalizedTalentId)

  if (!threadRecord) {
    threadRecord = await createMessageThreadForFan({
      authUser,
      profile,
      talent,
    })
  }

  const createdAt = new Date().toISOString()
  const fanName =
    trimText(threadRecord.fan_name) ||
    trimText(profile.name) ||
    trimText(authUser.user_metadata?.name) ||
    trimText(profile.email || authUser.email).split('@')[0] ||
    'Member'
  const { error: messageInsertError } = await supabaseAdmin
    .from(THREAD_MESSAGES_TABLE)
    .insert({
      thread_id: Number(threadRecord.id) || 0,
      sender_role: MESSAGE_ROLES.FAN,
      sender_label: fanName,
      message_text: text,
      attachments,
      created_at: createdAt,
    })

  if (messageInsertError) {
    throw createHttpError(502, `Supabase message create failed: ${messageInsertError.message}`)
  }

  const { error: threadUpdateError } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .update({
      preview: buildMessagePreview({ text, attachments }),
      last_active_at: createdAt,
    })
    .eq('id', Number(threadRecord.id) || 0)

  if (threadUpdateError) {
    throw createHttpError(502, `Supabase message thread update failed: ${threadUpdateError.message}`)
  }

  return readMessageThreadById(Number(threadRecord.id) || 0)
}

const collectStoredUploads = (uploads = []) =>
  uploads
    .map((upload) => normalizeStoredUpload(upload))
    .filter((upload) => upload.bucket && upload.storagePath)

const collectStoredUploadsFromMessageAttachments = (attachments = []) =>
  normalizeMessageAttachments(attachments)
    .filter((attachment) => attachment.bucket && attachment.storagePath)
    .map((attachment) =>
      normalizeStoredUpload({
        uploadId: attachment.uploadId || attachment.id,
        bucket: attachment.bucket,
        storagePath: attachment.storagePath,
        fileName: attachment.fileName || attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedAt: attachment.createdAt,
      }),
    )

const collectStoredUploadsFromVerificationDocuments = (documents = {}) =>
  Object.values(documents && typeof documents === 'object' ? documents : {})
    .map((document) => normalizeStoredUpload(document))
    .filter((upload) => upload.bucket && upload.storagePath)

const removeStoredUploads = async (uploads = []) => {
  const uploadsByBucket = new Map()

  collectStoredUploads(uploads).forEach((upload) => {
    const nextBucketUploads = uploadsByBucket.get(upload.bucket) ?? new Set()
    nextBucketUploads.add(upload.storagePath)
    uploadsByBucket.set(upload.bucket, nextBucketUploads)
  })

  for (const [bucket, storagePaths] of uploadsByBucket.entries()) {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([...storagePaths])

    if (error) {
      throw createHttpError(502, `Supabase storage cleanup failed: ${error.message}`)
    }
  }
}

const deleteCurrentUserInSupabase = async (request) => {
  ensureSupabaseApiConfigured()
  const authUser = await requireAuthenticatedUser(
    request,
    'Sign in before deleting your account.',
  )
  const normalizedAuthUserId = trimText(authUser.id)
  const userProfile = await readUserProfileByAuthUserId(normalizedAuthUserId)

  const { data: membershipRows, error: membershipRowsError } = await supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .select('id, proof_upload')
    .eq('auth_user_id', normalizedAuthUserId)

  if (membershipRowsError) {
    throw createHttpError(502, `Supabase membership lookup failed: ${membershipRowsError.message}`)
  }

  const { data: orderRows, error: orderRowsError } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .select('id, proof_upload')
    .eq('auth_user_id', normalizedAuthUserId)

  if (orderRowsError) {
    throw createHttpError(502, `Supabase order lookup failed: ${orderRowsError.message}`)
  }

  const { data: threadRows, error: threadRowsError } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .select('id')
    .eq('fan_auth_user_id', normalizedAuthUserId)

  if (threadRowsError) {
    throw createHttpError(502, `Supabase message thread lookup failed: ${threadRowsError.message}`)
  }

  const threadIds = (threadRows ?? [])
    .map((threadRow) => Number(threadRow.id) || 0)
    .filter(Boolean)
  let messageAttachmentUploads = []

  if (threadIds.length) {
    const { data: messageRows, error: messageRowsError } = await supabaseAdmin
      .from(THREAD_MESSAGES_TABLE)
      .select('attachments')
      .in('thread_id', threadIds)

    if (messageRowsError) {
      throw createHttpError(502, `Supabase message lookup failed: ${messageRowsError.message}`)
    }

    messageAttachmentUploads = (messageRows ?? []).flatMap((messageRow) =>
      collectStoredUploadsFromMessageAttachments(messageRow.attachments),
    )
  }

  const proofUploads = [
    ...collectStoredUploads([
      userProfile?.avatar_storage,
    ]),
    ...collectStoredUploadsFromVerificationDocuments(userProfile?.verification?.documents),
    ...(membershipRows ?? []).flatMap((row) => collectStoredUploads([row.proof_upload])),
    ...(orderRows ?? []).flatMap((row) => collectStoredUploads([row.proof_upload])),
  ]

  if (proofUploads.length || messageAttachmentUploads.length) {
    await removeStoredUploads([...proofUploads, ...messageAttachmentUploads])
  }

  const { data: deletedOrders, error: deletedOrdersError } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .delete()
    .eq('auth_user_id', normalizedAuthUserId)
    .select('id')

  if (deletedOrdersError) {
    throw createHttpError(502, `Supabase order delete failed: ${deletedOrdersError.message}`)
  }

  const { data: deletedMemberships, error: deletedMembershipsError } = await supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .delete()
    .eq('auth_user_id', normalizedAuthUserId)
    .select('id')

  if (deletedMembershipsError) {
    throw createHttpError(502, `Supabase membership delete failed: ${deletedMembershipsError.message}`)
  }

  const { data: deletedEventBookings, error: deletedEventBookingsError } = await supabaseAdmin
    .from(EVENT_BOOKING_REQUESTS_TABLE)
    .delete()
    .eq('auth_user_id', normalizedAuthUserId)
    .select('id')

  if (deletedEventBookingsError) {
    throw createHttpError(
      502,
      `Supabase event booking delete failed: ${deletedEventBookingsError.message}`,
    )
  }

  const { data: deletedThreads, error: deletedThreadsError } = await supabaseAdmin
    .from(MESSAGE_THREADS_TABLE)
    .delete()
    .eq('fan_auth_user_id', normalizedAuthUserId)
    .select('id')

  if (deletedThreadsError) {
    throw createHttpError(502, `Supabase message thread delete failed: ${deletedThreadsError.message}`)
  }

  const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
    normalizedAuthUserId,
  )

  if (deleteUserError) {
    throw createHttpError(502, `Supabase user delete failed: ${deleteUserError.message}`)
  }

  return {
    removedEventBookingCount: (deletedEventBookings ?? []).length,
    removedMembershipCount: (deletedMemberships ?? []).length,
    removedOrderCount: (deletedOrders ?? []).length,
    removedThreadCount: (deletedThreads ?? []).length,
  }
}

const listMembershipRequestsForAuthUser = async (authUser) => {
  ensureSupabaseApiConfigured()
  const query = supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .select('*')
    .order('submitted_at', { ascending: false })

  const { data, error } = isSupabaseAdminUser(authUser)
    ? await query
    : await query.eq('auth_user_id', trimText(authUser.id))

  if (error) {
    throw createHttpError(502, `Supabase membership read failed: ${error.message}`)
  }

  return (data ?? []).map(fromMembershipRequestRow)
}

const createMembershipRequestInSupabase = async (authUser, payload = {}) => {
  ensureSupabaseApiConfigured()
  const profile = await requireUserProfileByAuthUserId(authUser.id)
  const plan = normalizeMembershipPlan(payload.plan)
  const billingCycle = normalizeMembershipBillingCycle(payload.billingCycle)
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod)
  const proofSummary = trimText(payload.proofSummary)
  const proofUpload = normalizeStoredUpload(payload.proofUpload)
  const proofFileName = trimText(payload.proofFileName || proofUpload.fileName)

  if (plan === MEMBERSHIP_PLANS.FREE) {
    throw createHttpError(400, 'Choose a paid membership plan before continuing.')
  }

  if (!proofSummary) {
    throw createHttpError(400, 'Add a short payment note before submitting your membership request.')
  }

  if (!proofFileName) {
    throw createHttpError(400, 'Upload your proof of payment before submitting your membership request.')
  }

  const { data: existingRows, error: existingRowsError } = await supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .select('*')
    .eq('auth_user_id', trimText(authUser.id))
    .order('submitted_at', { ascending: false })

  if (existingRowsError) {
    throw createHttpError(502, `Supabase membership read failed: ${existingRowsError.message}`)
  }

  const existingRequests = (existingRows ?? []).map(fromMembershipRequestRow)

  if (existingRequests.some((request) => request.status === MEMBERSHIP_STATUS.UNDER_REVIEW)) {
    throw createHttpError(409, 'You already have a membership request under review.')
  }

  let talent = null
  if (plan === MEMBERSHIP_PLANS.INNER_CIRCLE) {
    const talentId = toNumberOrNull(payload.talentId)

    if (!talentId) {
      throw createHttpError(400, 'Choose the talent you want unlocked for Inner Circle.')
    }

    talent = await getTalent(talentId)

    if (!talent) {
      throw createHttpError(404, 'Choose a valid talent before submitting your membership request.')
    }
  }

  const requestRecord = {
    authUserId: trimText(authUser.id),
    userId: toNumberOrNull(profile.public_id),
    fanName:
      trimText(profile.name) ||
      trimText(authUser.user_metadata?.name) ||
      trimText(profile.email || authUser.email).split('@')[0] ||
      'CrownPoint Member',
    email: trimText(profile.email || authUser.email).toLowerCase(),
    plan,
    billingCycle,
    talentId: talent?.id ?? null,
    talentName: talent?.name ?? 'All talents',
    amountUsd: getMembershipPriceUsd(plan, billingCycle),
    currencyCode: normalizeCurrencyCode(payload.currencyCode),
    region: trimText(payload.region || profile.profile?.country),
    paymentMethod,
    proofSummary,
    proofFileName,
    proofUpload,
    submittedAt: new Date().toISOString(),
    status: MEMBERSHIP_STATUS.UNDER_REVIEW,
    risk: getMembershipRiskLevel(paymentMethod),
  }

  const { data, error } = await supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .insert(toMembershipRequestRow(requestRecord))
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase membership create failed: ${error.message}`)
  }

  return fromMembershipRequestRow(data)
}

const reviewMembershipRequestInSupabase = async (requestId, status) => {
  ensureSupabaseApiConfigured()
  const normalizedRequestId = toNumberOrNull(requestId)

  if (!normalizedRequestId) {
    throw createHttpError(400, 'Choose a valid membership request before reviewing it.')
  }

  const nextStatus = normalizeMembershipStatus(status)
  const { data: currentRecord, error: readError } = await supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .select('*')
    .eq('id', normalizedRequestId)
    .maybeSingle()

  if (readError) {
    throw createHttpError(502, `Supabase membership lookup failed: ${readError.message}`)
  }

  if (!currentRecord) {
    return null
  }

  const currentRequest = fromMembershipRequestRow(currentRecord)
  const reviewTimestamp = new Date().toISOString()
  const nextRequest = {
    ...currentRequest,
    status: nextStatus,
    reviewedAt: reviewTimestamp,
    activatedAt:
      nextStatus === MEMBERSHIP_STATUS.APPROVED
        ? currentRequest.activatedAt ?? reviewTimestamp
        : currentRequest.activatedAt,
  }

  const { data, error } = await supabaseAdmin
    .from(MEMBERSHIP_REQUESTS_TABLE)
    .update(toMembershipRequestRow(nextRequest))
    .eq('id', normalizedRequestId)
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase membership review failed: ${error.message}`)
  }

  if (
    nextStatus === MEMBERSHIP_STATUS.APPROVED &&
    currentRequest.status !== MEMBERSHIP_STATUS.APPROVED &&
    !currentRequest.activatedAt
  ) {
    const userProfile = await requireUserProfileByAuthUserId(currentRequest.authUserId)
    const { error: profileError } = await supabaseAdmin
      .from(USER_PROFILES_TABLE)
      .update({
        plan: currentRequest.plan,
        plan_expiry: calculatePlanExpiry(userProfile.plan_expiry, currentRequest.billingCycle),
        plan_billing_cycle: currentRequest.billingCycle,
        talents_unlocked: buildUnlockedTalents(currentRequest),
      })
      .eq('id', trimText(currentRequest.authUserId))

    if (profileError) {
      throw createHttpError(502, `Supabase membership activation failed: ${profileError.message}`)
    }
  }

  return fromMembershipRequestRow(data)
}

const listOrdersForAuthUser = async (authUser) => {
  ensureSupabaseApiConfigured()
  const query = supabaseAdmin
    .from(ORDERS_TABLE)
    .select('*')
    .order('submitted_at', { ascending: false })

  const { data, error } = isSupabaseAdminUser(authUser)
    ? await query
    : await query.eq('auth_user_id', trimText(authUser.id))

  if (error) {
    throw createHttpError(502, `Supabase order read failed: ${error.message}`)
  }

  return (data ?? []).map(fromOrderRow)
}

const createOrderInSupabase = async (request, payload = {}) => {
  ensureSupabaseApiConfigured()
  const authUser = await readAuthenticatedUser(request)
  const profile = authUser ? await readUserProfileByAuthUserId(authUser.id) : null
  const refCode = trimText(payload.refCode).toUpperCase()
  const proofUpload = normalizeStoredUpload(payload.proofUpload)

  if (!refCode) {
    throw createHttpError(400, 'Generate a valid reference before submitting payment.')
  }

  const normalizedOrder = normalizeOrderPayload({
    ...payload,
    authUserId: trimText(authUser?.id),
    userId: toNumberOrNull(profile?.public_id) ?? payload.userId ?? null,
    fanName:
      trimText(payload.fanName) ||
      trimText(profile?.name) ||
      trimText(authUser?.user_metadata?.name) ||
      normalizeCheckoutContact(payload.contact).fullName ||
      defaultOrderPayload.fanName,
    email:
      trimText(payload.email) ||
      trimText(profile?.email) ||
      trimText(authUser?.email) ||
      normalizeCheckoutContact(payload.contact).email,
    orderType: normalizeOrderType(payload.orderType),
    refCode,
    status: ORDER_STATUS.UNDER_REVIEW,
    paymentMethod: normalizePaymentMethod(payload.paymentMethod),
    paymentProof: trimText(payload.paymentProof),
    paymentProofFileName: trimText(payload.paymentProofFileName || proofUpload.fileName),
    proofUpload,
    proofSummary: trimText(payload.proofSummary),
    risk: getOrderRiskLevel(payload.paymentMethod),
    createdAt: payload.createdAt ?? new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
  })

  if (!normalizedOrder.paymentProofFileName) {
    throw createHttpError(400, 'Upload your proof of payment before submitting this order.')
  }

  if (!normalizedOrder.paymentProof) {
    throw createHttpError(400, 'Add the payment proof details before submitting this order.')
  }

  if (!normalizedOrder.items.length) {
    throw createHttpError(400, 'There is no active order to submit for payment.')
  }

  const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .select('id, auth_user_id')
    .eq('ref_code', refCode)
    .maybeSingle()

  if (existingOrderError) {
    throw createHttpError(502, `Supabase order lookup failed: ${existingOrderError.message}`)
  }

  if (existingOrder) {
    throw createHttpError(409, `REF #${refCode} has already been submitted for review.`)
  }

  const { data, error } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .insert(toOrderRow(normalizedOrder))
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase order create failed: ${error.message}`)
  }

  return fromOrderRow(data)
}

const getOrderByRefCodeFromSupabase = async (request, refCode) => {
  ensureSupabaseApiConfigured()
  const normalizedRefCode = trimText(refCode).toUpperCase()

  if (!normalizedRefCode) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .select('*')
    .eq('ref_code', normalizedRefCode)
    .maybeSingle()

  if (error) {
    throw createHttpError(502, `Supabase order lookup failed: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const order = fromOrderRow(data)
  const authUser = await readAuthenticatedUser(request)

  if (isSupabaseAdminUser(authUser)) {
    return order
  }

  if (!trimText(order.authUserId)) {
    return order
  }

  if (authUser && trimText(authUser.id) === trimText(order.authUserId)) {
    return order
  }

  return null
}

const reviewOrderInSupabase = async (orderId, status) => {
  ensureSupabaseApiConfigured()
  const normalizedOrderId = toNumberOrNull(orderId)

  if (!normalizedOrderId) {
    throw createHttpError(400, 'Choose a valid order before reviewing it.')
  }

  const nextStatus = normalizeOrderStatus(status)
  const { data: currentRecord, error: readError } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .select('*')
    .eq('id', normalizedOrderId)
    .maybeSingle()

  if (readError) {
    throw createHttpError(502, `Supabase order lookup failed: ${readError.message}`)
  }

  if (!currentRecord) {
    return null
  }

  const currentOrder = fromOrderRow(currentRecord)
  const nextOrder = normalizeOrderPayload({
    ...currentOrder,
    status: nextStatus,
    reviewedAt: new Date().toISOString(),
    eta: getOrderEtaForStatus(nextStatus, currentOrder.orderType),
  })

  const { data, error } = await supabaseAdmin
    .from(ORDERS_TABLE)
    .update(toOrderRow(nextOrder))
    .eq('id', normalizedOrderId)
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase order review failed: ${error.message}`)
  }

  return fromOrderRow(data)
}

const listEventBookingRequestsForAuthUser = async (authUser) => {
  ensureSupabaseApiConfigured()
  const query = supabaseAdmin
    .from(EVENT_BOOKING_REQUESTS_TABLE)
    .select('*')
    .order('submitted_at', { ascending: false })

  const { data, error } = isSupabaseAdminUser(authUser)
    ? await query
    : await query.eq('auth_user_id', trimText(authUser.id))

  if (error) {
    throw createHttpError(502, `Supabase event booking read failed: ${error.message}`)
  }

  return (data ?? []).map(fromEventBookingRow)
}

const createEventBookingRequestInSupabase = async (request, payload = {}) => {
  ensureSupabaseApiConfigured()
  const authUser = await readAuthenticatedUser(request)
  const profile = authUser ? await readUserProfileByAuthUserId(authUser.id) : null
  const normalizedTalentId = toNumberOrNull(payload.talentId)

  if (!normalizedTalentId) {
    throw createHttpError(400, 'Choose a valid talent before submitting your booking request.')
  }

  const talent = await getTalent(normalizedTalentId)

  if (!talent) {
    throw createHttpError(404, 'Choose a valid talent before submitting your booking request.')
  }

  if (!talent.eventBooking?.available) {
    throw createHttpError(409, 'This talent is not currently open for event booking.')
  }

  const normalizedRequest = normalizeEventBookingPayload({
    ...payload,
    authUserId: trimText(authUser?.id),
    userId: toNumberOrNull(profile?.public_id) ?? payload.userId ?? null,
    talentId: normalizedTalentId,
    talentName: trimText(payload.talentName) || trimText(talent.name),
    celebrityName: trimText(payload.celebrityName) || trimText(talent.name),
    fullName:
      trimText(payload.fullName) ||
      trimText(profile?.name) ||
      trimText(authUser?.user_metadata?.name),
    emailAddress:
      trimText(payload.emailAddress) ||
      trimText(profile?.email) ||
      trimText(authUser?.email),
    status: EVENT_BOOKING_REQUEST_STATUS.NEW,
    submittedAt: new Date().toISOString(),
  })

  if (!normalizedRequest.fullName) {
    throw createHttpError(400, 'Add your full name before sending this request.')
  }

  if (!normalizedRequest.jobTitle) {
    throw createHttpError(400, 'Add your job title before sending this request.')
  }

  if (!normalizedRequest.phoneNumber) {
    throw createHttpError(400, 'Add a phone number before sending this request.')
  }

  if (!normalizedRequest.emailAddress || !/\S+@\S+\.\S+/.test(normalizedRequest.emailAddress)) {
    throw createHttpError(400, 'Add a valid email address before sending this request.')
  }

  if (!normalizedRequest.eventDate) {
    throw createHttpError(400, 'Choose an event date before sending this request.')
  }

  if (!normalizedRequest.approximateBudget) {
    throw createHttpError(400, 'Choose an approximate budget before sending this request.')
  }

  if (!normalizedRequest.eventType) {
    throw createHttpError(400, 'Choose an event type before sending this request.')
  }

  if (!normalizedRequest.eventLocation) {
    throw createHttpError(400, 'Add the event location before sending this request.')
  }

  if (!normalizedRequest.fullAddress) {
    throw createHttpError(400, 'Add your full address before sending this request.')
  }

  if (!normalizedRequest.nearestAirport) {
    throw createHttpError(400, 'Add the nearest airport before sending this request.')
  }

  const { data, error } = await supabaseAdmin
    .from(EVENT_BOOKING_REQUESTS_TABLE)
    .insert(toEventBookingRow(normalizedRequest))
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase event booking create failed: ${error.message}`)
  }

  return fromEventBookingRow(data)
}

const reviewEventBookingRequestInSupabase = async (requestId, status) => {
  ensureSupabaseApiConfigured()
  const normalizedRequestId = toNumberOrNull(requestId)

  if (!normalizedRequestId) {
    throw createHttpError(400, 'Choose a valid booking request before reviewing it.')
  }

  const { data: currentRecord, error: currentRecordError } = await supabaseAdmin
    .from(EVENT_BOOKING_REQUESTS_TABLE)
    .select('*')
    .eq('id', normalizedRequestId)
    .maybeSingle()

  if (currentRecordError) {
    throw createHttpError(502, `Supabase event booking lookup failed: ${currentRecordError.message}`)
  }

  if (!currentRecord) {
    return null
  }

  const nextRequest = {
    ...fromEventBookingRow(currentRecord),
    status: normalizeEventBookingStatus(status),
    reviewedAt: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from(EVENT_BOOKING_REQUESTS_TABLE)
    .update(toEventBookingRow(nextRequest))
    .eq('id', normalizedRequestId)
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase event booking review failed: ${error.message}`)
  }

  return fromEventBookingRow(data)
}

const deleteEventBookingRequestInSupabase = async (requestId) => {
  ensureSupabaseApiConfigured()
  const normalizedRequestId = toNumberOrNull(requestId)

  if (!normalizedRequestId) {
    throw createHttpError(400, 'Choose a valid booking request before deleting it.')
  }

  const { data, error } = await supabaseAdmin
    .from(EVENT_BOOKING_REQUESTS_TABLE)
    .delete()
    .eq('id', normalizedRequestId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw createHttpError(502, `Supabase event booking delete failed: ${error.message}`)
  }

  return data ? fromEventBookingRow(data) : null
}

const fromSupabaseTalentRecord = (record = {}) => ({
  id: Number(record.id) || 0,
  wikidataId: trimText(record.wikidata_id),
  sourceItem: trimText(record.source_item),
  name: trimText(record.name),
  aliases: Array.isArray(record.aliases) ? record.aliases : [],
  category: trimText(record.category),
  subcategory: trimText(record.subcategory),
  initials: trimText(record.initials),
  bio: trimText(record.bio),
  avatarUrl: trimText(record.avatar_url),
  avatarOriginalUrl: trimText(record.avatar_original_url),
  avatarThumbnailUrl: trimText(record.avatar_thumbnail_url),
  avatarSrcSet: trimText(record.avatar_src_set),
  gradient: trimText(record.gradient),
  location: trimText(record.location),
  languages: Array.isArray(record.languages) ? record.languages : [],
  tags: Array.isArray(record.tags) ? record.tags : [],
  popularityScore: normalizeNonNegativeNumber(record.popularity_score, 0),
  responseTime: trimText(record.response_time),
  startingPrice: Number(record.starting_price ?? 0) || 0,
  available: record.available ?? true,
  verified: record.verified ?? true,
  shopLink: trimText(record.shop_link),
  services: Array.isArray(record.services) ? record.services : [],
  eventBooking:
    record.event_booking && typeof record.event_booking === 'object' ? record.event_booking : {},
  shopItems: Array.isArray(record.shop_items) ? record.shop_items : [],
  reviews: Array.isArray(record.reviews) ? record.reviews : [],
  rating: normalizeAverageRating(record.rating, 5),
  reviewCount: normalizeNonNegativeNumber(record.review_count, 0),
  completedBookings: normalizeNonNegativeNumber(record.completed_bookings, 0),
})

const toSupabaseTalentRecord = (record = {}) => ({
  id: Number(record.id) || null,
  wikidata_id: trimText(record.wikidataId) || null,
  source_item: trimText(record.sourceItem) || null,
  name: trimText(record.name),
  aliases: Array.isArray(record.aliases) ? record.aliases : [],
  category: trimText(record.category),
  subcategory: trimText(record.subcategory),
  initials: trimText(record.initials),
  bio: trimText(record.bio),
  avatar_url: trimText(record.avatarUrl),
  avatar_original_url: trimText(record.avatarOriginalUrl),
  avatar_thumbnail_url: trimText(record.avatarThumbnailUrl),
  avatar_src_set: trimText(record.avatarSrcSet),
  gradient: trimText(record.gradient),
  location: trimText(record.location),
  languages: Array.isArray(record.languages) ? record.languages : [],
  tags: Array.isArray(record.tags) ? record.tags : [],
  popularity_score: normalizeNonNegativeNumber(record.popularityScore, 0),
  response_time: trimText(record.responseTime) || '72h',
  starting_price: Number(record.startingPrice ?? 0) || 0,
  available: record.available ?? true,
  verified: record.verified ?? true,
  shop_link: trimText(record.shopLink),
  services: Array.isArray(record.services) ? record.services : [],
  event_booking:
    record.eventBooking && typeof record.eventBooking === 'object' ? record.eventBooking : {},
  shop_items: Array.isArray(record.shopItems) ? record.shopItems : [],
  reviews: Array.isArray(record.reviews) ? record.reviews : [],
  rating: normalizeAverageRating(record.rating, 5),
  review_count: normalizeNonNegativeNumber(
    record.reviewCount,
    Array.isArray(record.reviews) ? record.reviews.length : 0,
  ),
  completed_bookings: normalizeNonNegativeNumber(record.completedBookings, 0),
})

const listTalentsFromFile = async () =>
  (await readCatalog()).map((record, index) => normalizeTalentRecord(record, index))

const getTalentFromFile = async (talentId) =>
  (await listTalentsFromFile()).find((record) => Number(record.id) === Number(talentId)) ?? null

const createTalentInFile = async (payload) => {
  const records = await listTalentsFromFile()
  const nextTalentId = getNextTalentId(records)

  if (records.some((record) => Number(record.id) === nextTalentId)) {
    throw createHttpError(409, 'That talent id already exists in the catalog.')
  }

  const createdTalent = normalizeTalentRecord(
    {
      ...payload,
      id: nextTalentId,
    },
    records.length,
  )
  await writeCatalog([...records, createdTalent])
  return createdTalent
}

const updateTalentInFile = async (talentId, payload) => {
  const records = await listTalentsFromFile()
  const targetIndex = records.findIndex((record) => Number(record.id) === Number(talentId))

  if (targetIndex < 0) {
    return null
  }

  const updatedTalent = normalizeTalentRecord(
    {
      ...records[targetIndex],
      ...payload,
      id: Number(talentId),
    },
    targetIndex,
  )
  const nextRecords = [...records]
  nextRecords[targetIndex] = updatedTalent
  await writeCatalog(nextRecords)
  return updatedTalent
}

const deleteTalentInFile = async (talentId) => {
  const records = await listTalentsFromFile()
  const targetIndex = records.findIndex((record) => Number(record.id) === Number(talentId))

  if (targetIndex < 0) {
    return null
  }

  const removedTalent = records[targetIndex]
  await writeCatalog(records.filter((record) => Number(record.id) !== Number(talentId)))
  return removedTalent
}

const addReviewToTalentInFile = async (talentId, reviewPayload) => {
  const records = await listTalentsFromFile()
  const targetIndex = records.findIndex((record) => Number(record.id) === Number(talentId))

  if (targetIndex < 0) {
    return null
  }

  const updatedTalent = buildTalentWithAppendedReview(records[targetIndex], reviewPayload)
  const nextRecords = [...records]
  nextRecords[targetIndex] = updatedTalent
  await writeCatalog(nextRecords)
  return updatedTalent
}

const listTalentsFromSupabase = async () => {
  const { data, error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .select('*')
    .order('id', { ascending: true })

  if (error) {
    throw createHttpError(502, `Supabase talent read failed: ${error.message}`)
  }

  return (data ?? []).map((record, index) =>
    normalizeTalentRecord(fromSupabaseTalentRecord(record), index),
  )
}

const syncLocalTalentCatalogMirrorFromSupabase = async (reason = 'mutation') => {
  if (!supabaseTalentsEnabled || !localCatalogMirrorEnabled) {
    return false
  }

  try {
    await writeCatalog(await listTalentsFromSupabase())
    return true
  } catch (error) {
    console.warn(
      `Talent catalog mirror sync skipped after ${reason}: ${trimText(error?.message) || 'Unknown error.'}`,
    )
    return false
  }
}

const writeTalentToLocalCatalogMirror = async (talentRecord, reason = 'mutation') => {
  if (!supabaseTalentsEnabled || !localCatalogMirrorEnabled) {
    return false
  }

  const normalizedTalentId = toNumberOrNull(talentRecord?.id)

  if (!normalizedTalentId) {
    return false
  }

  const normalizedTalent = normalizeTalentRecord(
    talentRecord,
    Math.max(normalizedTalentId - 1, 0),
  )

  try {
    const nextRecords = [...(await listTalentsFromFile())
      .filter((record) => Number(record.id) !== normalizedTalentId), normalizedTalent]
      .sort((left, right) => Number(left.id) - Number(right.id))
      .map((record, index) => normalizeTalentRecord(record, index))

    await writeCatalog(nextRecords)
    return true
  } catch (error) {
    console.warn(
      `Talent catalog mirror local upsert failed after ${reason}: ${trimText(error?.message) || 'Unknown error.'}`,
    )
    return syncLocalTalentCatalogMirrorFromSupabase(reason)
  }
}

const removeTalentFromLocalCatalogMirror = async (talentId, reason = 'mutation') => {
  if (!supabaseTalentsEnabled || !localCatalogMirrorEnabled) {
    return false
  }

  const normalizedTalentId = toNumberOrNull(talentId)

  if (!normalizedTalentId) {
    return false
  }

  try {
    const nextRecords = (await listTalentsFromFile())
      .filter((record) => Number(record.id) !== normalizedTalentId)
      .sort((left, right) => Number(left.id) - Number(right.id))
      .map((record, index) => normalizeTalentRecord(record, index))

    await writeCatalog(nextRecords)
    return true
  } catch (error) {
    console.warn(
      `Talent catalog mirror local delete failed after ${reason}: ${trimText(error?.message) || 'Unknown error.'}`,
    )
    return syncLocalTalentCatalogMirrorFromSupabase(reason)
  }
}

const getTalentFromSupabase = async (talentId) => {
  const { data, error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .select('*')
    .eq('id', Number(talentId))
    .limit(1)

  if (error) {
    throw createHttpError(502, `Supabase talent lookup failed: ${error.message}`)
  }

  const record = Array.isArray(data) ? data[0] : null
  return record ? normalizeTalentRecord(fromSupabaseTalentRecord(record), Math.max(Number(talentId) - 1, 0)) : null
}

const getNextTalentIdFromSupabase = async () => {
  const { data, error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .select('id')
    .order('id', { ascending: false })
    .limit(1)

  if (error) {
    throw createHttpError(502, `Supabase talent id lookup failed: ${error.message}`)
  }

  const highestId = Number(Array.isArray(data) && data[0] ? data[0].id : 0)
  return highestId + 1
}

const createTalentInSupabase = async (payload) => {
  const nextTalentId = await getNextTalentIdFromSupabase()
  const createdTalent = normalizeTalentRecord(
    {
      ...payload,
      id: nextTalentId,
    },
    Math.max(nextTalentId - 1, 0),
  )
  const { data, error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .insert(toSupabaseTalentRecord(createdTalent))
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase talent create failed: ${error.message}`)
  }

  const normalizedTalent = normalizeTalentRecord(
    fromSupabaseTalentRecord(data),
    Math.max(nextTalentId - 1, 0),
  )
  await writeTalentToLocalCatalogMirror(normalizedTalent, 'talent create')
  return normalizedTalent
}

const updateTalentInSupabase = async (talentId, payload) => {
  const currentTalent = await getTalentFromSupabase(talentId)

  if (!currentTalent) {
    return null
  }

  const updatedTalent = normalizeTalentRecord(
    {
      ...currentTalent,
      ...payload,
      id: Number(talentId),
    },
    Math.max(Number(talentId) - 1, 0),
  )
  const { data, error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .update(toSupabaseTalentRecord(updatedTalent))
    .eq('id', Number(talentId))
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase talent update failed: ${error.message}`)
  }

  const normalizedTalent = normalizeTalentRecord(
    fromSupabaseTalentRecord(data),
    Math.max(Number(talentId) - 1, 0),
  )
  await writeTalentToLocalCatalogMirror(normalizedTalent, 'talent update')
  return normalizedTalent
}

const deleteTalentInSupabase = async (talentId) => {
  const currentTalent = await getTalentFromSupabase(talentId)

  if (!currentTalent) {
    return null
  }

  const { error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .delete()
    .eq('id', Number(talentId))

  if (error) {
    throw createHttpError(502, `Supabase talent delete failed: ${error.message}`)
  }

  await removeTalentFromLocalCatalogMirror(currentTalent.id, 'talent delete')
  return currentTalent
}

const addReviewToTalentInSupabase = async (talentId, reviewPayload) => {
  const currentTalent = await getTalentFromSupabase(talentId)

  if (!currentTalent) {
    return null
  }

  const updatedTalent = buildTalentWithAppendedReview(currentTalent, reviewPayload)
  const { data, error } = await supabaseAdmin
    .from(TALENTS_TABLE)
    .update(toSupabaseTalentRecord(updatedTalent))
    .eq('id', Number(talentId))
    .select('*')
    .single()

  if (error) {
    throw createHttpError(502, `Supabase talent review write failed: ${error.message}`)
  }

  const normalizedTalent = normalizeTalentRecord(
    fromSupabaseTalentRecord(data),
    Math.max(Number(talentId) - 1, 0),
  )
  await writeTalentToLocalCatalogMirror(normalizedTalent, 'talent review update')
  return normalizedTalent
}

const listTalents = async () =>
  supabaseTalentsEnabled ? listTalentsFromSupabase() : listTalentsFromFile()

const getTalent = async (talentId) =>
  supabaseTalentsEnabled ? getTalentFromSupabase(talentId) : getTalentFromFile(talentId)

const createTalent = async (payload) =>
  supabaseTalentsEnabled ? createTalentInSupabase(payload) : createTalentInFile(payload)

const updateTalent = async (talentId, payload) =>
  supabaseTalentsEnabled ? updateTalentInSupabase(talentId, payload) : updateTalentInFile(talentId, payload)

const deleteTalent = async (talentId) =>
  supabaseTalentsEnabled ? deleteTalentInSupabase(talentId) : deleteTalentInFile(talentId)

const addReviewToTalent = async (talentId, reviewPayload) =>
  supabaseTalentsEnabled
    ? addReviewToTalentInSupabase(talentId, reviewPayload)
    : addReviewToTalentInFile(talentId, reviewPayload)

const buildTalentWithAppendedReview = (currentTalent, reviewPayload = {}) => {
  const trimmedComment = trimText(reviewPayload.comment)

  if (!trimmedComment) {
    throw createHttpError(400, 'Add a short review before submitting.')
  }

  const normalizedUserId =
    reviewPayload.userId == null || reviewPayload.userId === ''
      ? null
      : Number.isFinite(Number(reviewPayload.userId))
        ? Number(reviewPayload.userId)
        : null

  if (
    normalizedUserId != null &&
    currentTalent.reviews.some((existingReview) => existingReview.userId === normalizedUserId)
  ) {
    throw createHttpError(409, 'You already left a review for this talent.')
  }

  const nextReview = {
    ...reviewPayload,
    userId: normalizedUserId,
    authorName: trimText(reviewPayload.authorName) || 'CrownPoint Member',
    authorLocation: trimText(reviewPayload.authorLocation),
    comment: trimmedComment,
    createdAt: reviewPayload.createdAt ?? new Date().toISOString(),
    verified: reviewPayload.verified ?? true,
    rating: normalizeReviewRating(reviewPayload.rating, 5),
  }
  const currentReviewCount = Math.max(
    normalizeNonNegativeNumber(currentTalent.reviewCount, currentTalent.reviews.length),
    currentTalent.reviews.length,
  )
  const currentRating = normalizeAverageRating(
    currentTalent.rating,
    currentTalent.reviews.length ? currentTalent.reviews[0].rating : nextReview.rating,
  )
  const nextReviewCount = currentReviewCount + 1
  const nextRating = Number(
    (((currentRating * currentReviewCount) + nextReview.rating) / nextReviewCount).toFixed(1),
  )

  return normalizeTalentRecord(
    {
      ...currentTalent,
      rating: nextRating,
      reviewCount: nextReviewCount,
      reviews: [nextReview, ...currentTalent.reviews],
    },
    Math.max(Number(currentTalent.id) - 1, 0),
  )
}

export const handleTalentApiRequest = async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const pathParts = requestUrl.pathname.split('/').filter(Boolean)

  if (request.method === 'OPTIONS') {
    sendEmpty(response)
    return
  }

  try {
    if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'health') {
      sendJson(response, 200, {
        status: 'ok',
        catalogPath,
        storageMode: supabaseTalentsEnabled ? 'supabase' : 'file',
        commerceTablesReady: supabaseServerConfigured,
        updatedAt: new Date().toISOString(),
      })
      return
    }

    if (
      pathParts.length === 3 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'users' &&
      pathParts[2] === 'me' &&
      request.method === 'DELETE'
    ) {
      sendJson(response, 200, await deleteCurrentUserInSupabase(request))
      return
    }

    if (
      pathParts.length === 2 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'payment-settings'
    ) {
      if (request.method === 'GET') {
        sendJson(response, 200, await listPaymentSettingsInSupabase())
        return
      }
    }

    if (
      pathParts.length === 3 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'payment-settings'
    ) {
      const currencyCode = normalizeCurrencyCode(pathParts[2], '')

      if (!currencyCode) {
        throw createHttpError(400, 'Choose a valid payment settings currency.')
      }

      if (request.method === 'PUT' || request.method === 'PATCH') {
        await requireAdminAccess(request)
        sendJson(
          response,
          200,
          await updatePaymentSettingsInSupabase(
            request,
            currencyCode,
            await collectJsonBody(request),
          ),
        )
        return
      }
    }

    if (
      pathParts.length === 2 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'membership-requests'
    ) {
      if (request.method === 'GET') {
        const authUser = await requireAuthenticatedUser(
          request,
          'Sign in before loading membership requests.',
        )
        sendJson(response, 200, await listMembershipRequestsForAuthUser(authUser))
        return
      }

      if (request.method === 'POST') {
        const authUser = await requireAuthenticatedUser(
          request,
          'Sign in before submitting a membership request.',
        )
        sendJson(
          response,
          201,
          await createMembershipRequestInSupabase(authUser, await collectJsonBody(request)),
        )
        return
      }
    }

    if (
      pathParts.length === 3 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'membership-requests'
    ) {
      const requestId = toNumberOrNull(pathParts[2])

      if (!requestId) {
        throw createHttpError(400, 'Choose a valid membership request.')
      }

      if (request.method === 'PATCH') {
        await requireAdminAccess(request)
        const payload = await collectJsonBody(request)
        const reviewedRequest = await reviewMembershipRequestInSupabase(
          requestId,
          payload.status,
        )

        if (!reviewedRequest) {
          throw createHttpError(404, 'That membership request could not be found.')
        }

        sendJson(response, 200, reviewedRequest)
        return
      }
    }

    if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'orders') {
      if (request.method === 'GET') {
        const authUser = await requireAuthenticatedUser(
          request,
          'Sign in before loading your orders.',
        )
        sendJson(response, 200, await listOrdersForAuthUser(authUser))
        return
      }

      if (request.method === 'POST') {
        sendJson(response, 201, await createOrderInSupabase(request, await collectJsonBody(request)))
        return
      }
    }

    if (
      pathParts.length === 4 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'orders' &&
      pathParts[2] === 'ref' &&
      request.method === 'GET'
    ) {
      const order = await getOrderByRefCodeFromSupabase(request, pathParts[3])

      if (!order) {
        throw createHttpError(404, 'That order could not be found.')
      }

      sendJson(response, 200, order)
      return
    }

    if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'orders') {
      const orderId = toNumberOrNull(pathParts[2])

      if (!orderId) {
        throw createHttpError(400, 'Choose a valid order.')
      }

      if (request.method === 'PATCH') {
        await requireAdminAccess(request)
        const payload = await collectJsonBody(request)
        const reviewedOrder = await reviewOrderInSupabase(orderId, payload.status)

        if (!reviewedOrder) {
          throw createHttpError(404, 'That order could not be found.')
        }

        sendJson(response, 200, reviewedOrder)
        return
      }
    }

    if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'event-bookings') {
      if (request.method === 'GET') {
        const authUser = await requireAuthenticatedUser(
          request,
          'Sign in before loading booking requests.',
        )
        sendJson(response, 200, await listEventBookingRequestsForAuthUser(authUser))
        return
      }

      if (request.method === 'POST') {
        sendJson(
          response,
          201,
          await createEventBookingRequestInSupabase(request, await collectJsonBody(request)),
        )
        return
      }
    }

    if (
      pathParts.length === 3 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'event-bookings'
    ) {
      const eventBookingRequestId = toNumberOrNull(pathParts[2])

      if (!eventBookingRequestId) {
        throw createHttpError(400, 'Choose a valid booking request.')
      }

      if (request.method === 'PATCH') {
        await requireAdminAccess(request)
        const payload = await collectJsonBody(request)
        const reviewedRequest = await reviewEventBookingRequestInSupabase(
          eventBookingRequestId,
          payload.status,
        )

        if (!reviewedRequest) {
          throw createHttpError(404, 'That booking request could not be found.')
        }

        sendJson(response, 200, reviewedRequest)
        return
      }

      if (request.method === 'DELETE') {
        await requireAdminAccess(request)
        const deletedRequest = await deleteEventBookingRequestInSupabase(eventBookingRequestId)

        if (!deletedRequest) {
          throw createHttpError(404, 'That booking request could not be found.')
        }

        sendJson(response, 200, deletedRequest)
        return
      }
    }

    if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'message-threads') {
      if (request.method === 'GET') {
        const authUser = await requireAuthenticatedUser(
          request,
          'Sign in before loading message threads.',
        )
        sendJson(
          response,
          200,
          await listMessageThreadsForAuthUser(authUser, {
            talentId: requestUrl.searchParams.get('talentId'),
          }),
        )
        return
      }

      if (request.method === 'POST') {
        sendJson(
          response,
          201,
          await createMessageThreadInSupabase(request, await collectJsonBody(request)),
        )
        return
      }
    }

    if (
      pathParts.length === 4 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'message-threads' &&
      pathParts[3] === 'messages'
    ) {
      if (request.method === 'POST') {
        const updatedThread = await createMessageInSupabase(
          request,
          pathParts[2],
          await collectJsonBody(request),
        )

        if (!updatedThread) {
          throw createHttpError(404, 'That message thread could not be found.')
        }

        sendJson(response, 200, updatedThread)
        return
      }
    }

    if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'talents') {
      if (request.method === 'GET') {
        sendJson(response, 200, await listTalents())
        return
      }

      if (request.method === 'POST') {
        await requireAdminAccess(request)
        sendJson(response, 201, await createTalent(await collectJsonBody(request)))
        return
      }
    }

    if (
      pathParts.length === 3 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'talents' &&
      pathParts[2] === 'featured' &&
      request.method === 'GET'
    ) {
      const requestedLimit = Number(requestUrl.searchParams.get('limit'))
      const limit =
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.floor(requestedLimit)
          : FEATURED_TALENT_LIMIT
      const talents = await listTalents()
      sendJson(response, 200, talents.filter((talent) => talent.available).slice(0, limit))
      return
    }

    if (
      pathParts.length === 4 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'talents' &&
      pathParts[3] === 'reviews' &&
      request.method === 'POST'
    ) {
      const talentId = resolveTalentId(pathParts[2])

      if (talentId == null) {
        throw createHttpError(400, 'Choose a valid talent before leaving a review.')
      }

      const updatedTalent = await addReviewToTalent(talentId, await collectJsonBody(request))

      if (!updatedTalent) {
        throw createHttpError(404, 'That talent could not be found.')
      }

      sendJson(response, 200, updatedTalent)
      return
    }

    if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'talents') {
      const talentId = resolveTalentId(pathParts[2])

      if (talentId == null) {
        throw createHttpError(400, 'Choose a valid talent id.')
      }

      if (request.method === 'GET') {
        const talent = await getTalent(talentId)

        if (!talent) {
          throw createHttpError(404, 'That talent could not be found.')
        }

        sendJson(response, 200, talent)
        return
      }

      if (request.method === 'PATCH') {
        await requireAdminAccess(request)
        const updatedTalent = await updateTalent(talentId, await collectJsonBody(request))

        if (!updatedTalent) {
          throw createHttpError(404, 'That talent could not be found.')
        }

        sendJson(response, 200, updatedTalent)
        return
      }

      if (request.method === 'DELETE') {
        await requireAdminAccess(request)
        const removedTalent = await deleteTalent(talentId)

        if (!removedTalent) {
          throw createHttpError(404, 'That talent could not be found.')
        }

        sendJson(response, 200, removedTalent)
        return
      }
    }

    throw createHttpError(404, 'Route not found.')
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500
    const message =
      trimText(error?.message) ||
      'The talent API hit an unexpected problem.'

    if (statusCode >= 500) {
      console.error(error)
    }

    sendJson(response, statusCode, { message })
  }
}

export const handleUnifiedAppRequest = async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
    return handleTalentApiRequest(request, response)
  }

  if (await serveBuiltFrontend(request, response, requestUrl)) {
    return
  }

  sendJson(response, 404, {
    message: 'That page could not be found.',
  })
}

export const createTalentApiServer = () => {
  const server = createServer(handleUnifiedAppRequest)

  server.on('clientError', (error, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    console.error(error)
  })

  return server
}

export default handleTalentApiRequest

if (runningAsStandaloneServer) {
  const server = createTalentApiServer()

  server.listen(API_PORT, () => {
    console.log(
      JSON.stringify(
        {
          message: 'Talent catalog API running',
          port: API_PORT,
          catalogPath,
          storageMode: supabaseTalentsEnabled ? 'supabase' : 'file',
          localCatalogMirrorEnabled,
        },
        null,
        2,
      ),
    )
  })
}
