import { EXPERIENCE_TYPES, EXPERIENCE_TYPE_ORDER } from '../utils/constants'

const TALENTS_KEY = 'crownpoint_talents'
const TALENTS_VERSION_KEY = 'crownpoint_talents_version'
const TALENTS_UPDATED_EVENT = 'crownpoint:talents-updated'
const TALENTS_SCHEMA_VERSION = 3
const SHOP_ITEM_TYPES = ['APPAREL', 'SIGNED', 'ACCESSORY', 'COLLECTIBLE']
const DEFAULT_TALENT_GRADIENT = 'linear-gradient(135deg, #1d523b, #0b2618)'
const DEFAULT_EVENT_BOOKING_TYPES = [
  'Meet & greet',
  'Corporate event',
  'Festival appearance',
  'Private celebration',
  'Brand campaign',
]
const DEFAULT_EVENT_BUDGET_OPTIONS = [
  '$5,000 - $10,000',
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000 and above',
]

const createShopItem = (id, type, title, price, options = {}) => ({
  id,
  type,
  title,
  price,
  description: options.description ?? '',
  image: options.image ?? '',
  sizes: options.sizes ?? [],
  qty: options.qty ?? null,
  badge: options.badge ?? '',
})

const createReview = (id, rating, comment, options = {}) => ({
  id,
  userId: options.userId ?? null,
  authorName: options.authorName ?? 'CrownPoint Member',
  authorLocation: options.authorLocation ?? '',
  rating,
  comment,
  createdAt: options.createdAt ?? new Date().toISOString(),
  verified: options.verified ?? true,
})

const trimText = (value) => String(value ?? '').trim()

const slugify = (value) => {
  const normalized = trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'item'
}

const normalizePositiveNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback
}

const normalizeNonNegativeNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback
}

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeAverageRating = (value, fallback = 5) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Number(clampNumber(numericValue, 1, 5).toFixed(1))
}

const normalizeReviewRating = (value, fallback = 5) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return clampNumber(Math.round(numericValue), 1, 5)
}

const normalizeTimestamp = (value) => {
  const timestamp = trimText(value)

  if (!timestamp) {
    return ''
  }

  const parsedDate = new Date(timestamp)
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString()
}

const normalizeStringList = (values = []) =>
  Array.isArray(values) ? values.map((value) => trimText(value)).filter(Boolean) : []

const mergeUniqueStringLists = (...lists) => {
  const mergedValues = []
  const seenValues = new Set()

  lists
    .flat()
    .forEach((value) => {
      const normalizedValue = trimText(value)

      if (!normalizedValue) {
        return
      }

      const lookupKey = normalizedValue.toLowerCase()

      if (!seenValues.has(lookupKey)) {
        seenValues.add(lookupKey)
        mergedValues.push(normalizedValue)
      }
    })

  return mergedValues
}

const normalizeEventBudgetOptions = (values = []) => {
  const normalizedOptions = normalizeStringList(values).map((value) =>
    value === 'Under $10,000' ? '$5,000 - $10,000' : value,
  )

  return normalizedOptions.length > 0 ? normalizedOptions : [...DEFAULT_EVENT_BUDGET_OPTIONS]
}

const mergeEventBookingTypes = (values = []) => {
  const mergedValues = [...DEFAULT_EVENT_BOOKING_TYPES]

  normalizeStringList(values).forEach((value) => {
    if (!mergedValues.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      mergedValues.push(value)
    }
  })

  return mergedValues
}

const roundCurrencyAmount = (value) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0
  }

  return Math.round(numericValue / 10) * 10
}

const buildCatalogServiceId = (talentId, type) => `service-${talentId}-${slugify(type)}`

const buildExperienceAnchorPrice = (talent = {}, services = []) => {
  const videoMessageService = services.find(
    (service) =>
      trimText(service?.type) === 'VIDEO_MESSAGE' &&
      normalizePositiveNumber(service?.price, 0) > 0,
  )

  return normalizePositiveNumber(
    videoMessageService?.price,
    normalizePositiveNumber(talent?.startingPrice, EXPERIENCE_TYPES.VIDEO_MESSAGE.basePrice),
  )
}

const buildDefaultExperienceForTalent = (talent = {}, type, services = []) => {
  const config = EXPERIENCE_TYPES[type]
  const anchorPrice = buildExperienceAnchorPrice(talent, services)

  return {
    id: buildCatalogServiceId(talent.id, type),
    type,
    label: config.label,
    description: config.description,
    price: roundCurrencyAmount(anchorPrice * (config.priceMultiplier ?? 1)),
    icon: config.icon,
  }
}

const applyExperienceCatalogToTalent = (talent = {}) => {
  const existingServices = Array.isArray(talent.services)
    ? talent.services.filter((service) => trimText(service?.type) !== 'MEET_AND_GREET')
    : []
  const existingServicesByType = new Map()

  existingServices.forEach((service) => {
    const type = trimText(service?.type)

    if (EXPERIENCE_TYPES[type] && !existingServicesByType.has(type)) {
      existingServicesByType.set(type, service)
    }
  })

  return {
    ...talent,
    services: EXPERIENCE_TYPE_ORDER.map((type) =>
      existingServicesByType.get(type) ?? buildDefaultExperienceForTalent(talent, type, existingServices),
    ),
  }
}

const applyExperienceCatalogToTalentCollection = (records = []) =>
  (Array.isArray(records) ? records : []).map((talent, index) => {
    const resolvedId = Number.isFinite(Number(talent?.id)) ? Number(talent.id) : index + 1
    return applyExperienceCatalogToTalent({ ...talent, id: resolvedId })
  })

const deriveAppearanceFee = ({
  fallbackFee = 0,
  normalizedServices = [],
}) => {
  const highestServicePrice = normalizedServices.reduce(
    (highestPrice, service) => Math.max(highestPrice, service.price),
    0,
  )
  const derivedFloor = Math.max(highestServicePrice * 2, fallbackFee * 4)

  return roundCurrencyAmount(derivedFloor)
}

const buildTalentInitials = (name = '') =>
  trimText(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'T'

const createServiceDraftId = (talentId, label, serviceIndex) =>
  `service-${talentId}-${slugify(label || `experience-${serviceIndex + 1}`)}-${Date.now().toString(36)}`

const createShopItemDraftId = (talentId, title, itemIndex) =>
  `shop-${talentId}-${slugify(title || `item-${itemIndex + 1}`)}-${Date.now().toString(36)}`

const createReviewDraftId = (talentId, authorName, reviewIndex) =>
  `review-${talentId}-${slugify(authorName || `member-${reviewIndex + 1}`)}-${Date.now().toString(36)}`

const getDefaultServiceType = (type) =>
  EXPERIENCE_TYPES[type] ? type : EXPERIENCE_TYPE_ORDER[0]

const getDefaultShopItemType = (type) =>
  SHOP_ITEM_TYPES.includes(type) ? type : SHOP_ITEM_TYPES[0]

const normalizeService = (service = {}, talentId, serviceIndex) => {
  const type = getDefaultServiceType(service.type)
  const config = EXPERIENCE_TYPES[type]
  const label = trimText(service.label) || config.label
  const description =
    trimText(service.description) || config.description || 'Custom booking experience managed through CrownPoint.'

  return {
    id: trimText(service.id) || createServiceDraftId(talentId, label, serviceIndex),
    type,
    label,
    description,
    price: normalizePositiveNumber(service.price, config.basePrice),
    icon: trimText(service.icon) || config.icon,
  }
}

const normalizeEventBooking = (
  eventBooking = {},
  talent = {},
  normalizedServices = [],
) => {
  const appearanceFee = deriveAppearanceFee({
    fallbackFee: normalizePositiveNumber(talent.startingPrice, 0),
    normalizedServices,
  })

  return {
    available: eventBooking.available ?? true,
    appearanceFee: normalizePositiveNumber(eventBooking.appearanceFee, appearanceFee),
    premiumLabel: trimText(eventBooking.premiumLabel) || 'Premium star',
    responseCommitment:
      trimText(eventBooking.responseCommitment) ||
      'During normal business hours, we respond to most inquiries within 4 hours.',
    intro:
      trimText(eventBooking.intro) ||
      'We are happy to assist with booking inquiries. Share the event details, your approximate budget, and your organiser information so our team can review availability and come back to you promptly.',
    eventTypes: mergeEventBookingTypes(eventBooking.eventTypes),
    budgetOptions: normalizeEventBudgetOptions(eventBooking.budgetOptions),
    logisticsNotes:
      trimText(eventBooking.logisticsNotes) ||
      'Include the event date, venue city, expected audience, and any hospitality or travel notes that matter for the booking review.',
  }
}

const normalizeShopItem = (shopItem = {}, talentId, itemIndex) => ({
  id:
    trimText(shopItem.id) ||
    createShopItemDraftId(talentId, shopItem.title, itemIndex),
  type: getDefaultShopItemType(shopItem.type),
  title: trimText(shopItem.title) || `Item ${itemIndex + 1}`,
  price: normalizePositiveNumber(shopItem.price, 1),
  description:
    trimText(shopItem.description) ||
    'Exclusive merchandise published through the CrownPoint roster.',
  image: trimText(shopItem.image),
  sizes: normalizeStringList(shopItem.sizes),
  qty:
    shopItem.qty == null
      ? null
      : normalizeNonNegativeNumber(shopItem.qty, 0),
  badge: trimText(shopItem.badge),
})

const normalizeReview = (review = {}, talentId, reviewIndex) => {
  const authorName = trimText(review.authorName) || 'CrownPoint Member'

  return {
    id:
      trimText(review.id) ||
      createReviewDraftId(talentId, authorName, reviewIndex),
    userId:
      review.userId == null || review.userId === ''
        ? null
        : Number.isFinite(Number(review.userId))
          ? Number(review.userId)
          : null,
    authorName,
    authorLocation: trimText(review.authorLocation),
    rating: normalizeReviewRating(review.rating, 5),
    comment:
      trimText(review.comment) ||
      'Shared privately through the CrownPoint talent desk.',
    createdAt: normalizeTimestamp(review.createdAt),
    verified: review.verified ?? true,
  }
}

const normalizeTalent = (talent = {}, index) => {
  const { events: LEGACY_EVENTS, ...talentShape } = talent
  const resolvedId = Number.isFinite(Number(talent.id)) ? Number(talent.id) : index + 1
  const normalizedServices = Array.isArray(talent.services)
    ? talent.services.map((service, serviceIndex) =>
      normalizeService(service, resolvedId, serviceIndex),
    )
    : []
  const normalizedShopItems = Array.isArray(talent.shopItems)
    ? talent.shopItems.map((shopItem, itemIndex) =>
      normalizeShopItem(shopItem, resolvedId, itemIndex),
    )
    : []
  const normalizedEventBooking = normalizeEventBooking(
    talent.eventBooking,
    talent,
    normalizedServices,
  )
  const normalizedReviews = Array.isArray(talent.reviews)
    ? talent.reviews
      .map((review, reviewIndex) => normalizeReview(review, resolvedId, reviewIndex))
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    : []
  const reviewAverage =
    normalizedReviews.reduce((sum, review) => sum + review.rating, 0) /
    (normalizedReviews.length || 1)
  const resolvedReviewCount = Math.max(
    normalizeNonNegativeNumber(talent.reviewCount, normalizedReviews.length),
    normalizedReviews.length,
  )
  const lowestServicePrice = normalizedServices.reduce(
    (lowestPrice, service) => Math.min(lowestPrice, service.price),
    Number.POSITIVE_INFINITY,
  )
  const name = trimText(talent.name) || `Talent ${resolvedId}`
  const aliases = normalizeStringList(talent.aliases).filter(
    (alias) => alias.toLowerCase() !== name.toLowerCase(),
  )

  return {
    ...talentShape,
    id: resolvedId,
    name,
    aliases,
    category: trimText(talent.category),
    subcategory: trimText(talent.subcategory),
    initials: trimText(talent.initials) || buildTalentInitials(name),
    bio: trimText(talent.bio),
    services: normalizedServices,
    eventBooking: normalizedEventBooking,
    shopItems: normalizedShopItems,
    reviews: normalizedReviews,
    languages: normalizeStringList(talent.languages),
    tags: normalizeStringList(talent.tags),
    location: trimText(talent.location),
    rating: normalizeAverageRating(talent.rating, normalizedReviews.length ? reviewAverage : 5),
    reviewCount: resolvedReviewCount,
    completedBookings: normalizeNonNegativeNumber(talent.completedBookings, 0),
    popularityScore: normalizeNonNegativeNumber(talent.popularityScore, 0),
    responseTime: trimText(talent.responseTime) || '72h',
    available: talent.available ?? true,
    verified: talent.verified ?? true,
    gradient: trimText(talent.gradient) || DEFAULT_TALENT_GRADIENT,
    avatarUrl: trimText(talent.avatarUrl),
    wikidataId: trimText(talent.wikidataId),
    sourceItem: trimText(talent.sourceItem),
    startingPrice: Number.isFinite(lowestServicePrice)
      ? lowestServicePrice
      : normalizePositiveNumber(talent.startingPrice, 0),
  }
}

const getTalentDeduplicationKey = (talent = {}) => {
  const wikidataId = trimText(talent.wikidataId)

  if (wikidataId) {
    return `wikidata:${wikidataId.toLowerCase()}`
  }

  const sourceItem = trimText(talent.sourceItem)

  if (sourceItem) {
    return `source:${sourceItem.toLowerCase()}`
  }

  const numericId = Number(talent.id)

  if (Number.isFinite(numericId)) {
    return `id:${numericId}`
  }

  return ''
}

const scoreTalentRecord = (talent = {}) =>
  [
    trimText(talent.name),
    trimText(talent.category),
    trimText(talent.subcategory),
    trimText(talent.bio),
    trimText(talent.location),
    trimText(talent.avatarUrl),
    ...normalizeStringList(talent.tags),
    ...normalizeStringList(talent.languages),
  ].filter(Boolean).join(' ').length +
  (Array.isArray(talent.services) ? talent.services.length * 20 : 0) +
  (Array.isArray(talent.shopItems) ? talent.shopItems.length * 12 : 0) +
  (Array.isArray(talent.reviews) ? talent.reviews.length * 10 : 0)

const mergeTalentDuplicates = (existingTalent = {}, incomingTalent = {}) => {
  const existingScore = scoreTalentRecord(existingTalent)
  const incomingScore = scoreTalentRecord(incomingTalent)
  const preferredTalent = incomingScore > existingScore ? incomingTalent : existingTalent
  const secondaryTalent = preferredTalent === existingTalent ? incomingTalent : existingTalent
  const preferredName = trimText(preferredTalent.name)
  const mergedAliases = mergeUniqueStringLists(
    preferredTalent.aliases,
    secondaryTalent.aliases,
    preferredName && trimText(secondaryTalent.name).toLowerCase() !== preferredName.toLowerCase()
      ? [secondaryTalent.name]
      : [],
  ).filter((alias) => alias.toLowerCase() !== preferredName.toLowerCase())

  return {
    ...secondaryTalent,
    ...preferredTalent,
    id: Number.isFinite(Number(existingTalent.id))
      ? Number(existingTalent.id)
      : Number.isFinite(Number(preferredTalent.id))
        ? Number(preferredTalent.id)
        : secondaryTalent.id,
    aliases: mergedAliases,
    tags: mergeUniqueStringLists(existingTalent.tags, incomingTalent.tags),
    languages: mergeUniqueStringLists(existingTalent.languages, incomingTalent.languages),
    services:
      Array.isArray(preferredTalent.services) && preferredTalent.services.length > 0
        ? preferredTalent.services
        : secondaryTalent.services,
    shopItems:
      Array.isArray(preferredTalent.shopItems) && preferredTalent.shopItems.length > 0
        ? preferredTalent.shopItems
        : secondaryTalent.shopItems,
    reviews:
      Array.isArray(preferredTalent.reviews) && preferredTalent.reviews.length > 0
        ? preferredTalent.reviews
        : secondaryTalent.reviews,
    eventBooking: preferredTalent.eventBooking ?? secondaryTalent.eventBooking,
    popularityScore: Math.max(
      normalizeNonNegativeNumber(existingTalent.popularityScore, 0),
      normalizeNonNegativeNumber(incomingTalent.popularityScore, 0),
    ),
    wikidataId: trimText(preferredTalent.wikidataId) || trimText(secondaryTalent.wikidataId),
    sourceItem: trimText(preferredTalent.sourceItem) || trimText(secondaryTalent.sourceItem),
  }
}

const dedupeTalentCollection = (records = []) => {
  const dedupedTalents = []
  const deduplicationIndexByKey = new Map()

    ; (Array.isArray(records) ? records : []).forEach((talent) => {
      const deduplicationKey = getTalentDeduplicationKey(talent)

      if (!deduplicationKey) {
        dedupedTalents.push(talent)
        return
      }

      const existingIndex = deduplicationIndexByKey.get(deduplicationKey)

      if (existingIndex === undefined) {
        deduplicationIndexByKey.set(deduplicationKey, dedupedTalents.length)
        dedupedTalents.push(talent)
        return
      }

      dedupedTalents[existingIndex] = mergeTalentDuplicates(dedupedTalents[existingIndex], talent)
    })

  return dedupedTalents
}

const normalizeTalentCollection = (records = []) => dedupeTalentCollection(records).map(normalizeTalent)

const talentRecords = []

const syncTalentRecords = (records) => {
  talentRecords.length = 0
  talentRecords.push(...records)
  return talentRecords
}

const cloneRecords = (records) => JSON.parse(JSON.stringify(records))

const readDefaultTalents = () =>
  normalizeTalentCollection(applyExperienceCatalogToTalentCollection(cloneRecords(talentDefaults)))

const getNextTalentId = (records = []) =>
  records.reduce((highestId, talent) => {
    const numericId = Number(talent?.id)
    return Number.isFinite(numericId) ? Math.max(highestId, numericId) : highestId
  }, 0) + 1

const emitTalentUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TALENTS_UPDATED_EVENT))
  }
}

const readStoredTalents = () => {
  const defaults = readDefaultTalents()

  if (typeof window === 'undefined') {
    return defaults
  }

  const storedTalents = window.localStorage.getItem(TALENTS_KEY)

  if (!storedTalents) {
    window.localStorage.setItem(TALENTS_KEY, JSON.stringify(defaults))
    window.localStorage.setItem(TALENTS_VERSION_KEY, String(TALENTS_SCHEMA_VERSION))
    return defaults
  }

  try {
    const storedVersion = Number(window.localStorage.getItem(TALENTS_VERSION_KEY) ?? 0)
    const parsedTalents = JSON.parse(storedTalents)
    const preparedTalents =
      storedVersion < TALENTS_SCHEMA_VERSION
        ? applyExperienceCatalogToTalentCollection(parsedTalents)
        : parsedTalents
    const normalizedTalents = normalizeTalentCollection(preparedTalents)
    const serializedNormalizedTalents = JSON.stringify(normalizedTalents)

    if (serializedNormalizedTalents !== storedTalents || storedVersion < TALENTS_SCHEMA_VERSION) {
      window.localStorage.setItem(TALENTS_KEY, serializedNormalizedTalents)
      window.localStorage.setItem(TALENTS_VERSION_KEY, String(TALENTS_SCHEMA_VERSION))
    }

    return normalizedTalents
  } catch {
    window.localStorage.setItem(TALENTS_KEY, JSON.stringify(defaults))
    window.localStorage.setItem(TALENTS_VERSION_KEY, String(TALENTS_SCHEMA_VERSION))
    return defaults
  }
}

const writeStoredTalents = (records) => {
  const normalizedTalents = normalizeTalentCollection(records)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TALENTS_KEY, JSON.stringify(normalizedTalents))
    window.localStorage.setItem(TALENTS_VERSION_KEY, String(TALENTS_SCHEMA_VERSION))
  }

  syncTalentRecords(normalizedTalents)
  emitTalentUpdate()
  return talentRecords
}

const initializeTalentStore = () => {
  syncTalentRecords(readStoredTalents())

  if (typeof window === 'undefined' || window.__crownpointTalentsSyncReady) {
    return
  }

  const handleStorage = (event) => {
    if (event.key === TALENTS_KEY) {
      syncTalentRecords(readStoredTalents())
    }
  }

  window.addEventListener('storage', handleStorage)
  window.__crownpointTalentsSyncReady = true
}

const talentDefaults = [
  {
    id: 1,
    name: 'Bruno Mars',
    category: 'Music',
    subcategory: 'R&B / Pop',
    initials: 'B',
    rating: 4.9,
    reviewCount: 2418,
    completedBookings: 2418,
    responseTime: '24h',
    startingPrice: 299,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #1a5c42, #0d3d2a)',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8cG9ydHJhaXQlMjBtYW58ZW58MHx8fHwxNzc1NDE1NjM4fDA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'Bruno Mars is a Grammy-winning recording artist, songwriter, and performer known for his electrifying stage presence and chart-topping hits. With multiple world tours and a Las Vegas residency, Bruno brings the same warmth and charisma to every personal interaction on CrownPoint.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 299, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '15-min exclusive one-on-one video call', price: 799, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Memorabilia', description: 'Personally autographed item, shipped worldwide', price: 499, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('bruno-hoodie', 'APPAREL', '24K Tour Hoodie', 185, {
        description: 'Heavyweight black hoodie with metallic tour crest and satin-lined hood.',
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['S', 'M', 'L', 'XL'],
        qty: 44,
        badge: 'Tour favorite',
      }),
      createShopItem('bruno-vinyl', 'SIGNED', 'Signed Studio Vinyl', 425, {
        description: 'Collector pressing signed on sleeve and sealed with a numbered authenticity card.',
        image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 18,
        badge: 'Signed',
      }),
      createShopItem('bruno-case', 'ACCESSORY', 'Neon Skyline Phone Case', 68, {
        description: 'Artist-branded case inspired by the residency lighting palette.',
        image: 'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 90,
      }),
    ],
    languages: ['English'],
    location: 'Las Vegas, USA',
    tags: ['Grammy Winner', 'World Tour', 'Las Vegas Residency'],
  },
  {
    id: 2,
    name: 'Taylor Swift',
    category: 'Music',
    subcategory: 'Pop / Country',
    initials: 'T',
    rating: 5.0,
    reviewCount: 5820,
    completedBookings: 5820,
    responseTime: '48h',
    startingPrice: 499,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #2d5a4a, #1a3d2e)',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9ydHJhaXQlMjB3b21hbnxlbnwwfHx8fDE3NzU0OTgyNTZ8MA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'Taylor Swift is a global pop icon, record-breaking artist, and cultural phenomenon. Known for deeply personal music and her incredible connection with fans, Taylor brings that same authenticity to every CrownPoint experience.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 499, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '15-min exclusive one-on-one video call', price: 1299, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Memorabilia', description: 'Personally autographed item, shipped worldwide', price: 799, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('taylor-cardigan', 'APPAREL', 'Studio Cardigan', 210, {
        description: 'Soft-knit cardigan with woven lyric label and pearl-finish buttons.',
        image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['XS', 'S', 'M', 'L'],
        qty: 36,
        badge: 'Collector drop',
      }),
      createShopItem('taylor-journal', 'COLLECTIBLE', 'Handwritten Lyrics Journal', 145, {
        description: 'Foil-stamped journal with lyric facsimiles, archive stills, and cream-stock pages.',
        image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 70,
      }),
      createShopItem('taylor-signed-photo', 'SIGNED', 'Signed Portrait Print', 520, {
        description: 'Large-format gallery print signed in gold marker with archive certificate.',
        image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 22,
        badge: 'Signed',
      }),
    ],
    languages: ['English'],
    location: 'Nashville, USA',
    tags: ['Record Breaker', 'Eras Tour', 'Songwriter'],
  },
  {
    id: 3,
    name: 'Keanu Reeves',
    category: 'Film',
    subcategory: 'Action / Drama',
    initials: 'K',
    rating: 4.9,
    reviewCount: 1876,
    completedBookings: 1876,
    responseTime: '24h',
    startingPrice: 399,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #1e4a3a, #0d2a1e)',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8N3x8cG9ydHJhaXQlMjBtYW58ZW58MHx8fHwxNzc1NDE1NjM4fDA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'Keanu Reeves is one of Hollywood\'s most beloved and respected actors, known for his humility, generosity, and iconic roles. His genuine warmth makes every fan interaction truly memorable.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 399, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '15-min exclusive one-on-one video call', price: 999, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Memorabilia', description: 'Personally autographed item, shipped worldwide', price: 599, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('keanu-poster', 'SIGNED', 'Signed Legacy Poster', 480, {
        description: 'Museum-stock poster signed and sealed with embossed authenticity mark.',
        image: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 24,
        badge: 'Signed',
      }),
      createShopItem('keanu-jacket', 'APPAREL', 'Motor Club Jacket', 265, {
        description: 'Matte black coach jacket with understated back patch and satin interior.',
        image: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['M', 'L', 'XL'],
        qty: 30,
      }),
      createShopItem('keanu-bookmark', 'ACCESSORY', 'Archive Film Strip Bookmark', 44, {
        description: 'A slim metal bookmark inspired by classic editing strips and studio archive labels.',
        image: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 80,
      }),
    ],
    languages: ['English'],
    location: 'Los Angeles, USA',
    tags: ['John Wick', 'The Matrix', 'Hollywood Icon'],
  },
  {
    id: 4,
    name: 'Sydney Sweeney',
    category: 'Film & TV',
    subcategory: 'Drama / TV',
    initials: 'S',
    rating: 4.8,
    reviewCount: 1203,
    completedBookings: 1203,
    responseTime: '24h',
    startingPrice: 349,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #2a5240, #0f2e20)',
    avatarUrl: 'https://images.unsplash.com/photo-1634595477722-7bc68dd410fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cG9ydHJhaXQlMjB3b21hbnxlbnwwfHx8fDE3NzU0OTgyNTZ8MA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'Sydney Sweeney is one of Hollywood\'s fastest-rising stars, acclaimed for her versatile performances across film and television. Her down-to-earth personality and passion for her craft shine through in every interaction.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 349, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '15-min exclusive one-on-one video call', price: 899, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Memorabilia', description: 'Personally autographed item, shipped worldwide', price: 499, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('sydney-crewneck', 'APPAREL', 'Atelier Crewneck', 156, {
        description: 'Cream fleece crewneck with tonal embroidery and relaxed premium fit.',
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['S', 'M', 'L'],
        qty: 40,
      }),
      createShopItem('sydney-polaroid', 'SIGNED', 'Signed Set Polaroid', 290, {
        description: 'A framed still signed on matte border with numbered card back.',
        image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 26,
      }),
      createShopItem('sydney-cap', 'ACCESSORY', 'Studio Baseball Cap', 58, {
        description: 'Low-profile cap with brushed cotton finish and embossed back buckle.',
        image: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 72,
      }),
    ],
    languages: ['English'],
    location: 'Los Angeles, USA',
    tags: ['Euphoria', 'Anyone But You', 'Emmy Nominee'],
  },
  {
    id: 5,
    name: 'Kai Cenat',
    category: 'Creators',
    subcategory: 'Streaming / Gaming',
    initials: 'K',
    rating: 4.9,
    reviewCount: 3241,
    completedBookings: 3241,
    responseTime: '12h',
    startingPrice: 199,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #1a4d38, #082818)',
    avatarUrl: 'https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9ydHJhaXQlMjBtYW58ZW58MHx8fHwxNzc1NDE1NjM4fDA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'Kai Cenat is Twitch\'s most-subscribed streamer and a cultural force in digital entertainment. His energy, authenticity, and connection with fans are unmatched. Every interaction is guaranteed to be an event.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 199, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Live Shoutout', description: 'Live shoutout on stream', price: 499, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Merch', description: 'Signed Kai Cenat merch item', price: 299, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('kai-jersey', 'APPAREL', 'AMP Team Jersey', 110, {
        description: 'Athletic-fit jersey with stitched numbering and tonal side paneling.',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['S', 'M', 'L', 'XL'],
        qty: 58,
      }),
      createShopItem('kai-controller', 'ACCESSORY', 'Signature Controller Shell', 96, {
        description: 'Gloss shell kit with laser-etched AMP detailing and matte grips.',
        image: 'https://images.unsplash.com/photo-1603481546579-65d935ba9cdd?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 42,
        badge: 'Drop',
      }),
      createShopItem('kai-poster', 'SIGNED', 'Signed Stream Poster', 230, {
        description: 'Large-format stream art poster signed and individually numbered.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 28,
      }),
    ],
    languages: ['English'],
    location: 'New York, USA',
    tags: ['Twitch Record', 'Subathon King', 'AMP'],
  },
  {
    id: 6,
    name: 'IShowSpeed',
    category: 'Creators',
    subcategory: 'YouTube / Gaming',
    initials: 'I',
    rating: 4.7,
    reviewCount: 2890,
    completedBookings: 2890,
    responseTime: '12h',
    startingPrice: 149,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #245740, #102a1e)',
    avatarUrl: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8Nnx8cG9ydHJhaXQlMjBtYW58ZW58MHx8fHwxNzc1NDE1NjM4fDA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'IShowSpeed is YouTube\'s most electrifying content creator, known for his unpredictable energy, global fanbase, and genuine passion. Every fan moment with Speed is one for the books.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 149, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '10-min exclusive video call', price: 399, icon: 'Phone' },
    ],
    shopItems: [
      createShopItem('speed-tee', 'APPAREL', 'Speed World Tour Tee', 72, {
        description: 'Washed black tee with oversized world-map print and red stitch logo.',
        image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['S', 'M', 'L', 'XL'],
        qty: 64,
      }),
      createShopItem('speed-scarf', 'ACCESSORY', 'Ronaldo Match Scarf', 48, {
        description: 'Double-knit supporter scarf with woven crest and Speed signature colors.',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 92,
      }),
      createShopItem('speed-card', 'COLLECTIBLE', 'Holographic Fan Card', 38, {
        description: 'Limited trading-style card with foil finish and numbered back stamp.',
        image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 130,
      }),
    ],
    languages: ['English'],
    location: 'Cincinnati, USA',
    tags: ['YouTube Global', 'Ronaldo Moment', 'Speed Gang'],
  },
  {
    id: 7,
    name: 'LeBron James',
    category: 'Sports',
    subcategory: 'Basketball / NBA',
    initials: 'L',
    rating: 5.0,
    reviewCount: 4102,
    completedBookings: 4102,
    responseTime: '48h',
    startingPrice: 599,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #1f4e3c, #0b2a1a)',
    avatarUrl: 'https://images.unsplash.com/photo-1583195763986-0231686dcd43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTF8fHBvcnRyYWl0JTIwbWFufGVufDB8fHx8MTc3NTQxNTYzOHww&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'LeBron James is the greatest basketball player of his generation and a global ambassador for sport, culture, and community. A personal message from The King is a moment fans will cherish forever.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 599, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '15-min exclusive one-on-one video call', price: 1499, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Memorabilia', description: 'Personally autographed NBA item', price: 899, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('lebron-ball', 'SIGNED', 'Signed Championship Basketball', 780, {
        description: 'Display-grade ball signed in metallic ink with engraved wood stand.',
        image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 20,
        badge: 'Signed',
      }),
      createShopItem('lebron-jersey', 'APPAREL', 'CrownPoint Alternate Jersey', 240, {
        description: 'Premium stitched jersey with heavyweight twill numbers and gold trim.',
        image: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['M', 'L', 'XL', 'XXL'],
        qty: 34,
      }),
      createShopItem('lebron-frame', 'COLLECTIBLE', 'Legacy Photo Frame', 165, {
        description: 'Walnut frame with gallery print and engraved career milestone plaque.',
        image: 'https://images.unsplash.com/photo-1516542076529-1ea3854896f2?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 46,
      }),
    ],
    languages: ['English'],
    location: 'Los Angeles, USA',
    tags: ['4x Champion', 'The King', 'Space Jam'],
  },
  {
    id: 8,
    name: 'Zendaya',
    category: 'Film & TV',
    subcategory: 'Drama / Music',
    initials: 'Z',
    rating: 4.9,
    reviewCount: 3756,
    completedBookings: 3756,
    responseTime: '48h',
    startingPrice: 449,
    available: true,
    verified: true,
    gradient: 'linear-gradient(135deg, #265842, #0e2c1a)',
    avatarUrl: 'https://images.unsplash.com/photo-1611451444023-7fe9d86fe1d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MXxzZWFyY2h8N3x8cG9ydHJhaXQlMjB3b21hbnxlbnwwfHx8fDE3NzU0OTgyNTZ8MA&ixlib=rb-4.1.0&q=80&w=400',
    bio: 'Zendaya is an Emmy-winning actress, fashion icon, and musical artist whose talent and grace have made her one of the most celebrated entertainers of her generation. Her warmth and authenticity make every fan connection special.',
    services: [
      { id: 's1', type: 'VIDEO_MESSAGE', label: 'Personal Video Message', description: 'Custom recorded message for any occasion', price: 449, icon: 'Video' },
      { id: 's2', type: 'LIVE_CALL', label: 'Private Live Call', description: '15-min exclusive one-on-one video call', price: 1099, icon: 'Phone' },
      { id: 's3', type: 'SIGNED_MERCH', label: 'Signed Memorabilia', description: 'Personally autographed item, shipped worldwide', price: 649, icon: 'PenLine' },
    ],
    shopItems: [
      createShopItem('zendaya-trench', 'APPAREL', 'Signature Trench Coat', 320, {
        description: 'Longline trench with satin lining, tailored drape, and hidden tonal embroidery.',
        image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        sizes: ['S', 'M', 'L'],
        qty: 20,
        badge: 'Runway drop',
      }),
      createShopItem('zendaya-zine', 'COLLECTIBLE', 'Archive Style Zine', 92, {
        description: 'Oversized print zine featuring editorial stills, notes, and behind-the-scenes frames.',
        image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 58,
      }),
      createShopItem('zendaya-signed-card', 'SIGNED', 'Signed Editorial Card', 360, {
        description: 'Foil-finish editorial card signed and delivered in a rigid presentation sleeve.',
        image: 'https://images.unsplash.com/photo-1521577352947-9bb58764b69a?auto=format&fit=crop&fm=jpg&q=80&w=1200',
        qty: 25,
      }),
    ],
    languages: ['English'],
    location: 'Los Angeles, USA',
    tags: ['Emmy Winner', 'Euphoria', 'Dune', 'Fashion Icon'],
  },
]

initializeTalentStore()

export const talents = talentRecords

export const getAllTalents = () => syncTalentRecords(readStoredTalents())

export const getFeaturedTalents = () => getAllTalents().slice(0, 6)

export const getTalentById = (id) => getAllTalents().find((talent) => talent.id === Number(id))

export const getTalentsByCategory = (category) =>
  category === 'All'
    ? getAllTalents()
    : getAllTalents().filter(
      (talent) => talent.category === category || talent.subcategory?.includes(category),
    )

export const addTalent = (talent) => {
  const currentTalents = getAllTalents()
  const nextTalentId = Number.isFinite(Number(talent?.id))
    ? Number(talent.id)
    : getNextTalentId(currentTalents)

  if (currentTalents.some((candidate) => candidate.id === nextTalentId)) {
    throw new Error('That talent already exists in the live roster.')
  }

  const nextTalent = normalizeTalent(
    applyExperienceCatalogToTalent(
      {
        ...talent,
        id: nextTalentId,
        services: Array.isArray(talent?.services) ? talent.services : [],
        shopItems: Array.isArray(talent?.shopItems) ? talent.shopItems : [],
        reviews: Array.isArray(talent?.reviews) ? talent.reviews : [],
      },
    ),
    currentTalents.length,
  )

  writeStoredTalents([...currentTalents, nextTalent])
  return getTalentById(nextTalentId)
}

export const updateTalent = (talentId, talent) => {
  const resolvedTalentId = Number(talentId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before saving changes.')
  }

  const currentTalents = getAllTalents()
  const targetTalentIndex = currentTalents.findIndex((candidate) => candidate.id === resolvedTalentId)

  if (targetTalentIndex < 0) {
    throw new Error('We could not find that talent right now.')
  }

  const targetTalent = currentTalents[targetTalentIndex]
  const nextTalent = normalizeTalent(
    {
      ...targetTalent,
      ...talent,
      id: resolvedTalentId,
      services: Array.isArray(talent?.services) ? talent.services : targetTalent.services,
      shopItems: Array.isArray(talent?.shopItems) ? talent.shopItems : targetTalent.shopItems,
      reviews: Array.isArray(talent?.reviews) ? talent.reviews : targetTalent.reviews,
      languages: talent?.languages === undefined ? targetTalent.languages : talent.languages,
      tags: talent?.tags === undefined ? targetTalent.tags : talent.tags,
    },
    targetTalentIndex,
  )

  writeStoredTalents(
    currentTalents.map((candidate) => (candidate.id === resolvedTalentId ? nextTalent : candidate)),
  )

  return getTalentById(resolvedTalentId)
}

export const deleteTalent = (talentId) => {
  const resolvedTalentId = Number(talentId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before deleting.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((candidate) => candidate.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  writeStoredTalents(currentTalents.filter((candidate) => candidate.id !== resolvedTalentId))
  return targetTalent
}

export const addExperienceToTalent = (talentId, service) => {
  const resolvedTalentId = Number(talentId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before adding an experience.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  const nextService = normalizeService(
    {
      ...service,
      id:
        trimText(service?.id) ||
        createServiceDraftId(resolvedTalentId, service?.label || service?.type, targetTalent.services.length),
    },
    resolvedTalentId,
    targetTalent.services.length,
  )

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          services: [...talent.services, nextService],
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const updateExperienceForTalent = (talentId, serviceId, service) => {
  const resolvedTalentId = Number(talentId)
  const resolvedServiceId = trimText(serviceId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before saving that experience.')
  }

  if (!resolvedServiceId) {
    throw new Error('Choose a valid experience before saving changes.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  const targetServiceIndex = targetTalent.services.findIndex((item) => item.id === resolvedServiceId)

  if (targetServiceIndex < 0) {
    throw new Error('We could not find that experience right now.')
  }

  const targetService = targetTalent.services[targetServiceIndex]
  const nextService = normalizeService(
    {
      ...targetService,
      ...service,
      id: resolvedServiceId,
    },
    resolvedTalentId,
    targetServiceIndex,
  )

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          services: talent.services.map((item) => (item.id === resolvedServiceId ? nextService : item)),
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const deleteExperienceFromTalent = (talentId, serviceId) => {
  const resolvedTalentId = Number(talentId)
  const resolvedServiceId = trimText(serviceId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before deleting that experience.')
  }

  if (!resolvedServiceId) {
    throw new Error('Choose a valid experience before deleting it.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  if (!targetTalent.services.some((item) => item.id === resolvedServiceId)) {
    throw new Error('We could not find that experience right now.')
  }

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          services: talent.services.filter((item) => item.id !== resolvedServiceId),
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const addShopItemToTalent = (talentId, shopItem) => {
  const resolvedTalentId = Number(talentId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before adding a shop item.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  const nextShopItem = normalizeShopItem(
    {
      ...shopItem,
      id:
        trimText(shopItem?.id) ||
        createShopItemDraftId(resolvedTalentId, shopItem?.title, targetTalent.shopItems.length),
    },
    resolvedTalentId,
    targetTalent.shopItems.length,
  )

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          shopItems: [...talent.shopItems, nextShopItem],
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const updateShopItemForTalent = (talentId, shopItemId, shopItem) => {
  const resolvedTalentId = Number(talentId)
  const resolvedShopItemId = trimText(shopItemId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before saving that shop item.')
  }

  if (!resolvedShopItemId) {
    throw new Error('Choose a valid shop item before saving changes.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  const targetShopItemIndex = targetTalent.shopItems.findIndex((item) => item.id === resolvedShopItemId)

  if (targetShopItemIndex < 0) {
    throw new Error('We could not find that shop item right now.')
  }

  const targetShopItem = targetTalent.shopItems[targetShopItemIndex]
  const nextShopItem = normalizeShopItem(
    {
      ...targetShopItem,
      ...shopItem,
      id: resolvedShopItemId,
      sizes: Array.isArray(shopItem?.sizes) ? shopItem.sizes : targetShopItem.sizes,
    },
    resolvedTalentId,
    targetShopItemIndex,
  )

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          shopItems: talent.shopItems.map((item) =>
            item.id === resolvedShopItemId ? nextShopItem : item,
          ),
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const deleteShopItemFromTalent = (talentId, shopItemId) => {
  const resolvedTalentId = Number(talentId)
  const resolvedShopItemId = trimText(shopItemId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before deleting that shop item.')
  }

  if (!resolvedShopItemId) {
    throw new Error('Choose a valid shop item before deleting it.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  if (!targetTalent.shopItems.some((item) => item.id === resolvedShopItemId)) {
    throw new Error('We could not find that shop item right now.')
  }

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          shopItems: talent.shopItems.filter((item) => item.id !== resolvedShopItemId),
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const addReviewToTalent = (talentId, review) => {
  const resolvedTalentId = Number(talentId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before saving that review.')
  }

  const currentTalents = getAllTalents()
  const targetTalent = currentTalents.find((talent) => talent.id === resolvedTalentId)

  if (!targetTalent) {
    throw new Error('We could not find that talent right now.')
  }

  const trimmedComment = trimText(review?.comment)
  if (!trimmedComment) {
    throw new Error('Add a short review before submitting.')
  }

  const normalizedUserId =
    review?.userId == null || review.userId === ''
      ? null
      : Number.isFinite(Number(review.userId))
        ? Number(review.userId)
        : null

  if (
    normalizedUserId != null &&
    targetTalent.reviews.some((entry) => entry.userId === normalizedUserId)
  ) {
    throw new Error('You already left a review for this talent.')
  }

  const nextReview = normalizeReview(
    createReview(
      trimText(review?.id) ||
      createReviewDraftId(resolvedTalentId, review?.authorName, targetTalent.reviews.length),
      review?.rating,
      trimmedComment,
      {
        ...review,
        userId: normalizedUserId,
        createdAt: review?.createdAt ?? new Date().toISOString(),
      },
    ),
    resolvedTalentId,
    targetTalent.reviews.length,
  )
  const currentReviewCount = Math.max(
    normalizeNonNegativeNumber(targetTalent.reviewCount, targetTalent.reviews.length),
    targetTalent.reviews.length,
  )
  const currentRating = normalizeAverageRating(
    targetTalent.rating,
    targetTalent.reviews.length ? targetTalent.reviews[0].rating : nextReview.rating,
  )
  const nextReviewCount = currentReviewCount + 1
  const nextRating = Number(
    (
      (currentRating * currentReviewCount + nextReview.rating) /
      nextReviewCount
    ).toFixed(1),
  )

  writeStoredTalents(
    currentTalents.map((talent) =>
      talent.id === resolvedTalentId
        ? {
          ...talent,
          rating: nextRating,
          reviewCount: nextReviewCount,
          reviews: [nextReview, ...talent.reviews],
        }
        : talent,
    ),
  )

  return getTalentById(resolvedTalentId)
}

export const subscribeToTalentUpdates = (listener) => {
  if (typeof window === 'undefined') {
    return () => { }
  }

  const handleUpdate = () => listener(getAllTalents())
  const handleStorage = (event) => {
    if (event.key === TALENTS_KEY) {
      listener(getAllTalents())
    }
  }

  window.addEventListener(TALENTS_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(TALENTS_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
  }
}
