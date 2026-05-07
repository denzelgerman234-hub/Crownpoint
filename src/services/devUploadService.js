const DEV_UPLOADS_KEY = 'crownpoint_dev_uploads'
const activePreviewUrls = new Map()

export const DEV_UPLOAD_SCOPES = {
  AVATARS: 'profile-photos',
  VERIFICATION: 'verification',
}

const sanitizeStoredUploadRecord = (uploadId, record = {}) => ({
  id: String(record.id ?? uploadId).trim() || uploadId,
  ownerId: sanitizeSegment(record.ownerId),
  scope:
    record.scope === DEV_UPLOAD_SCOPES.AVATARS ? DEV_UPLOAD_SCOPES.AVATARS : DEV_UPLOAD_SCOPES.VERIFICATION,
  fileName: String(record.fileName ?? '').trim(),
  mimeType: String(record.mimeType ?? '').trim(),
  size: Number(record.size ?? 0) || 0,
  uploadedAt: record.uploadedAt ?? null,
  previewUrl: '',
})

const readUploads = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  const storedUploads = window.localStorage.getItem(DEV_UPLOADS_KEY)

  if (!storedUploads) {
    return {}
  }

  try {
    const parsedUploads = JSON.parse(storedUploads)

    if (!parsedUploads || typeof parsedUploads !== 'object') {
      return {}
    }

    const sanitizedUploads = Object.fromEntries(
      Object.entries(parsedUploads).map(([uploadId, record]) => [
        uploadId,
        sanitizeStoredUploadRecord(uploadId, record),
      ]),
    )

    if (JSON.stringify(parsedUploads) !== JSON.stringify(sanitizedUploads)) {
      writeUploads(sanitizedUploads)
    }

    return sanitizedUploads
  } catch {
    window.localStorage.removeItem(DEV_UPLOADS_KEY)
    return {}
  }
}

const writeUploads = (uploads) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(DEV_UPLOADS_KEY, JSON.stringify(uploads))
}

const sanitizeSegment = (value) =>
  String(value ?? 'draft')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'draft'

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('We could not read that file. Try another upload.'))
    reader.readAsDataURL(file)
  })

const createPreviewUrl = async (file, previewStrategy) =>
  previewStrategy === 'data-url' ? fileToDataUrl(file) : URL.createObjectURL(file)

const formatMaxSizeLabel = (maxSizeInBytes) => {
  const sizeInMegabytes = maxSizeInBytes / 1_000_000

  return Number.isInteger(sizeInMegabytes)
    ? `${sizeInMegabytes}MB`
    : `${sizeInMegabytes.toFixed(1)}MB`
}

export const removeStoredUpload = (uploadId) => {
  if (!uploadId || typeof window === 'undefined') {
    return
  }

  const uploads = readUploads()

  if (!uploads[uploadId]) {
    return
  }

  delete uploads[uploadId]
  writeUploads(uploads)

  const previewUrl = activePreviewUrls.get(uploadId)

  if (previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl)
  }

  activePreviewUrls.delete(uploadId)
}

export const uploadImageToDevStore = async ({
  file,
  ownerId = 'signup-draft',
  scope = DEV_UPLOAD_SCOPES.VERIFICATION,
  maxSizeInBytes = 1_500_000,
  previewStrategy = 'object-url',
}) => {
  if (!file) {
    throw new Error('Choose a file before uploading.')
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file in JPG, PNG, or WEBP format.')
  }

  if (file.size > maxSizeInBytes) {
    throw new Error(`This image is too large. Please choose one under ${formatMaxSizeLabel(maxSizeInBytes)}.`)
  }

  const previewUrl = await createPreviewUrl(file, previewStrategy)
  const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const record = {
    id: uploadId,
    ownerId: sanitizeSegment(ownerId),
    scope,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    previewUrl,
  }

  const uploads = readUploads()
  uploads[uploadId] = {
    ...record,
    previewUrl: '',
  }

  try {
    writeUploads(uploads)
  } catch {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    throw new Error('We could not save that image right now. Please try another file.')
  }

  activePreviewUrls.set(uploadId, previewUrl)

  return record
}

export const getStoredUpload = (uploadId) => {
  if (!uploadId) {
    return null
  }

  return readUploads()[uploadId] ?? null
}
