import api from '../utils/api'
import { DEMO_USER_EMAIL, DEMO_USER_ID, getUserById, isDemoUserId } from './authService'
import { generateRef } from '../utils/generateRef'
import {
  BACKEND_REQUIRED_MESSAGE,
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  SUPABASE_AUTH_ENABLED,
} from '../utils/backendConfig'
import { ORDER_STATUS, ORDER_TYPES, PAYMENT_METHODS } from '../utils/constants'
import {
  createEmptyCheckoutContact,
  createEmptyShippingAddress,
  getShippingAddressSummary,
  normalizeCheckoutContact,
  normalizeShippingAddress,
} from '../utils/checkout'

const ORDERS_KEY = 'crownpoint_orders'
const ORDER_UPDATED_EVENT = 'crownpoint:orders-updated'
const ORDER_API_START_HINT =
  'Start `npm run api` so orders can persist through the backend API.'
const ORDER_BACKEND_ENABLED = SUPABASE_AUTH_ENABLED
const ORDER_LOCAL_FALLBACKS_ENABLED = LOCAL_BACKEND_FALLBACKS_ENABLED

let hasWarnedOrderBackendUnavailable = false

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

const warnOrderBackendUnavailable = (error) => {
  if (hasWarnedOrderBackendUnavailable) {
    return
  }

  hasWarnedOrderBackendUnavailable = true
  console.warn(
    `Falling back to browser-stored orders because the backend API is unavailable. ${readApiErrorMessage(error, ORDER_API_START_HINT)}`,
  )
}

const shouldFallbackToLocalOrderStore = (error) =>
  !error?.response || Number(error.response.status) >= 500

const defaultOrder = {
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
  refCode: null,
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
  createdAt: null,
  submittedAt: null,
  reviewedAt: null,
}

const getRiskLevel = (paymentMethod) => {
  switch (paymentMethod) {
    case PAYMENT_METHODS.CRYPTO:
      return 'high'
    case PAYMENT_METHODS.GIFT_CARD:
      return 'medium'
    default:
      return 'low'
  }
}

const getEtaForStatus = (status, orderType = ORDER_TYPES.SERVICE) => {
  switch (status) {
    case ORDER_STATUS.UNDER_REVIEW:
      return 'Awaiting payment check'
    case ORDER_STATUS.FLAGGED:
      return 'Flagged for manual review'
    case ORDER_STATUS.PAID:
      return orderType === ORDER_TYPES.TICKET
        ? 'Tickets are being released'
        : 'Payment approved / fulfillment preparing'
    case ORDER_STATUS.IN_PROGRESS:
      return orderType === ORDER_TYPES.TICKET
        ? 'Ticket confirmation preparing'
        : 'Fulfillment in motion'
    case ORDER_STATUS.COMPLETED:
      return 'Order completed'
    case ORDER_STATUS.FAILED:
      return 'Payment was rejected'
    default:
      return ''
  }
}

const buildProofSummary = (order) => {
  if (order.proofSummary) {
    return order.proofSummary
  }

  switch (order.paymentMethod) {
    case PAYMENT_METHODS.GIFT_CARD:
      return order.paymentProof
        ? `Gift card code ${order.paymentProof} submitted for manual validation.`
        : 'Gift card code submitted for manual validation.'
    case PAYMENT_METHODS.CRYPTO:
      return order.paymentProof
        ? `Crypto transaction hash ${order.paymentProof} submitted for verification.`
        : 'Crypto transaction hash submitted for verification.'
    case PAYMENT_METHODS.BANK:
    default:
      return order.paymentProofFileName
        ? `Payment proof uploaded: ${order.paymentProofFileName}.`
        : 'Payment proof uploaded for review.'
  }
}

const normalizeOrderRecord = (order = {}) => {
  const totalPrice =
    typeof order.totalPrice === 'number'
      ? order.totalPrice
      : typeof order.amount === 'number'
        ? order.amount
        : 0
  const createdAt = order.createdAt ?? order.submittedAt ?? (order.date ? new Date(order.date).toISOString() : null)
  const submittedAt = order.submittedAt ?? createdAt
  const contact = normalizeCheckoutContact(order.contact)
  const shippingAddress = normalizeShippingAddress(order.shippingAddress)
  const requestedFor =
    order.requestedFor ??
    (order.orderType === ORDER_TYPES.SHOP ? getShippingAddressSummary(shippingAddress) : '')
  const normalized = {
    ...defaultOrder,
    ...order,
    id: Number(order.id ?? 0) || order.id,
    userId: order.userId == null ? null : Number(order.userId) || null,
    contact,
    shippingAddress,
    totalPrice,
    createdAt,
    submittedAt,
    talentName: order.talentName ?? order.talent?.name ?? 'Selected talent',
    fanName: order.fanName ?? contact.fullName ?? 'Guest Checkout',
    email: order.email ?? contact.email ?? '',
    status: order.status ?? ORDER_STATUS.PENDING_PAYMENT,
    orderType: order.orderType ?? ORDER_TYPES.SERVICE,
    items: Array.isArray(order.items) ? order.items : [],
    requestedFor,
    region: order.region ?? shippingAddress.country ?? defaultOrder.region,
  }

  return {
    ...normalized,
    proofSummary: buildProofSummary(normalized),
    risk: order.risk ?? getRiskLevel(normalized.paymentMethod),
  }
}

const getLegacySeedOrders = () => [
  {
    id: 1001,
    userId: DEMO_USER_ID,
    fanName: 'Amara Okafor',
    email: DEMO_USER_EMAIL,
    refCode: 'A92KX',
    orderType: ORDER_TYPES.SERVICE,
    talentName: 'Taylor Swift',
    service: 'Personal Video Message',
    totalPrice: 499,
    status: ORDER_STATUS.UNDER_REVIEW,
    requestedFor: 'Arielle - birthday surprise',
    eta: 'Review in progress',
    paymentMethod: PAYMENT_METHODS.BANK,
    proofSummary: 'Bank transfer receipt with matching beneficiary name.',
    region: 'United States',
    risk: 'low',
    submittedAt: '2026-04-06T11:52:00.000Z',
  },
  {
    id: 1002,
    userId: DEMO_USER_ID,
    fanName: 'Amara Okafor',
    email: DEMO_USER_EMAIL,
    refCode: 'Q7M3P',
    orderType: ORDER_TYPES.SERVICE,
    talentName: 'LeBron James',
    service: 'Signed Note',
    totalPrice: 899,
    status: ORDER_STATUS.IN_PROGRESS,
    requestedFor: 'Collector thank-you note',
    eta: 'Production in progress',
    paymentMethod: PAYMENT_METHODS.GIFT_CARD,
    proofSummary: 'Gift card payment was confirmed and the request moved into production.',
    region: 'United States',
    risk: 'medium',
    submittedAt: '2026-04-02T09:24:00.000Z',
  },
  {
    id: 1003,
    userId: DEMO_USER_ID,
    fanName: 'Amara Okafor',
    email: DEMO_USER_EMAIL,
    refCode: 'N4Z8R',
    orderType: ORDER_TYPES.SERVICE,
    talentName: 'Keanu Reeves',
    service: 'Private Live Call',
    totalPrice: 999,
    status: ORDER_STATUS.COMPLETED,
    requestedFor: 'Film club donor thank-you',
    eta: 'Delivered Mar 28, 2026',
    paymentMethod: PAYMENT_METHODS.CRYPTO,
    proofSummary: 'Crypto payment cleared and the call was delivered.',
    region: 'United States',
    risk: 'high',
    submittedAt: '2026-03-20T16:08:00.000Z',
  },
  {
    id: 1004,
    userId: 901,
    fanName: 'Marcus Williams',
    email: 'marcus@example.com',
    refCode: 'L8T2V',
    orderType: ORDER_TYPES.SERVICE,
    talentName: 'Kai Cenat',
    service: 'VIP Access Package',
    totalPrice: 299,
    status: ORDER_STATUS.UNDER_REVIEW,
    requestedFor: 'Premium access request',
    eta: 'Awaiting payment check',
    paymentMethod: PAYMENT_METHODS.GIFT_CARD,
    proofSummary: 'Apple gift card code pending denomination validation.',
    region: 'United Kingdom',
    risk: 'medium',
    submittedAt: '2026-04-08T12:46:00.000Z',
  },
  {
    id: 1005,
    userId: 902,
    fanName: 'Sofia Reyes',
    email: 'sofia@example.com',
    refCode: 'J5W1N',
    orderType: ORDER_TYPES.SERVICE,
    talentName: 'Bruno Mars',
    service: 'Private Live Call',
    totalPrice: 799,
    status: ORDER_STATUS.UNDER_REVIEW,
    requestedFor: 'Premium live call',
    eta: 'Awaiting payment check',
    paymentMethod: PAYMENT_METHODS.CRYPTO,
    proofSummary: 'Hash supplied, wallet mismatch requires manual escalation.',
    region: 'Mexico',
    risk: 'high',
    submittedAt: '2026-04-08T12:39:00.000Z',
  },
]

const getDemoSeedOrders = () =>
  getLegacySeedOrders().filter((order) => order.userId === DEMO_USER_ID)

const writeOrdersToStorage = (orders) => {
  if (!ORDER_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.map(normalizeOrderRecord)))
}

const emitOrderUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ORDER_UPDATED_EVENT))
  }
}

const areOrdersEquivalent = (left, right) =>
  JSON.stringify(normalizeOrderRecord(left)) === JSON.stringify(normalizeOrderRecord(right))

const stripLegacySeedOrders = (orders = []) => {
  const seededByRefCode = new Map(
    getLegacySeedOrders().map((order) => [order.refCode, normalizeOrderRecord(order)]),
  )

  return orders.filter((order) => {
    const seededOrder = seededByRefCode.get(order.refCode)

    if (!seededOrder) {
      return true
    }

    return !areOrdersEquivalent(order, seededOrder)
  })
}

const readOrdersFromStorage = () => {
  if (!ORDER_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return []
  }

  const storedOrders = window.localStorage.getItem(ORDERS_KEY)

  if (!storedOrders) {
    return []
  }

  try {
    const parsedOrders = JSON.parse(storedOrders)
    return stripLegacySeedOrders(
      Array.isArray(parsedOrders) ? parsedOrders.map(normalizeOrderRecord) : [],
    )
  } catch {
    window.localStorage.removeItem(ORDERS_KEY)
    return []
  }
}

const sortByNewest = (orders) =>
  [...orders].sort(
    (left, right) =>
      new Date(right.submittedAt ?? right.createdAt ?? 0) -
      new Date(left.submittedAt ?? left.createdAt ?? 0),
  )

let ordersCache = sortByNewest(readOrdersFromStorage())

const syncOrdersCache = (orders, { emit = false, persist = true } = {}) => {
  ordersCache = sortByNewest(
    stripLegacySeedOrders(
      Array.isArray(orders) ? orders.map(normalizeOrderRecord) : [],
    ),
  )

  if (persist) {
    writeOrdersToStorage(ordersCache)
  }

  if (emit) {
    emitOrderUpdate()
  }

  return ordersCache
}

const buildOrderIdentityMatch = (candidate, order) =>
  (order.id && candidate.id === order.id) ||
  (candidate.refCode && order.refCode && candidate.refCode === order.refCode)

const mergeOrdersByRefCode = (persistedOrders = [], seededOrders = []) => {
  const ordersByRefCode = new Map()

  seededOrders
    .map(normalizeOrderRecord)
    .forEach((order) => {
      ordersByRefCode.set(order.refCode, order)
    })

  persistedOrders
    .map(normalizeOrderRecord)
    .forEach((order) => {
      ordersByRefCode.set(order.refCode, order)
    })

  return [...ordersByRefCode.values()]
}

const getUserScopedOrders = (userId) => {
  const persistedOrders = getOrders().filter((order) => order.userId === Number(userId))

  if (!isDemoUserId(userId)) {
    return persistedOrders
  }

  return mergeOrdersByRefCode(persistedOrders, getDemoSeedOrders())
}

const submitOrderPaymentLocally = (orderData) => {
  const existingUser = orderData.userId ? getUserById(orderData.userId) : null
  const now = new Date().toISOString()
  const normalizedContact = normalizeCheckoutContact(
    orderData.contact ?? {
      fullName: orderData.fanName ?? existingUser?.name,
      email: orderData.email ?? existingUser?.email,
    },
  )
  const normalizedShippingAddress = normalizeShippingAddress(orderData.shippingAddress)
  const nextOrder = normalizeOrderRecord({
    ...orderData,
    id: orderData.id ?? Date.now(),
    refCode: orderData.refCode ?? generateRef(),
    userId: orderData.userId ?? null,
    fanName: orderData.fanName ?? normalizedContact.fullName ?? existingUser?.name ?? 'Guest Checkout',
    email: orderData.email ?? normalizedContact.email ?? existingUser?.email ?? '',
    contact: normalizedContact,
    shippingAddress: normalizedShippingAddress,
    talentName: orderData.talentName ?? orderData.talent?.name,
    status: ORDER_STATUS.UNDER_REVIEW,
    createdAt: orderData.createdAt ?? now,
    submittedAt: now,
    reviewedAt: null,
    requestedFor:
      orderData.requestedFor ??
      (orderData.orderType === ORDER_TYPES.SHOP
        ? getShippingAddressSummary(normalizedShippingAddress)
        : ''),
    region:
      orderData.region ??
      normalizedShippingAddress.country ??
      existingUser?.profile?.country ??
      defaultOrder.region,
    eta: getEtaForStatus(ORDER_STATUS.UNDER_REVIEW, orderData.orderType),
  })

  let savedOrder = nextOrder
  const nextOrders = ordersCache.map((candidate) => {
    if (!buildOrderIdentityMatch(candidate, nextOrder)) {
      return candidate
    }

    savedOrder = {
      ...candidate,
      ...nextOrder,
      id: candidate.id,
      createdAt: candidate.createdAt ?? nextOrder.createdAt,
    }

    return normalizeOrderRecord(savedOrder)
  })

  if (!nextOrders.some((candidate) => buildOrderIdentityMatch(candidate, nextOrder))) {
    nextOrders.push(savedOrder)
  }

  syncOrdersCache(nextOrders, { emit: true })
  return normalizeOrderRecord(savedOrder)
}

const reviewPaymentOrderLocally = (orderId, status) => {
  let reviewedOrder = null
  const reviewTimestamp = new Date().toISOString()

  const nextOrders = ordersCache.map((candidate) => {
    if (`${candidate.id}` !== `${orderId}`) {
      return candidate
    }

    reviewedOrder = normalizeOrderRecord({
      ...candidate,
      status,
      reviewedAt: reviewTimestamp,
      eta: getEtaForStatus(status, candidate.orderType),
    })

    return reviewedOrder
  })

  if (!reviewedOrder) {
    return null
  }

  syncOrdersCache(nextOrders, { emit: true })
  return reviewedOrder
}

export const createOrder = async (orderData) =>
  Promise.resolve({
    id: Date.now(),
    refCode: orderData.refCode ?? generateRef(),
    status: ORDER_STATUS.PENDING_PAYMENT,
    createdAt: new Date().toISOString(),
    ...orderData,
  })

export const getOrders = () => ordersCache

export const refreshOrders = async () => {
  if (!ORDER_BACKEND_ENABLED) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return getOrders()
  }

  try {
    const response = await api.get('/orders')
    return syncOrdersCache(response.data, { emit: true })
  } catch (error) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(readApiErrorMessage(error, BACKEND_REQUIRED_MESSAGE))
    }

    if (error?.response?.status && Number(error.response.status) < 500) {
      return getOrders()
    }

    warnOrderBackendUnavailable(error)
    return getOrders()
  }
}

export const subscribeToOrderUpdates = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getOrders())
  const handleStorage = (event) => {
    if (event.key === ORDERS_KEY) {
      ordersCache = sortByNewest(readOrdersFromStorage())
      listener(getOrders())
    }
  }

  window.addEventListener(ORDER_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(ORDER_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
  }
}

export const getUserOrders = (userId) => sortByNewest(getUserScopedOrders(userId))

export const getPaymentQueue = () =>
  sortByNewest(
    getOrders().filter(
      (order) =>
        order.paymentMethod &&
        order.status !== ORDER_STATUS.PENDING_PAYMENT,
    ),
  )

export const getOrderById = (orderId) => {
  const order = getOrders().find((candidate) => `${candidate.id}` === `${orderId}`)
  return order ? normalizeOrderRecord(order) : null
}

export const getOrderByRefCode = (refCode, userId = null) => {
  const normalizedRefCode = refCode?.trim().toUpperCase()

  if (!normalizedRefCode) {
    return null
  }

  const orders = userId == null ? getOrders() : getUserScopedOrders(userId)
  const order = orders.find((candidate) => {
    if (candidate.refCode?.toUpperCase() !== normalizedRefCode) {
      return false
    }

    return userId == null || candidate.userId === Number(userId)
  })

  return order ? normalizeOrderRecord(order) : null
}

export const fetchOrderByRefCode = async (refCode, userId = null) => {
  const normalizedRefCode = refCode?.trim().toUpperCase()

  if (!normalizedRefCode) {
    return getOrderByRefCode(refCode, userId)
  }

  if (!ORDER_BACKEND_ENABLED) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return getOrderByRefCode(refCode, userId)
  }

  try {
    const response = await api.get(`/orders/ref/${encodeURIComponent(normalizedRefCode)}`)
    const persistedOrder = normalizeOrderRecord(response.data)
    syncOrdersCache(
      [
        persistedOrder,
        ...ordersCache.filter((order) => order.refCode?.toUpperCase() !== normalizedRefCode),
      ],
      { emit: true },
    )
    return persistedOrder
  } catch (error) {
    if (error?.response?.status === 404) {
      return getOrderByRefCode(refCode, userId)
    }

    if (!ORDER_LOCAL_FALLBACKS_ENABLED || !shouldFallbackToLocalOrderStore(error)) {
      throw new Error(readApiErrorMessage(error, 'We could not load that order right now.'))
    }

    warnOrderBackendUnavailable(error)
    return getOrderByRefCode(refCode, userId)
  }
}

export const submitOrderPayment = async (orderData) => {
  if (!ORDER_BACKEND_ENABLED) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return submitOrderPaymentLocally(orderData)
  }

  try {
    const response = await api.post('/orders', orderData)
    const savedOrder = normalizeOrderRecord(response.data)
    syncOrdersCache(
      [
        savedOrder,
        ...ordersCache.filter((order) => order.refCode !== savedOrder.refCode),
      ],
      { emit: true },
    )
    return savedOrder
  } catch (error) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED || !shouldFallbackToLocalOrderStore(error)) {
      throw new Error(readApiErrorMessage(error, 'We could not submit that order right now.'))
    }

    warnOrderBackendUnavailable(error)
    return submitOrderPaymentLocally(orderData)
  }
}

export const reviewPaymentOrder = async (orderId, status) => {
  if (!ORDER_BACKEND_ENABLED) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return reviewPaymentOrderLocally(orderId, status)
  }

  try {
    const response = await api.patch(`/orders/${orderId}`, { status })
    const reviewedOrder = normalizeOrderRecord(response.data)
    syncOrdersCache(
      ordersCache.map((order) =>
        `${order.id}` === `${reviewedOrder.id}` ? reviewedOrder : order,
      ),
      { emit: true },
    )
    return reviewedOrder
  } catch (error) {
    if (!ORDER_LOCAL_FALLBACKS_ENABLED || !shouldFallbackToLocalOrderStore(error)) {
      throw new Error(readApiErrorMessage(error, 'We could not update that order right now.'))
    }

    warnOrderBackendUnavailable(error)
    return reviewPaymentOrderLocally(orderId, status)
  }
}

export const removeUserOrders = (userId) => {
  const normalizedUserId = Number(userId)
  const currentOrders = getOrders()
  const nextOrders = currentOrders.filter((order) => order.userId !== normalizedUserId)

  if (nextOrders.length !== currentOrders.length) {
    syncOrdersCache(nextOrders, { emit: true })
  }

  return currentOrders.length - nextOrders.length
}
