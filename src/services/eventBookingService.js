import api from '../utils/api'
import { getTalentSnapshotById } from './talentService'
import { getUserById } from './authService'
import {
  BACKEND_REQUIRED_MESSAGE,
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  SUPABASE_AUTH_ENABLED,
} from '../utils/backendConfig'

const EVENT_BOOKING_REQUESTS_KEY = 'crownpoint_event_booking_requests'
const EVENT_BOOKING_UPDATED_EVENT = 'crownpoint:event-booking-updated'
const EVENT_BOOKING_API_START_HINT =
  'Start `npm run api` so event booking requests can persist through the backend API.'
const EVENT_BOOKING_BACKEND_ENABLED = SUPABASE_AUTH_ENABLED
const EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED = LOCAL_BACKEND_FALLBACKS_ENABLED

export const EVENT_BOOKING_REQUEST_STATUS = {
  NEW: 'NEW',
  IN_REVIEW: 'IN_REVIEW',
  IN_TOUCH: 'IN_TOUCH',
  CLOSED: 'CLOSED',
}

const defaultRequest = {
  id: null,
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

let hasWarnedEventBookingBackendUnavailable = false

const trimText = (value) => String(value ?? '').trim()

const readApiErrorMessage = (error, fallbackMessage) =>
  String(error?.response?.data?.message ?? error?.message ?? fallbackMessage)

const warnEventBookingBackendUnavailable = (error) => {
  if (hasWarnedEventBookingBackendUnavailable) {
    return
  }

  hasWarnedEventBookingBackendUnavailable = true
  console.warn(
    `Falling back to the cached event booking view because the backend API is unavailable. ${readApiErrorMessage(error, EVENT_BOOKING_API_START_HINT)}`,
  )
}

const normalizeStatus = (status, fallback = EVENT_BOOKING_REQUEST_STATUS.NEW) => {
  const normalizedStatus = trimText(status).toUpperCase()
  return Object.values(EVENT_BOOKING_REQUEST_STATUS).includes(normalizedStatus)
    ? normalizedStatus
    : fallback
}

const normalizeDate = (value) => {
  const normalizedValue = trimText(value)

  if (!normalizedValue) {
    return ''
  }

  const normalizedDate = new Date(normalizedValue)

  if (Number.isNaN(normalizedDate.getTime())) {
    return ''
  }

  return normalizedDate.toISOString().slice(0, 10)
}

const normalizeRequest = (request = {}) => ({
  ...defaultRequest,
  ...request,
  id: Number(request.id) || request.id || Date.now(),
  userId: request.userId == null ? null : Number(request.userId) || null,
  authUserId: trimText(request.authUserId),
  talentId: Number(request.talentId) || null,
  talentName: trimText(request.talentName),
  celebrityName: trimText(request.celebrityName),
  eventDate: normalizeDate(request.eventDate),
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
  status: normalizeStatus(request.status),
  submittedAt: request.submittedAt ?? new Date().toISOString(),
  reviewedAt: request.reviewAt ?? request.reviewedAt ?? null,
})

const emitEventBookingUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_BOOKING_UPDATED_EVENT))
  }
}

const writeRequestsSilently = (requests) => {
  if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    EVENT_BOOKING_REQUESTS_KEY,
    JSON.stringify(requests.map(normalizeRequest)),
  )
}

const sortByNewest = (requests) =>
  [...requests].sort(
    (left, right) =>
      new Date(right.submittedAt ?? 0).getTime() -
      new Date(left.submittedAt ?? 0).getTime(),
  )

const readRequestsFromStorage = () => {
  if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return []
  }

  const storedRequests = window.localStorage.getItem(EVENT_BOOKING_REQUESTS_KEY)

  if (!storedRequests) {
    return []
  }

  try {
    const parsedRequests = JSON.parse(storedRequests)
    return Array.isArray(parsedRequests) ? parsedRequests.map(normalizeRequest) : []
  } catch {
    window.localStorage.removeItem(EVENT_BOOKING_REQUESTS_KEY)
    return []
  }
}

let eventBookingRequestsCache = sortByNewest(readRequestsFromStorage())

const syncRequestsCache = (requests, { emit = false, persist = true } = {}) => {
  eventBookingRequestsCache = sortByNewest(
    Array.isArray(requests) ? requests.map(normalizeRequest) : [],
  )

  if (persist) {
    writeRequestsSilently(eventBookingRequestsCache)
  }

  if (emit) {
    emitEventBookingUpdate()
  }

  return eventBookingRequestsCache
}

const validateRequestPayload = (payload = {}) => {
  if (!payload.fullName) {
    throw new Error('Add your full name before sending this request.')
  }

  if (!payload.jobTitle) {
    throw new Error('Add your job title before sending this request.')
  }

  if (!payload.phoneNumber) {
    throw new Error('Add a phone number before sending this request.')
  }

  if (!payload.emailAddress || !/\S+@\S+\.\S+/.test(payload.emailAddress)) {
    throw new Error('Add a valid email address before sending this request.')
  }

  if (!payload.eventDate) {
    throw new Error('Choose an event date before sending this request.')
  }

  if (!payload.approximateBudget) {
    throw new Error('Choose an approximate budget before sending this request.')
  }

  if (!payload.eventType) {
    throw new Error('Choose an event type before sending this request.')
  }

  if (!payload.eventLocation) {
    throw new Error('Add the event location before sending this request.')
  }

  if (!payload.fullAddress) {
    throw new Error('Add your full address before sending this request.')
  }

  if (!payload.nearestAirport) {
    throw new Error('Add the nearest airport before sending this request.')
  }
}

const createLocalEventBookingRequest = ({
  userId,
  talentId,
  celebrityName,
  eventDate,
  approximateBudget,
  eventType,
  eventLocation,
  additionalInfo,
  fullName,
  organizationName,
  jobTitle,
  phoneNumber,
  emailAddress,
  fullAddress,
  nearestAirport,
}) => {
  const normalizedTalentId = Number(talentId)
  const user = userId ? getUserById(userId) : null
  const talent = getTalentSnapshotById(normalizedTalentId)

  if (!talent) {
    throw new Error('Choose a valid talent before submitting your booking request.')
  }

  const payload = normalizeRequest({
    id: Date.now(),
    userId: user?.id ?? null,
    talentId: talent.id,
    talentName: talent.name,
    celebrityName: trimText(celebrityName) || talent.name,
    eventDate,
    approximateBudget,
    eventType,
    eventLocation,
    additionalInfo,
    fullName: trimText(fullName) || trimText(user?.name),
    organizationName,
    jobTitle,
    phoneNumber,
    emailAddress: trimText(emailAddress) || trimText(user?.email),
    fullAddress,
    nearestAirport,
    status: EVENT_BOOKING_REQUEST_STATUS.NEW,
    submittedAt: new Date().toISOString(),
  })

  validateRequestPayload(payload)
  syncRequestsCache([payload, ...eventBookingRequestsCache], { emit: true })
  return payload
}

export const getEventBookingRequests = () => eventBookingRequestsCache

export const refreshEventBookingRequests = async () => {
  if (!EVENT_BOOKING_BACKEND_ENABLED) {
    if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return getEventBookingRequests()
  }

  try {
    const response = await api.get('/event-bookings')
    return syncRequestsCache(response.data, { emit: true })
  } catch (error) {
    if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(readApiErrorMessage(error, BACKEND_REQUIRED_MESSAGE))
    }

    if (error?.response?.status && Number(error.response.status) < 500) {
      return getEventBookingRequests()
    }

    warnEventBookingBackendUnavailable(error)
    return getEventBookingRequests()
  }
}

export const getEventBookingRequestsForTalent = (talentId) =>
  sortByNewest(
    getEventBookingRequests().filter((request) => request.talentId === Number(talentId)),
  )

export const getUserEventBookingRequests = (userId) =>
  sortByNewest(
    getEventBookingRequests().filter((request) => request.userId === Number(userId)),
  )

export const subscribeToEventBookingRequests = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getEventBookingRequests())
  const handleStorage = (event) => {
    if (event.key === EVENT_BOOKING_REQUESTS_KEY) {
      eventBookingRequestsCache = sortByNewest(readRequestsFromStorage())
      listener(getEventBookingRequests())
    }
  }

  window.addEventListener(EVENT_BOOKING_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(EVENT_BOOKING_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
  }
}

export const submitEventBookingRequest = async (requestData) => {
  if (!EVENT_BOOKING_BACKEND_ENABLED) {
    if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return createLocalEventBookingRequest(requestData)
  }

  const talent = getTalentSnapshotById(requestData.talentId)
  const normalizedRequest = normalizeRequest({
    ...requestData,
    talentName: requestData.talentName ?? talent?.name ?? '',
    celebrityName: requestData.celebrityName ?? talent?.name ?? '',
  })

  validateRequestPayload(normalizedRequest)

  try {
    const response = await api.post('/event-bookings', requestData)
    const createdRequest = normalizeRequest(response.data)
    syncRequestsCache(
      [
        createdRequest,
        ...eventBookingRequestsCache.filter(
          (request) => Number(request.id) !== Number(createdRequest.id),
        ),
      ],
      { emit: true },
    )
    return createdRequest
  } catch (error) {
    throw new Error(
      readApiErrorMessage(error, 'We could not send your booking request right now.'),
    )
  }
}

export const updateEventBookingRequestStatus = async (requestId, status) => {
  if (!Object.values(EVENT_BOOKING_REQUEST_STATUS).includes(status)) {
    throw new Error('Choose a valid booking request status.')
  }

  if (!EVENT_BOOKING_BACKEND_ENABLED) {
    if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    let updatedRequest = null

    const nextRequests = getEventBookingRequests().map((request) => {
      if (request.id !== Number(requestId)) {
        return request
      }

      updatedRequest = normalizeRequest({
        ...request,
        status,
        reviewedAt: new Date().toISOString(),
      })

      return updatedRequest
    })

    if (!updatedRequest) {
      throw new Error('We could not find that booking request right now.')
    }

    syncRequestsCache(nextRequests, { emit: true })
    return updatedRequest
  }

  try {
    const response = await api.patch(`/event-bookings/${requestId}`, { status })
    const updatedRequest = normalizeRequest(response.data)
    syncRequestsCache(
      eventBookingRequestsCache.map((request) =>
        Number(request.id) === Number(updatedRequest.id) ? updatedRequest : request,
      ),
      { emit: true },
    )
    return updatedRequest
  } catch (error) {
    throw new Error(
      readApiErrorMessage(error, 'We could not update that booking request right now.'),
    )
  }
}

export const deleteEventBookingRequest = async (requestId) => {
  if (!EVENT_BOOKING_BACKEND_ENABLED) {
    if (!EVENT_BOOKING_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    const currentRequests = getEventBookingRequests()
    const removedRequest =
      currentRequests.find((request) => request.id === Number(requestId)) ?? null

    if (!removedRequest) {
      throw new Error('We could not find that booking request right now.')
    }

    syncRequestsCache(
      currentRequests.filter((request) => request.id !== Number(requestId)),
      { emit: true },
    )
    return removedRequest
  }

  try {
    const response = await api.delete(`/event-bookings/${requestId}`)
    const deletedRequest = normalizeRequest(response.data)
    syncRequestsCache(
      eventBookingRequestsCache.filter(
        (request) => Number(request.id) !== Number(deletedRequest.id),
      ),
      { emit: true },
    )
    return deletedRequest
  } catch (error) {
    throw new Error(
      readApiErrorMessage(error, 'We could not remove that booking request right now.'),
    )
  }
}

export const removeUserEventBookingRequests = (userId) => {
  const normalizedUserId = Number(userId)
  const currentRequests = getEventBookingRequests()
  const removedCount = currentRequests.filter(
    (request) => Number(request.userId) === normalizedUserId,
  ).length

  if (!removedCount) {
    return 0
  }

  syncRequestsCache(
    currentRequests.filter((request) => Number(request.userId) !== normalizedUserId),
    { emit: true },
  )

  return removedCount
}
