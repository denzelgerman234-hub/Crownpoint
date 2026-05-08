import api from '../utils/api'
import { privateThreads } from '../data/demoData'
import { getUserById } from './authService'
import {
  BACKEND_REQUIRED_MESSAGE,
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  SUPABASE_AUTH_ENABLED,
} from '../utils/backendConfig'
import {
  deleteMessageAttachments,
  normalizeMessageAttachment,
  saveMessageAttachments,
} from './messageAttachmentService'
import {
  getTalentRosterSnapshot,
  getTalentSnapshotById,
} from './talentService'

const MESSAGE_THREADS_KEY = 'crownpoint_message_threads'
const MESSAGE_UPDATED_EVENT = 'crownpoint:messages-updated'
const MESSAGE_API_START_HINT =
  'Start `npm run api` so messages can persist through the backend API.'
const MESSAGE_BACKEND_ENABLED = SUPABASE_AUTH_ENABLED
const MESSAGE_LOCAL_FALLBACKS_ENABLED = LOCAL_BACKEND_FALLBACKS_ENABLED
const MESSAGE_REFRESH_INTERVAL_MS = 5000
const MESSAGE_DETAILED_ERRORS_ENABLED = Boolean(import.meta.env.DEV)

const MESSAGE_ROLES = {
  FAN: 'fan',
  TALENT: 'talent',
  SYSTEM: 'system',
}

const FAN_AVATAR_GRADIENT = 'linear-gradient(135deg, #7a5c2d, #2f2411)'

const defaultMessage = {
  id: '',
  backendMessageId: null,
  senderRole: MESSAGE_ROLES.SYSTEM,
  senderLabel: 'System',
  text: '',
  attachments: [],
  createdAt: null,
}

const defaultThread = {
  id: '',
  backendThreadId: null,
  fanUserId: null,
  fanAuthUserId: '',
  fanName: '',
  fanEmail: '',
  talentId: null,
  talentName: '',
  topic: 'Private inbox',
  preview: '',
  createdAt: null,
  lastActiveAt: null,
  messages: [],
}

let hasWarnedMessageBackendUnavailable = false
let hasWarnedBackgroundMessageRefreshFailure = false

const trimText = (value) => String(value ?? '').trim()

const readApiDiagnosticMessage = (error, fallbackMessage) => {
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

const readUserSafeApiErrorMessage = (error, fallbackMessage) =>
  MESSAGE_DETAILED_ERRORS_ENABLED
    ? readApiDiagnosticMessage(error, fallbackMessage)
    : fallbackMessage

const warnMessageBackendUnavailable = (error) => {
  if (hasWarnedMessageBackendUnavailable) {
    return
  }

  hasWarnedMessageBackendUnavailable = true
  console.warn(
    `Falling back to the cached message view because the backend API is unavailable. ${readApiDiagnosticMessage(error, MESSAGE_API_START_HINT)}`,
  )
}

const warnBackgroundMessageRefreshFailure = (error) => {
  if (hasWarnedBackgroundMessageRefreshFailure) {
    return
  }

  hasWarnedBackgroundMessageRefreshFailure = true
  console.warn(
    `Live message refresh hit a problem. ${readApiDiagnosticMessage(error, 'We could not refresh messages right now.')}`,
  )
}

const createIsoFromOffset = (minutesAgo) =>
  new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()

const buildThreadId = (fanUserId, talentId) => `thread-${fanUserId}-${talentId}`
const buildLegacyInboxReadyText = (talentName = 'Talent') =>
  `${String(talentName || 'Talent').trim() || 'Talent'}'s private inbox is now open.`
const LEGACY_WELCOME_REPLY_TEXT =
  'Thanks for reaching out. Send a note whenever you are ready.'

const resolveMessageRole = (message = {}) => {
  const candidate = String(message.senderRole ?? message.sender ?? MESSAGE_ROLES.SYSTEM)
    .trim()
    .toLowerCase()

  if (Object.values(MESSAGE_ROLES).includes(candidate)) {
    return candidate
  }

  return MESSAGE_ROLES.SYSTEM
}

const isLegacyWelcomeMessage = (message = {}, threadContext = defaultThread) => {
  const senderRole = resolveMessageRole(message)
  const messageText = String(message?.text ?? '').trim()
  const talentName = String(threadContext?.talentName ?? '').trim() || 'Talent'

  return (
    (senderRole === MESSAGE_ROLES.SYSTEM &&
      messageText === buildLegacyInboxReadyText(talentName)) ||
    (senderRole === MESSAGE_ROLES.TALENT && messageText === LEGACY_WELCOME_REPLY_TEXT)
  )
}

const threadHasFanConversation = (thread = {}) =>
  Array.isArray(thread?.messages) &&
  thread.messages.some((message) => resolveMessageRole(message) === MESSAGE_ROLES.FAN)

const buildSenderLabel = (messageRole, thread = {}, message = {}) => {
  if (message?.senderLabel) {
    return String(message.senderLabel).trim()
  }

  switch (messageRole) {
    case MESSAGE_ROLES.FAN:
      return thread.fanName || 'Fan'
    case MESSAGE_ROLES.TALENT:
      return thread.talentName || 'Talent'
    default:
      return 'System'
  }
}

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
    previewParts.push(`${attachmentCounts.pdf} PDF${attachmentCounts.pdf === 1 ? '' : 's'}`)
  }

  if (attachmentCounts.docx > 0) {
    previewParts.push(
      `${attachmentCounts.docx} DOCX file${attachmentCounts.docx === 1 ? '' : 's'}`,
    )
  }

  return previewParts.length > 0 ? `Sent ${previewParts.join(', ')}` : 'Attachment sent'
}

const buildMessagePreview = (message = {}) => {
  const textPreview = String(message?.text ?? '').trim()

  if (textPreview) {
    return textPreview
  }

  return Array.isArray(message?.attachments) && message.attachments.length > 0
    ? formatAttachmentPreview(message.attachments)
    : ''
}

const normalizeMessageAttachments = (attachments = []) =>
  Array.isArray(attachments)
    ? attachments
        .map((attachment) => normalizeMessageAttachment(attachment))
        .filter(Boolean)
    : []

const normalizeMessageRecord = (message, threadContext = defaultThread) => {
  const senderRole = resolveMessageRole(message)
  const createdAt = message?.createdAt ?? null
  const attachments = normalizeMessageAttachments(message?.attachments)

  return {
    ...defaultMessage,
    ...message,
    id:
      String(message?.id ?? '').trim() ||
      `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    backendMessageId: Number(message?.backendMessageId ?? 0) || null,
    senderRole,
    senderLabel: buildSenderLabel(senderRole, threadContext, message),
    text: String(message?.text ?? '').trim(),
    attachments,
    createdAt,
  }
}

const normalizeThreadRecord = (thread = {}) => {
  const numericTalentId = Number(thread?.talentId ?? null)
  const talent = getTalentSnapshotById(numericTalentId)
  const baseThread = {
    ...defaultThread,
    ...thread,
    backendThreadId: Number(thread?.backendThreadId ?? 0) || null,
    fanUserId: Number(thread?.fanUserId ?? thread?.userId ?? null) || null,
    fanAuthUserId: trimText(thread?.fanAuthUserId),
    fanName: String(thread?.fanName ?? '').trim() || 'Member',
    fanEmail: String(thread?.fanEmail ?? thread?.email ?? '').trim(),
    talentId: numericTalentId || null,
    talentName: String(thread?.talentName ?? talent?.name ?? '').trim(),
    topic: String(thread?.topic ?? '').trim() || defaultThread.topic,
  }

  const normalizedMessages = Array.isArray(thread?.messages)
    ? thread.messages
        .filter((message) => !isLegacyWelcomeMessage(message, baseThread))
        .map((message) => normalizeMessageRecord(message, baseThread))
    : []
  const lastMessage = normalizedMessages[normalizedMessages.length - 1] ?? null
  const lastActiveAt = thread?.lastActiveAt ?? lastMessage?.createdAt ?? thread?.createdAt ?? null
  const storedPreview = String(thread?.preview ?? '').trim()
  const preview =
    storedPreview && storedPreview !== `${baseThread.talentName}'s private inbox is ready for your first message.`
      ? storedPreview
      : buildMessagePreview(lastMessage)

  return {
    ...baseThread,
    id:
      String(thread?.id ?? '').trim() ||
      (baseThread.backendThreadId ? `thread-${baseThread.backendThreadId}` : ''),
    preview,
    createdAt: thread?.createdAt ?? normalizedMessages[0]?.createdAt ?? lastActiveAt,
    lastActiveAt,
    messages: normalizedMessages,
  }
}

const seedMessageThreads = () => {
  const seededFan = getUserById(1)
  const defaultFanName = seededFan?.name ?? 'Amara Okafor'
  const defaultFanEmail = seededFan?.email ?? 'amara@example.com'

  return privateThreads.map((thread, threadIndex) => {
    const threadCreatedAt = createIsoFromOffset(240 + threadIndex * 120)
    const normalizedId = buildThreadId(seededFan?.id ?? 1, thread.talentId)

    return normalizeThreadRecord({
      id: normalizedId,
      fanUserId: seededFan?.id ?? 1,
      fanName: defaultFanName,
      fanEmail: defaultFanEmail,
      talentId: thread.talentId,
      talentName: thread.talentName,
      topic: thread.topic,
      createdAt: threadCreatedAt,
      lastActiveAt: createIsoFromOffset(15 + threadIndex * 50),
      messages: thread.messages.map((message, messageIndex) => ({
        id: `${normalizedId}-${messageIndex + 1}`,
        senderRole: resolveMessageRole(message),
        senderLabel:
          resolveMessageRole(message) === MESSAGE_ROLES.FAN
            ? defaultFanName
            : thread.talentName,
        text: message.text,
        createdAt: createIsoFromOffset(60 + threadIndex * 40 - messageIndex * 8),
      })),
    })
  })
}

const emitMessageUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MESSAGE_UPDATED_EVENT))
  }
}

const writeMessageThreadsSilently = (threads) => {
  if (!MESSAGE_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    MESSAGE_THREADS_KEY,
    JSON.stringify(threads.map(normalizeThreadRecord)),
  )
}

const writeMessageThreads = (threads) => {
  writeMessageThreadsSilently(threads)
  emitMessageUpdate()
}

const stripLegacySeedThreads = (threads = []) => {
  const seededThreadIds = new Set(seedMessageThreads().map((thread) => thread.id))
  return threads.filter((thread) => !seededThreadIds.has(thread.id))
}

const readMessageThreads = () => {
  if (!MESSAGE_LOCAL_FALLBACKS_ENABLED || typeof window === 'undefined') {
    return []
  }

  const storedThreads = window.localStorage.getItem(MESSAGE_THREADS_KEY)

  if (!storedThreads) {
    return []
  }

  try {
    const parsedThreads = JSON.parse(storedThreads)
    const normalizedThreads = Array.isArray(parsedThreads)
      ? parsedThreads.map(normalizeThreadRecord)
      : []
    const nextThreads = stripLegacySeedThreads(normalizedThreads)

    if (nextThreads.length !== normalizedThreads.length) {
      writeMessageThreadsSilently(nextThreads)
    }

    return nextThreads
  } catch {
    window.localStorage.removeItem(MESSAGE_THREADS_KEY)
    return []
  }
}

const sortThreadsByActivity = (threads) =>
  [...threads].sort(
    (left, right) =>
      new Date(right.lastActiveAt ?? 0).getTime() -
      new Date(left.lastActiveAt ?? 0).getTime(),
  )

const normalizeThreadsCollection = (threads) =>
  sortThreadsByActivity(
    stripLegacySeedThreads(
      Array.isArray(threads) ? threads.map(normalizeThreadRecord) : [],
    ),
  )

const serializeThreads = (threads) => JSON.stringify(threads)

const buildEmptyConversationThread = ({ user, talent, currentPlanLabel }) => {
  const createdAt = new Date().toISOString()
  const threadId = buildThreadId(user.id, talent.id)

  return normalizeThreadRecord({
    id: threadId,
    fanUserId: user.id,
    fanName: user.name,
    fanEmail: user.email,
    talentId: talent.id,
    talentName: talent.name,
    topic: `${currentPlanLabel} inbox`,
    preview: '',
    createdAt,
    lastActiveAt: null,
    messages: [],
  })
}

const syncThreadParticipants = (thread, user, accessibleTalentIds, currentPlanLabel) => {
  const talent = getTalentSnapshotById(thread.talentId)
  const belongsToUser = thread.fanUserId === Number(user?.id)

  if (!belongsToUser) {
    return { nextThread: thread, changed: false }
  }

  const nextTopic =
    accessibleTalentIds.includes(thread.talentId) && !thread.topic
      ? `${currentPlanLabel} inbox`
      : thread.topic

  const nextThread = normalizeThreadRecord({
    ...thread,
    fanName: user?.name ?? thread.fanName,
    fanEmail: user?.email ?? thread.fanEmail,
    talentName: talent?.name ?? thread.talentName,
    topic: nextTopic,
  })

  const changed = JSON.stringify(thread) !== JSON.stringify(nextThread)
  return { nextThread, changed }
}

let threadsCache = sortThreadsByActivity(readMessageThreads())
let messageUpdateSubscriberCount = 0
let messageAutoRefreshIntervalId = null
let messageAutoRefreshPromise = null

const syncThreadsCache = (threads, { emit = false, persist = true } = {}) => {
  const nextThreads = normalizeThreadsCollection(threads)
  const threadsChanged = serializeThreads(threadsCache) !== serializeThreads(nextThreads)

  threadsCache = nextThreads

  if (persist && MESSAGE_LOCAL_FALLBACKS_ENABLED && threadsChanged) {
    writeMessageThreadsSilently(threadsCache)
  }

  if (emit && threadsChanged) {
    emitMessageUpdate()
  }

  return threadsCache
}

const handleMessageAutoRefreshVisibilityChange = () => {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
    return
  }

  void runBackgroundMessageRefresh()
}

const stopMessageAutoRefresh = () => {
  if (typeof window === 'undefined') {
    return
  }

  if (messageAutoRefreshIntervalId) {
    window.clearInterval(messageAutoRefreshIntervalId)
    messageAutoRefreshIntervalId = null
  }

  window.removeEventListener('visibilitychange', handleMessageAutoRefreshVisibilityChange)
  window.removeEventListener('focus', handleMessageAutoRefreshVisibilityChange)
}

const startMessageAutoRefresh = () => {
  if (
    !MESSAGE_BACKEND_ENABLED ||
    typeof window === 'undefined' ||
    messageAutoRefreshIntervalId
  ) {
    return
  }

  messageAutoRefreshIntervalId = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }

    void runBackgroundMessageRefresh()
  }, MESSAGE_REFRESH_INTERVAL_MS)

  window.addEventListener('visibilitychange', handleMessageAutoRefreshVisibilityChange)
  window.addEventListener('focus', handleMessageAutoRefreshVisibilityChange)
}

async function runBackgroundMessageRefresh() {
  if (!MESSAGE_BACKEND_ENABLED) {
    return getMessageThreads()
  }

  if (messageAutoRefreshPromise) {
    return messageAutoRefreshPromise
  }

  messageAutoRefreshPromise = refreshMessageThreads()
    .then((threads) => {
      hasWarnedBackgroundMessageRefreshFailure = false
      return threads
    })
    .catch((error) => {
      warnBackgroundMessageRefreshFailure(error)
      return getMessageThreads()
    })
    .finally(() => {
      messageAutoRefreshPromise = null
    })

  return messageAutoRefreshPromise
}

const getBackendThreadId = (threadOrId) => {
  if (threadOrId && typeof threadOrId === 'object') {
    return Number(threadOrId.backendThreadId ?? 0) || null
  }

  const normalizedThreadId = trimText(threadOrId)

  if (!normalizedThreadId) {
    return null
  }

  const cachedThread = threadsCache.find((thread) => thread.id === normalizedThreadId)

  if (cachedThread?.backendThreadId) {
    return Number(cachedThread.backendThreadId) || null
  }

  if (normalizedThreadId.startsWith('thread-')) {
    const numericValue = Number(normalizedThreadId.slice('thread-'.length))
    return Number.isFinite(numericValue) ? numericValue : null
  }

  const numericValue = Number(normalizedThreadId)
  return Number.isFinite(numericValue) ? numericValue : null
}

const mergeThreadIntoCache = (thread) => {
  const normalizedThread = normalizeThreadRecord(thread)

  return syncThreadsCache(
    [
      normalizedThread,
      ...threadsCache.filter((candidate) => candidate.id !== normalizedThread.id),
    ],
    { emit: true },
  )
}

const appendMessageToThreadLocally = async (threadId, messageBuilder) => {
  let updatedThread = null

  const nextThreads = await Promise.all(
    readMessageThreads().map(async (thread) => {
      if (thread.id !== threadId) {
        return thread
      }

      const nextMessage = normalizeMessageRecord(await messageBuilder(thread), thread)
      updatedThread = normalizeThreadRecord({
        ...thread,
        preview: buildMessagePreview(nextMessage),
        lastActiveAt: nextMessage.createdAt,
        messages: [...thread.messages, nextMessage],
      })

      return updatedThread
    }),
  )

  if (!updatedThread) {
    throw new Error('That message thread could not be found.')
  }

  writeMessageThreads(nextThreads)
  threadsCache = sortThreadsByActivity(nextThreads)
  return updatedThread
}

export const refreshMessageThreads = async ({ talentId = null } = {}) => {
  if (!MESSAGE_BACKEND_ENABLED) {
    if (!MESSAGE_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(BACKEND_REQUIRED_MESSAGE)
    }

    return getMessageThreads()
  }

  try {
    const response = await api.get('/message-threads', {
      params: talentId ? { talentId } : undefined,
    })
    return syncThreadsCache(response.data, { emit: true })
  } catch (error) {
    if (!MESSAGE_LOCAL_FALLBACKS_ENABLED) {
      throw new Error(readUserSafeApiErrorMessage(error, BACKEND_REQUIRED_MESSAGE))
    }

    if (error?.response?.status && Number(error.response.status) < 500) {
      return getMessageThreads()
    }

    warnMessageBackendUnavailable(error)
    return getMessageThreads()
  }
}

export const subscribeToMessageUpdates = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getMessageThreads())
  const handleStorage = (event) => {
    if (event.key === MESSAGE_THREADS_KEY) {
      threadsCache = sortThreadsByActivity(readMessageThreads())
      listener(getMessageThreads())
    }
  }

  window.addEventListener(MESSAGE_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)
  messageUpdateSubscriberCount += 1
  startMessageAutoRefresh()

  if (messageUpdateSubscriberCount === 1) {
    void runBackgroundMessageRefresh()
  }

  return () => {
    window.removeEventListener(MESSAGE_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
    messageUpdateSubscriberCount = Math.max(0, messageUpdateSubscriberCount - 1)

    if (messageUpdateSubscriberCount === 0) {
      stopMessageAutoRefresh()
    }
  }
}

export const getMessageThreads = () => threadsCache

export const getThreadById = (threadId) =>
  getMessageThreads().find((thread) => thread.id === threadId) ?? null

export const getUserThreads = (user, accessibleTalents = [], currentPlanLabel = 'Private') => {
  if (!user) {
    return []
  }

  const accessibleTalentIds = accessibleTalents.map((talent) => Number(talent.id))

  if (MESSAGE_BACKEND_ENABLED) {
    return sortThreadsByActivity(
      getMessageThreads().filter(
        (thread) =>
          thread.fanUserId === Number(user.id) &&
          accessibleTalentIds.includes(Number(thread.talentId)) &&
          threadHasFanConversation(thread),
      ),
    )
  }

  if (!MESSAGE_LOCAL_FALLBACKS_ENABLED) {
    return []
  }

  const threads = readMessageThreads()
  const nextThreads = []
  let hasChanges = false

  threads.forEach((thread) => {
    const { nextThread, changed } = syncThreadParticipants(
      thread,
      user,
      accessibleTalentIds,
      currentPlanLabel,
    )
    nextThreads.push(nextThread)
    hasChanges = hasChanges || changed
  })

  if (hasChanges) {
    writeMessageThreads(nextThreads)
    threadsCache = sortThreadsByActivity(nextThreads)
  }

  return sortThreadsByActivity(
    nextThreads.filter(
      (thread) =>
        thread.fanUserId === Number(user.id) &&
        accessibleTalentIds.includes(Number(thread.talentId)) &&
        threadHasFanConversation(thread),
    ),
  )
}

export const getUserThreadByTalent = (user, talent, currentPlanLabel = 'Private') => {
  if (!user || !talent) {
    return null
  }

  return (
    getUserThreads(user, [talent], currentPlanLabel).find(
      (thread) => Number(thread.talentId) === Number(talent.id),
    ) ?? null
  )
}

const prepareMessageAttachments = async (
  attachments = [],
  { threadStorageKey = '' } = {},
) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return []
  }

  const normalizedAttachments = attachments
    .map((attachment) => normalizeMessageAttachment(attachment))
    .filter(Boolean)

  if (normalizedAttachments.length === attachments.length) {
    return normalizedAttachments
  }

  return saveMessageAttachments(attachments, { threadStorageKey })
}

const sendMessageThroughBackend = async ({
  attachments = [],
  senderLabel,
  senderRole,
  text,
  threadId,
}) => {
  const backendThreadId = getBackendThreadId(threadId)

  if (!backendThreadId) {
    throw new Error('That message thread could not be found.')
  }

  const preparedAttachments = await prepareMessageAttachments(attachments, {
    threadStorageKey: String(backendThreadId),
  })

  try {
    const response = await api.post(`/message-threads/${backendThreadId}/messages`, {
      attachments: preparedAttachments,
      senderLabel,
      senderRole,
      text: trimText(text),
    })
    mergeThreadIntoCache(response.data)
    return normalizeThreadRecord(response.data)
  } catch (error) {
    if (preparedAttachments.length) {
      await deleteMessageAttachments(preparedAttachments).catch(() => {})
    }

    throw new Error(
      readUserSafeApiErrorMessage(error, 'We could not send that message right now.'),
    )
  }
}

const createLocalFanConversation = async ({
  attachments = [],
  currentPlanLabel = 'Private',
  fanName = 'Fan',
  messageId,
  talent,
  text,
  user,
}) => {
  const threadId = buildThreadId(user.id, talent.id)
  const storedThreads = readMessageThreads()
  const currentThread =
    storedThreads.find((thread) => thread.id === threadId) ??
    buildEmptyConversationThread({
      user,
      talent,
      currentPlanLabel,
    })
  const nextMessage = normalizeMessageRecord(
    {
      id: messageId || `${threadId}-fan-${Date.now()}`,
      senderRole: MESSAGE_ROLES.FAN,
      senderLabel: fanName,
      text,
      attachments: await prepareMessageAttachments(attachments, {
        threadStorageKey: threadId,
      }),
      createdAt: new Date().toISOString(),
    },
    currentThread,
  )
  const updatedThread = normalizeThreadRecord({
    ...currentThread,
    preview: buildMessagePreview(nextMessage),
    lastActiveAt: nextMessage.createdAt,
    messages: [...currentThread.messages, nextMessage],
  })
  const nextThreads = [
    updatedThread,
    ...storedThreads.filter((thread) => thread.id !== updatedThread.id),
  ]

  writeMessageThreads(nextThreads)
  threadsCache = sortThreadsByActivity(nextThreads)
  return updatedThread
}

export const startFanConversation = async ({
  attachments = [],
  currentPlanLabel = 'Private',
  fanName = 'Fan',
  messageId,
  talent,
  text,
  user,
}) => {
  if (!user || !talent) {
    throw new Error('Choose a valid talent before starting a conversation.')
  }

  if (MESSAGE_BACKEND_ENABLED) {
    const threadStorageKey = buildThreadId(user.id, talent.id)
    const preparedAttachments = await prepareMessageAttachments(attachments, {
      threadStorageKey,
    })

    try {
      const response = await api.post('/message-threads', {
        attachments: preparedAttachments,
        talentId: Number(talent.id),
        text: trimText(text),
      })
      mergeThreadIntoCache(response.data)
      return normalizeThreadRecord(response.data)
    } catch (error) {
      if (preparedAttachments.length) {
        await deleteMessageAttachments(preparedAttachments).catch(() => {})
      }

      throw new Error(
        readUserSafeApiErrorMessage(error, 'We could not start that conversation right now.'),
      )
    }
  }

  if (!MESSAGE_LOCAL_FALLBACKS_ENABLED) {
    throw new Error(BACKEND_REQUIRED_MESSAGE)
  }

  return createLocalFanConversation({
    attachments,
    currentPlanLabel,
    fanName,
    messageId,
    talent,
    text,
    user,
  })
}

export const sendFanMessage = async ({
  threadId,
  text,
  fanName = 'Fan',
  messageId,
  attachments = [],
}) => {
  if (MESSAGE_BACKEND_ENABLED) {
    return sendMessageThroughBackend({
      attachments,
      senderLabel: fanName,
      senderRole: MESSAGE_ROLES.FAN,
      text,
      threadId,
    })
  }

  if (!MESSAGE_LOCAL_FALLBACKS_ENABLED) {
    throw new Error(BACKEND_REQUIRED_MESSAGE)
  }

  return appendMessageToThreadLocally(threadId, async () => ({
    id: messageId || `${threadId}-fan-${Date.now()}`,
    senderRole: MESSAGE_ROLES.FAN,
    senderLabel: fanName,
    text,
    attachments: await prepareMessageAttachments(attachments),
    createdAt: new Date().toISOString(),
  }))
}

export const sendTalentMessage = async ({
  threadId,
  text,
  senderLabel,
  messageId,
  attachments = [],
}) => {
  if (MESSAGE_BACKEND_ENABLED) {
    return sendMessageThroughBackend({
      attachments,
      senderLabel,
      senderRole: MESSAGE_ROLES.TALENT,
      text,
      threadId,
    })
  }

  if (!MESSAGE_LOCAL_FALLBACKS_ENABLED) {
    throw new Error(BACKEND_REQUIRED_MESSAGE)
  }

  return appendMessageToThreadLocally(threadId, async (thread) => ({
    id: messageId || `${threadId}-talent-${Date.now()}`,
    senderRole: MESSAGE_ROLES.TALENT,
    senderLabel: senderLabel || thread.talentName,
    text,
    attachments: await prepareMessageAttachments(attachments),
    createdAt: new Date().toISOString(),
  }))
}

export const getTalentThreads = (talentId) =>
  sortThreadsByActivity(
    getMessageThreads().filter(
      (thread) =>
        Number(thread.talentId) === Number(talentId) && threadHasFanConversation(thread),
    ),
  )

export const getTalentInboxSummaries = () => {
  return getTalentRosterSnapshot()
    .map((talent) => {
      const talentThreads = getTalentThreads(talent.id)
      const latestThread = talentThreads[0] ?? null
      const needsReplyCount = talentThreads.filter((thread) => {
        const lastMessage = thread.messages[thread.messages.length - 1]
        return lastMessage?.senderRole === MESSAGE_ROLES.FAN
      }).length

      return {
        talentId: talent.id,
        talentName: talent.name,
        threadCount: talentThreads.length,
        needsReplyCount,
        latestPreview: latestThread?.preview ?? 'No fan messages yet.',
        lastActiveAt: latestThread?.lastActiveAt ?? null,
      }
    })
    .sort((left, right) => {
      if (right.threadCount !== left.threadCount) {
        return right.threadCount - left.threadCount
      }

      return left.talentName.localeCompare(right.talentName)
    })
}

export const buildFanThreadAvatar = (thread) => ({
  name: thread?.fanName ?? 'Member',
  initials:
    String(thread?.fanName ?? 'Member')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'M',
  gradient: FAN_AVATAR_GRADIENT,
})

export const removeUserThreads = async (userId) => {
  const normalizedUserId = Number(userId)
  const currentThreads = MESSAGE_LOCAL_FALLBACKS_ENABLED ? readMessageThreads() : getMessageThreads()
  const deletedThreads = currentThreads.filter((thread) => thread.fanUserId === normalizedUserId)
  const nextThreads = currentThreads.filter((thread) => thread.fanUserId !== normalizedUserId)
  const deletedAttachments = deletedThreads.flatMap((thread) =>
    thread.messages.flatMap((message) =>
      (Array.isArray(message.attachments) ? message.attachments : []).filter(Boolean),
    ),
  )

  if (deletedAttachments.length) {
    await deleteMessageAttachments(deletedAttachments)
  }

  if (nextThreads.length !== currentThreads.length) {
    if (MESSAGE_LOCAL_FALLBACKS_ENABLED) {
      writeMessageThreads(nextThreads)
    }
    threadsCache = sortThreadsByActivity(nextThreads)
  }

  return deletedThreads.length
}
