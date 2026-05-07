const DEV_SIGNUP_RECORDS_KEY = 'crownpoint_dev_signup_records'
const DEV_SIGNUP_RECORDS_UPDATED_EVENT = 'crownpoint:dev-signup-records-updated'
const SIGNUP_RECORDS_DIR = '/dev-uploads/account-records'

const defaultUploadRecord = {
  uploadId: '',
  fileName: '',
  mimeType: '',
  storagePath: '',
  uploadedAt: null,
}

const defaultSignupRecord = {
  id: '',
  userId: null,
  ownerId: 'signup-record',
  fileName: '',
  storagePath: '',
  savedAt: null,
  createdAt: null,
  name: '',
  email: '',
  password: '',
  role: 'FAN',
  profile: {
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
    preferredContactMethod: '',
  },
  agreements: {
    interactionConfidentialityAcceptedAt: null,
  },
  avatar: {
    ...defaultUploadRecord,
  },
  verificationDocuments: {
    idFront: { ...defaultUploadRecord },
    idBack: { ...defaultUploadRecord },
    ssn: { ...defaultUploadRecord },
  },
}

const sanitizeSegment = (value) =>
  String(value ?? 'signup-record')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'signup-record'

const INVALID_FILE_NAME_CHARACTERS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

const replaceInvalidFileNameCharacters = (value = '') =>
  [...String(value ?? '')]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint < 32 || INVALID_FILE_NAME_CHARACTERS.has(character) ? '-' : character
    })
    .join('')

const sanitizeFileName = (value, fallback) => {
  const trimmedValue = String(value ?? '').trim()
  const sanitizedValue = replaceInvalidFileNameCharacters(trimmedValue)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitizedValue || fallback
}

const buildUploadStoragePath = (ownerId, folderName, fileName) =>
  String(fileName ?? '').trim()
    ? `${folderName}/${sanitizeSegment(ownerId)}/${sanitizeFileName(fileName, 'record.bin')}`
    : ''

const buildSignupRecordStoragePath = (ownerId, fileName) =>
  `${SIGNUP_RECORDS_DIR}/${sanitizeSegment(ownerId)}/${sanitizeFileName(fileName, 'signup-record.json')}`

const emitSignupRecordUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DEV_SIGNUP_RECORDS_UPDATED_EVENT))
  }
}

const normalizeUploadRecord = (record = {}, fallbackStoragePath = '') => ({
  ...defaultUploadRecord,
  ...record,
  uploadId: String(record?.uploadId ?? record?.id ?? '').trim(),
  fileName: String(record?.fileName ?? '').trim(),
  mimeType: String(record?.mimeType ?? '').trim(),
  storagePath: String(record?.storagePath ?? fallbackStoragePath).trim(),
  uploadedAt: record?.uploadedAt ?? null,
})

const normalizeSignupRecord = (recordId, record = {}) => {
  const ownerId = sanitizeSegment(record.ownerId || record.email || record.userId || recordId)
  const fileName = sanitizeFileName(record.fileName, `${recordId}.json`)

  return {
    ...defaultSignupRecord,
    ...record,
    id: String(record.id ?? recordId).trim() || recordId,
    userId: Number.isFinite(Number(record.userId)) ? Number(record.userId) : null,
    ownerId,
    fileName,
    storagePath: buildSignupRecordStoragePath(ownerId, fileName),
    savedAt: record.savedAt ?? null,
    createdAt: record.createdAt ?? null,
    name: String(record.name ?? '').trim(),
    email: String(record.email ?? '').trim().toLowerCase(),
    password: String(record.password ?? ''),
    role: String(record.role ?? 'FAN').trim() || 'FAN',
    profile: {
      ...defaultSignupRecord.profile,
      ...(record.profile ?? {}),
      phone: String(record?.profile?.phone ?? '').trim(),
      dateOfBirth: String(record?.profile?.dateOfBirth ?? '').trim(),
      city: String(record?.profile?.city ?? '').trim(),
      country: String(record?.profile?.country ?? '').trim(),
      countryCode: String(record?.profile?.countryCode ?? '').trim().toUpperCase(),
      phoneDialCode: String(record?.profile?.phoneDialCode ?? '').trim(),
      bio: String(record?.profile?.bio ?? '').trim(),
      admirationReason: String(record?.profile?.admirationReason ?? '').trim(),
      hobbies: String(record?.profile?.hobbies ?? '').trim(),
      interests: String(record?.profile?.interests ?? '').trim(),
      favoriteTalent: String(record?.profile?.favoriteTalent ?? '').trim(),
      occupation: String(record?.profile?.occupation ?? '').trim(),
      preferredContactMethod: String(record?.profile?.preferredContactMethod ?? '').trim(),
    },
    agreements: {
      ...defaultSignupRecord.agreements,
      ...(record.agreements ?? {}),
      interactionConfidentialityAcceptedAt:
        record?.agreements?.interactionConfidentialityAcceptedAt ?? null,
    },
    avatar: normalizeUploadRecord(
      record.avatar,
      buildUploadStoragePath(ownerId, '/dev-uploads/profile-photos', record?.avatar?.fileName),
    ),
    verificationDocuments: {
      idFront: normalizeUploadRecord(
        record?.verificationDocuments?.idFront,
        buildUploadStoragePath(
          ownerId,
          '/dev-uploads/verification',
          record?.verificationDocuments?.idFront?.fileName,
        ),
      ),
      idBack: normalizeUploadRecord(
        record?.verificationDocuments?.idBack,
        buildUploadStoragePath(
          ownerId,
          '/dev-uploads/verification',
          record?.verificationDocuments?.idBack?.fileName,
        ),
      ),
      ssn: normalizeUploadRecord(
        record?.verificationDocuments?.ssn,
        buildUploadStoragePath(
          ownerId,
          '/dev-uploads/verification',
          record?.verificationDocuments?.ssn?.fileName,
        ),
      ),
    },
  }
}

const readSignupRecords = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  const storedRecords = window.localStorage.getItem(DEV_SIGNUP_RECORDS_KEY)

  if (!storedRecords) {
    return {}
  }

  try {
    const parsedRecords = JSON.parse(storedRecords)

    if (!parsedRecords || typeof parsedRecords !== 'object') {
      return {}
    }

    const normalizedRecords = Object.fromEntries(
      Object.entries(parsedRecords).map(([recordId, record]) => [
        recordId,
        normalizeSignupRecord(recordId, record),
      ]),
    )

    if (JSON.stringify(parsedRecords) !== JSON.stringify(normalizedRecords)) {
      writeSignupRecords(normalizedRecords)
    }

    return normalizedRecords
  } catch {
    window.localStorage.removeItem(DEV_SIGNUP_RECORDS_KEY)
    return {}
  }
}

const writeSignupRecords = (records) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(DEV_SIGNUP_RECORDS_KEY, JSON.stringify(records))
  emitSignupRecordUpdate()
}

export const saveSignupRecordToDevStore = ({
  user,
  password,
  avatarUploadId = '',
  avatarName = '',
  verificationDocuments = {},
  ndaAcceptedAt = null,
}) => {
  if (typeof window === 'undefined' || !user) {
    return null
  }

  const ownerId = sanitizeSegment(user.email || user.id || 'signup-record')
  const recordId = `signup-${sanitizeSegment(user.id || ownerId)}`
  const fileName = `signup-${sanitizeSegment(user.id || ownerId)}.json`
  const records = readSignupRecords()

  records[recordId] = normalizeSignupRecord(recordId, {
    id: recordId,
    userId: user.id,
    ownerId,
    fileName,
    savedAt: new Date().toISOString(),
    createdAt: user.createdAt ?? null,
    name: user.name,
    email: user.email,
    password,
    role: user.role,
    profile: user.profile,
    agreements: {
      interactionConfidentialityAcceptedAt:
        ndaAcceptedAt || user?.agreements?.interactionConfidentialityAcceptedAt || user.createdAt,
    },
    avatar: {
      uploadId: avatarUploadId,
      fileName: avatarName,
      storagePath: avatarUploadId
        ? buildUploadStoragePath(ownerId, '/dev-uploads/profile-photos', avatarName)
        : '',
      uploadedAt: user.createdAt ?? null,
    },
    verificationDocuments: {
      idFront: verificationDocuments?.idFront,
      idBack: verificationDocuments?.idBack,
      ssn: verificationDocuments?.ssn,
    },
  })

  writeSignupRecords(records)
  return records[recordId]
}

export const removeSignupRecordFromDevStore = (recordId) => {
  if (!recordId || typeof window === 'undefined') {
    return
  }

  const records = readSignupRecords()

  if (!records[recordId]) {
    return
  }

  delete records[recordId]
  writeSignupRecords(records)
}

export const getAllSignupRecordsFromDevStore = () =>
  Object.values(readSignupRecords()).sort(
    (left, right) => new Date(right.savedAt ?? 0).getTime() - new Date(left.savedAt ?? 0).getTime(),
  )
