import { supabase } from '../lib/supabaseClient'
import {
  DEV_UPLOAD_SCOPES,
  removeStoredUpload as removeDevStoredUpload,
  uploadImageToDevStore,
} from './devUploadService'
import {
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  STORAGE_REQUIRED_MESSAGE,
} from '../utils/backendConfig'

export const SUPABASE_STORAGE_ENABLED =
  import.meta.env.VITE_USE_SUPABASE_AUTH === 'true' &&
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const STORAGE_BUCKETS = {
  PAYMENT_PROOFS: 'payment-proofs',
  MESSAGE_ATTACHMENTS: 'message-attachments',
  PROFILE_AVATARS: 'profile-avatars',
  VERIFICATION_DOCUMENTS: 'verification-documents',
}

export const SIGNUP_DRAFT_STORAGE_FOLDER = 'signup-draft'

const PAYMENT_PROOF_MAX_SIZE = 10_000_000
const PROFILE_AVATAR_MAX_SIZE = 2_000_000
const VERIFICATION_DOCUMENT_MAX_SIZE = 10_000_000
const IMAGE_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])
const IMAGE_ALLOWED_EXTENSIONS = new Set(['jpeg', 'jpg', 'png', 'webp'])
const PAYMENT_PROOF_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  ...IMAGE_ALLOWED_MIME_TYPES,
])
const PAYMENT_PROOF_ALLOWED_EXTENSIONS = new Set([
  'pdf',
  ...IMAGE_ALLOWED_EXTENSIONS,
])

const trimText = (value) => String(value ?? '').trim()
const INVALID_FILE_NAME_CHARACTERS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

const sanitizeSegment = (value, fallback = 'upload') =>
  trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback

const replaceInvalidFileNameCharacters = (value = '') =>
  [...String(value ?? '')]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint < 32 || INVALID_FILE_NAME_CHARACTERS.has(character) ? '-' : character
    })
    .join('')

const getFileExtension = (fileName = '') => {
  const normalizedFileName = trimText(fileName).toLowerCase()
  const lastDotIndex = normalizedFileName.lastIndexOf('.')

  if (lastDotIndex < 0) {
    return ''
  }

  return normalizedFileName.slice(lastDotIndex + 1)
}

const sanitizeFileName = (fileName = 'upload.bin') => {
  const normalizedFileName = trimText(fileName)
  const safeFileName =
    replaceInvalidFileNameCharacters(normalizedFileName)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'upload.bin'

  return safeFileName.slice(0, 160)
}

const createUploadId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const buildStoragePath = ({ pathSegments = [], fileName, uploadId }) => {
  const safeSegments = pathSegments
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
  const safeFileName = sanitizeFileName(fileName)

  return [...safeSegments, `${uploadId}-${safeFileName}`].join('/')
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('We could not read that file right now.'))
    reader.readAsDataURL(file)
  })

export const normalizeStoredUpload = (upload = {}) => {
  const normalizedUpload = upload && typeof upload === 'object' ? upload : {}

  return {
    uploadId: trimText(normalizedUpload.uploadId || normalizedUpload.id),
    bucket: trimText(normalizedUpload.bucket),
    storagePath: trimText(normalizedUpload.storagePath),
    fileName: trimText(normalizedUpload.fileName || normalizedUpload.name),
    mimeType: trimText(normalizedUpload.mimeType || normalizedUpload.type),
    size: Number(normalizedUpload.size ?? 0) || 0,
    uploadedAt: normalizedUpload.uploadedAt ?? normalizedUpload.createdAt ?? null,
    publicUrl: trimText(normalizedUpload.publicUrl),
    previewUrl: trimText(normalizedUpload.previewUrl),
  }
}

const validateFileBase = (file, fallbackMessage) => {
  if (typeof File !== 'undefined' && !(file instanceof File)) {
    throw new Error(fallbackMessage)
  }
}

const validateImageFile = (file, { maxSizeInBytes, label }) => {
  validateFileBase(file, `Choose a valid ${label} file before uploading it.`)

  const mimeType = trimText(file?.type).toLowerCase()
  const extension = getFileExtension(file?.name)

  if (
    !IMAGE_ALLOWED_MIME_TYPES.has(mimeType) &&
    !IMAGE_ALLOWED_EXTENSIONS.has(extension)
  ) {
    throw new Error(`Upload a JPG, PNG, or WEBP ${label} image.`)
  }

  if (Number(file?.size ?? 0) > maxSizeInBytes) {
    throw new Error(`${label} images must be ${Math.floor(maxSizeInBytes / 1_000_000)}MB or smaller.`)
  }

  return true
}

export const validatePaymentProofFile = (file) => {
  validateFileBase(file, 'Choose a valid proof file before uploading it.')

  const mimeType = trimText(file?.type).toLowerCase()
  const extension = getFileExtension(file?.name)

  if (
    !PAYMENT_PROOF_ALLOWED_MIME_TYPES.has(mimeType) &&
    !PAYMENT_PROOF_ALLOWED_EXTENSIONS.has(extension)
  ) {
    throw new Error('Upload a PNG, JPG, WEBP, or PDF proof file.')
  }

  if (Number(file?.size ?? 0) > PAYMENT_PROOF_MAX_SIZE) {
    throw new Error('Proof files must be 10MB or smaller.')
  }

  return true
}

export const getPublicStorageUrl = (bucket, storagePath) => {
  if (!SUPABASE_STORAGE_ENABLED) {
    return ''
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return trimText(data?.publicUrl)
}

export const uploadStorageFile = async ({
  bucket,
  file,
  pathSegments = [],
}) => {
  if (!SUPABASE_STORAGE_ENABLED) {
    throw new Error(STORAGE_REQUIRED_MESSAGE)
  }

  const normalizedBucket = trimText(bucket)

  if (!normalizedBucket) {
    throw new Error('A storage bucket is required before uploading files.')
  }

  const uploadId = createUploadId()
  const storagePath = buildStoragePath({
    pathSegments,
    fileName: file?.name || 'upload.bin',
    uploadId,
  })
  const mimeType = trimText(file?.type) || 'application/octet-stream'
  const { error } = await supabase.storage
    .from(normalizedBucket)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message || 'We could not upload that file right now.')
  }

  return normalizeStoredUpload({
    uploadId,
    bucket: normalizedBucket,
    storagePath,
    fileName: file?.name || 'upload.bin',
    mimeType,
    size: Number(file?.size ?? 0) || 0,
    uploadedAt: new Date().toISOString(),
  })
}

export const downloadStoredFile = async (upload = {}) => {
  const normalizedUpload = normalizeStoredUpload(upload)

  if (!normalizedUpload.bucket || !normalizedUpload.storagePath) {
    return null
  }

  if (!SUPABASE_STORAGE_ENABLED) {
    throw new Error(STORAGE_REQUIRED_MESSAGE)
  }

  const { data, error } = await supabase.storage
    .from(normalizedUpload.bucket)
    .download(normalizedUpload.storagePath)

  if (error) {
    throw new Error(error.message || 'We could not load that file right now.')
  }

  return data ?? null
}

export const removeStoredFile = async (upload = {}) => {
  const normalizedUpload = normalizeStoredUpload(upload)

  if (!normalizedUpload.bucket || !normalizedUpload.storagePath) {
    return 0
  }

  if (!SUPABASE_STORAGE_ENABLED) {
    return 0
  }

  const { error } = await supabase.storage
    .from(normalizedUpload.bucket)
    .remove([normalizedUpload.storagePath])

  if (error) {
    throw new Error(error.message || 'We could not remove that file right now.')
  }

  return 1
}

export const removeManagedUpload = async (upload = {}) => {
  const normalizedUpload = normalizeStoredUpload(upload)

  if (normalizedUpload.bucket && normalizedUpload.storagePath) {
    return removeStoredFile(normalizedUpload)
  }

  const localUploadId = normalizedUpload.uploadId || trimText(upload?.id)

  if (localUploadId && LOCAL_BACKEND_FALLBACKS_ENABLED) {
    removeDevStoredUpload(localUploadId)
    return 1
  }

  return 0
}

const buildOwnedStoragePathSegments = ({
  ownerKey,
  isSignupDraft = false,
  category,
  subcategory = '',
}) => {
  const normalizedOwnerKey = sanitizeSegment(ownerKey, isSignupDraft ? 'draft' : 'owner')

  return [
    isSignupDraft ? SIGNUP_DRAFT_STORAGE_FOLDER : normalizedOwnerKey,
    ...(isSignupDraft ? [normalizedOwnerKey] : []),
    sanitizeSegment(category),
    subcategory ? sanitizeSegment(subcategory) : '',
  ].filter(Boolean)
}

export const uploadPaymentProofFile = async ({
  file,
  category = 'order',
  ownerKey = 'guest',
}) => {
  validatePaymentProofFile(file)

  return uploadStorageFile({
    bucket: STORAGE_BUCKETS.PAYMENT_PROOFS,
    file,
    pathSegments: [sanitizeSegment(ownerKey, 'guest'), sanitizeSegment(category, 'order')],
  })
}

export const uploadProfileAvatarFile = async ({
  file,
  ownerKey,
  isSignupDraft = false,
}) => {
  validateImageFile(file, {
    maxSizeInBytes: PROFILE_AVATAR_MAX_SIZE,
    label: 'profile photo',
  })

  if (!SUPABASE_STORAGE_ENABLED) {
    if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
      throw new Error(STORAGE_REQUIRED_MESSAGE)
    }

    const uploadedAvatar = await uploadImageToDevStore({
      file,
      ownerId: ownerKey || SIGNUP_DRAFT_STORAGE_FOLDER,
      scope: DEV_UPLOAD_SCOPES.AVATARS,
      maxSizeInBytes: PROFILE_AVATAR_MAX_SIZE,
      previewStrategy: 'data-url',
    })

    return normalizeStoredUpload({
      ...uploadedAvatar,
      uploadId: uploadedAvatar.id,
      publicUrl: uploadedAvatar.previewUrl,
      previewUrl: uploadedAvatar.previewUrl,
    })
  }

  const previewUrl = await fileToDataUrl(file)
  const storedUpload = await uploadStorageFile({
    bucket: STORAGE_BUCKETS.PROFILE_AVATARS,
    file,
    pathSegments: buildOwnedStoragePathSegments({
      ownerKey,
      isSignupDraft,
      category: 'avatars',
    }),
  })

  return {
    ...storedUpload,
    previewUrl,
    publicUrl: getPublicStorageUrl(storedUpload.bucket, storedUpload.storagePath),
  }
}

export const uploadVerificationDocumentFile = async ({
  file,
  ownerKey,
  documentType = 'document',
  isSignupDraft = false,
}) => {
  validateImageFile(file, {
    maxSizeInBytes: VERIFICATION_DOCUMENT_MAX_SIZE,
    label: 'verification',
  })

  if (!SUPABASE_STORAGE_ENABLED) {
    if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
      throw new Error(STORAGE_REQUIRED_MESSAGE)
    }

    const uploadedFile = await uploadImageToDevStore({
      file,
      ownerId: ownerKey || SIGNUP_DRAFT_STORAGE_FOLDER,
      scope: DEV_UPLOAD_SCOPES.VERIFICATION,
      maxSizeInBytes: VERIFICATION_DOCUMENT_MAX_SIZE,
      previewStrategy: 'data-url',
    })

    return normalizeStoredUpload({
      ...uploadedFile,
      uploadId: uploadedFile.id,
      previewUrl: uploadedFile.previewUrl,
    })
  }

  const previewUrl = await fileToDataUrl(file)
  const storedUpload = await uploadStorageFile({
    bucket: STORAGE_BUCKETS.VERIFICATION_DOCUMENTS,
    file,
    pathSegments: buildOwnedStoragePathSegments({
      ownerKey,
      isSignupDraft,
      category: 'verification',
      subcategory: documentType,
    }),
  })

  return {
    ...storedUpload,
    previewUrl,
  }
}
