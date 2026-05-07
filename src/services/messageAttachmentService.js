import {
  STORAGE_BUCKETS,
  SUPABASE_STORAGE_ENABLED,
  downloadStoredFile,
  removeStoredFile,
  uploadStorageFile,
} from './storageService'
import {
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  STORAGE_REQUIRED_MESSAGE,
} from '../utils/backendConfig'

const MESSAGE_ATTACHMENT_DB_NAME = 'crownpoint_message_attachments'
const MESSAGE_ATTACHMENT_DB_VERSION = 1
const MESSAGE_ATTACHMENT_STORE = 'attachments'
const PDF_MIME_TYPE = 'application/pdf'
const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])
const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav'])

export const MESSAGE_ATTACHMENT_ACCEPT =
  'image/*,audio/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const MESSAGE_ATTACHMENT_KINDS = {
  IMAGE: 'image',
  AUDIO: 'audio',
  PDF: 'pdf',
  DOCX: 'docx',
}

const trimText = (value) => String(value ?? '').trim()

const getFileExtension = (fileName = '') => {
  const normalizedName = trimText(fileName).toLowerCase()
  const lastDotIndex = normalizedName.lastIndexOf('.')

  if (lastDotIndex < 0) {
    return ''
  }

  return normalizedName.slice(lastDotIndex + 1)
}

const inferMimeType = (kind) => {
  switch (kind) {
    case MESSAGE_ATTACHMENT_KINDS.PDF:
      return PDF_MIME_TYPE
    case MESSAGE_ATTACHMENT_KINDS.DOCX:
      return DOCX_MIME_TYPE
    default:
      return ''
  }
}

const createAttachmentId = () =>
  `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const resolveMessageAttachmentKind = ({ name = '', type = '' } = {}) => {
  const normalizedMimeType = trimText(type).toLowerCase()
  const extension = getFileExtension(name)

  if (normalizedMimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
    return MESSAGE_ATTACHMENT_KINDS.IMAGE
  }

  if (normalizedMimeType.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) {
    return MESSAGE_ATTACHMENT_KINDS.AUDIO
  }

  if (normalizedMimeType === PDF_MIME_TYPE || extension === 'pdf') {
    return MESSAGE_ATTACHMENT_KINDS.PDF
  }

  if (normalizedMimeType === DOCX_MIME_TYPE || extension === 'docx') {
    return MESSAGE_ATTACHMENT_KINDS.DOCX
  }

  return ''
}

export const normalizeMessageAttachment = (attachment = {}) => {
  const attachmentId = trimText(attachment?.id ?? attachment?.uploadId)
  const attachmentName = trimText(attachment?.name ?? attachment?.fileName)
  const mimeType = trimText(attachment?.mimeType ?? attachment?.type)
  const kind = resolveMessageAttachmentKind({ name: attachmentName, type: mimeType })

  if (!attachmentId || !kind) {
    return null
  }

  return {
    id: attachmentId,
    uploadId: trimText(attachment?.uploadId) || attachmentId,
    name: attachmentName || `${kind}-attachment`,
    fileName: attachmentName || `${kind}-attachment`,
    mimeType: mimeType || inferMimeType(kind),
    size: Number(attachment?.size ?? 0) || 0,
    kind,
    bucket: trimText(attachment?.bucket),
    storagePath: trimText(attachment?.storagePath),
    createdAt: attachment?.createdAt ?? attachment?.storedAt ?? attachment?.uploadedAt ?? null,
  }
}

export const validateMessageAttachmentFile = (file) => {
  if (typeof File !== 'undefined' && !(file instanceof File)) {
    throw new Error('Choose a valid file before attaching it.')
  }

  const kind = resolveMessageAttachmentKind(file)

  if (!kind) {
    throw new Error('Only images, audio, PDF, and DOCX files can be attached.')
  }

  return kind
}

const openAttachmentDatabase = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      reject(new Error('Attachments are not supported in this browser.'))
      return
    }

    const request = window.indexedDB.open(
      MESSAGE_ATTACHMENT_DB_NAME,
      MESSAGE_ATTACHMENT_DB_VERSION,
    )

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(MESSAGE_ATTACHMENT_STORE)) {
        database.createObjectStore(MESSAGE_ATTACHMENT_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(new Error('We could not open message attachment storage right now.'))
  })

const saveAttachmentLocally = async (file) => {
  const kind = validateMessageAttachmentFile(file)
  const database = await openAttachmentDatabase()
  const attachmentId = createAttachmentId()
  const storedAt = new Date().toISOString()

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(MESSAGE_ATTACHMENT_STORE, 'readwrite')

      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(new Error('We could not save that attachment. Please try again.'))
      transaction.onabort = () =>
        reject(new Error('We could not save that attachment. Please try again.'))

      transaction.objectStore(MESSAGE_ATTACHMENT_STORE).put({
        id: attachmentId,
        blob: file,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        kind,
        storedAt,
      })
    })

    return normalizeMessageAttachment({
      id: attachmentId,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind,
      storedAt,
    })
  } finally {
    database.close()
  }
}

export const saveMessageAttachment = async (
  file,
  { threadStorageKey = '' } = {},
) => {
  const kind = validateMessageAttachmentFile(file)

  if (SUPABASE_STORAGE_ENABLED && trimText(threadStorageKey)) {
    const storedUpload = await uploadStorageFile({
      bucket: STORAGE_BUCKETS.MESSAGE_ATTACHMENTS,
      file,
      pathSegments: [threadStorageKey],
    })

    return normalizeMessageAttachment({
      id: storedUpload.uploadId || createAttachmentId(),
      uploadId: storedUpload.uploadId,
      name: storedUpload.fileName,
      fileName: storedUpload.fileName,
      mimeType: storedUpload.mimeType,
      size: storedUpload.size,
      kind,
      bucket: storedUpload.bucket,
      storagePath: storedUpload.storagePath,
      createdAt: storedUpload.uploadedAt,
    })
  }

  if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
    throw new Error(STORAGE_REQUIRED_MESSAGE)
  }

  return saveAttachmentLocally(file)
}

export const saveMessageAttachments = async (files = [], options = {}) => {
  const savedAttachments = []

  for (const file of Array.from(files ?? [])) {
    savedAttachments.push(await saveMessageAttachment(file, options))
  }

  return savedAttachments
}

const readLocalAttachmentBlob = async (attachmentId) => {
  if (!attachmentId) {
    return null
  }

  const database = await openAttachmentDatabase()

  try {
    const record = await new Promise((resolve, reject) => {
      const transaction = database.transaction(MESSAGE_ATTACHMENT_STORE, 'readonly')
      const request = transaction.objectStore(MESSAGE_ATTACHMENT_STORE).get(attachmentId)

      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () =>
        reject(new Error('We could not load that attachment right now.'))
    })

    return record?.blob instanceof Blob ? record.blob : null
  } finally {
    database.close()
  }
}

export const getMessageAttachmentBlob = async (attachmentOrId) => {
  if (typeof attachmentOrId === 'string') {
    if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
      return null
    }

    return readLocalAttachmentBlob(attachmentOrId)
  }

  const normalizedAttachment =
    normalizeMessageAttachment(attachmentOrId)

  if (!normalizedAttachment) {
    return null
  }

  if (normalizedAttachment.bucket && normalizedAttachment.storagePath) {
    return downloadStoredFile(normalizedAttachment)
  }

  if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
    return null
  }

  return readLocalAttachmentBlob(normalizedAttachment.id)
}

const deleteLocalAttachments = async (attachmentIds = []) => {
  const normalizedAttachmentIds = Array.from(new Set(
    (Array.isArray(attachmentIds) ? attachmentIds : [])
      .map((attachmentId) => trimText(attachmentId))
      .filter(Boolean),
  ))

  if (!normalizedAttachmentIds.length) {
    return 0
  }

  const database = await openAttachmentDatabase()

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(MESSAGE_ATTACHMENT_STORE, 'readwrite')

      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(new Error('We could not clear stored message attachments right now.'))
      transaction.onabort = () =>
        reject(new Error('We could not clear stored message attachments right now.'))

      const attachmentStore = transaction.objectStore(MESSAGE_ATTACHMENT_STORE)
      normalizedAttachmentIds.forEach((attachmentId) => {
        attachmentStore.delete(attachmentId)
      })
    })

    return normalizedAttachmentIds.length
  } finally {
    database.close()
  }
}

export const deleteMessageAttachments = async (attachmentsOrIds = []) => {
  const rawAttachments = Array.isArray(attachmentsOrIds) ? attachmentsOrIds : []
  const normalizedAttachments = rawAttachments
    .filter((attachment) => attachment && typeof attachment === 'object')
    .map((attachment) => normalizeMessageAttachment(attachment))
    .filter(Boolean)
  const rawLocalAttachmentIds = rawAttachments
    .filter((attachment) => typeof attachment === 'string')
    .map((attachmentId) => trimText(attachmentId))
    .filter(Boolean)

  const storedAttachments = normalizedAttachments.filter(
    (attachment) => attachment.bucket && attachment.storagePath,
  )
  const localAttachmentIds = normalizedAttachments
    .filter((attachment) => !attachment.bucket || !attachment.storagePath)
    .map((attachment) => attachment.id)
    .concat(rawLocalAttachmentIds)

  for (const attachment of storedAttachments) {
    await removeStoredFile(attachment)
  }

  if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
    return storedAttachments.length
  }

  const removedLocalAttachmentCount = await deleteLocalAttachments(localAttachmentIds)
  return storedAttachments.length + removedLocalAttachmentCount
}
