import { EXPERIENCE_TYPES, EXPERIENCE_TYPE_ORDER } from '../src/utils/constants.js'

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

export const trimText = (value) => String(value ?? '').trim()

const slugify = (value) => {
  const normalized = trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'item'
}

const buildAmazonMerchUrl = (name = '') => {
  const query = trimText(name)

  if (!query) {
    return ''
  }

  return `https://www.amazon.com/s?${new URLSearchParams({ k: `${query} merch` }).toString()}`
}

const normalizePositiveNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback
}

export const normalizeNonNegativeNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback
}

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value))

export const normalizeAverageRating = (value, fallback = 5) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Number(clampNumber(numericValue, 1, 5).toFixed(1))
}

export const normalizeReviewRating = (value, fallback = 5) => {
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
    trimText(service.description) ||
    config.description ||
    'Custom booking experience managed through CrownPoint.'

  return {
    id: trimText(service.id) || createServiceDraftId(talentId, label, serviceIndex),
    type,
    label,
    description,
    price: normalizePositiveNumber(service.price, config.basePrice),
    icon: trimText(service.icon) || config.icon,
  }
}

const deriveAppearanceFee = ({ fallbackFee = 0, normalizedServices = [] }) => {
  const highestServicePrice = normalizedServices.reduce(
    (highestPrice, service) => Math.max(highestPrice, service.price),
    0,
  )
  const derivedFloor = Math.max(highestServicePrice * 2, fallbackFee * 4)

  return roundCurrencyAmount(derivedFloor)
}

const normalizeEventBooking = (eventBooking = {}, talent = {}, normalizedServices = []) => {
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

const buildTalentSocialProofSeed = (talent = {}, resolvedId = 0) =>
  [
    trimText(talent.name),
    trimText(talent.category),
    trimText(talent.subcategory),
    trimText(talent.location),
    trimText(talent.wikidataId),
  ]
    .join('|')
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0) +
  normalizeNonNegativeNumber(talent.popularityScore, 0) * 17 +
  normalizePositiveNumber(talent.startingPrice, 0) +
  resolvedId * 29

const shouldDeriveCatalogSocialProof = (talent = {}) =>
  Boolean(
    trimText(talent.wikidataId) ||
    trimText(talent.sourceItem) ||
    normalizeNonNegativeNumber(talent.popularityScore, 0) > 0,
  )

const deriveCatalogReviewCount = (talent = {}, resolvedId = 0) => {
  const seed = buildTalentSocialProofSeed(talent, resolvedId)
  return 18 + (seed % 73)
}

const deriveCatalogCompletedBookings = (talent = {}, resolvedId = 0, reviewCount = 0) => {
  const seed = buildTalentSocialProofSeed(talent, resolvedId)
  return Math.max(reviewCount + 24, 48 + (seed % 245))
}

const deriveCatalogRating = (talent = {}, resolvedId = 0) => {
  const seed = buildTalentSocialProofSeed(talent, resolvedId)
  return Number((4.7 + ((seed % 4) * 0.1)).toFixed(1))
}

export const normalizeTalent = (talent = {}, index = 0) => {
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
  const hasCatalogSocialProof = shouldDeriveCatalogSocialProof(talent)
  const storedReviewCount = normalizeNonNegativeNumber(talent.reviewCount, 0)
  const derivedReviewCount = hasCatalogSocialProof
    ? deriveCatalogReviewCount(talent, resolvedId)
    : 0
  const resolvedReviewCount =
    normalizedReviews.length > 0
      ? Math.max(storedReviewCount, normalizedReviews.length)
      : hasCatalogSocialProof && storedReviewCount === 0
        ? derivedReviewCount
        : storedReviewCount
  const storedRating = Number(talent.rating)
  const useDerivedCatalogRating =
    normalizedReviews.length === 0 &&
    hasCatalogSocialProof &&
    (!Number.isFinite(storedRating) ||
      storedRating <= 0 ||
      (normalizeAverageRating(storedRating, 5) === 5 && storedReviewCount === 0))
  const resolvedRating = useDerivedCatalogRating
    ? deriveCatalogRating(talent, resolvedId)
    : normalizeAverageRating(talent.rating, normalizedReviews.length ? reviewAverage : 5)
  const storedCompletedBookings = normalizeNonNegativeNumber(talent.completedBookings, 0)
  const resolvedCompletedBookings =
    hasCatalogSocialProof && storedCompletedBookings === 0
      ? deriveCatalogCompletedBookings(talent, resolvedId, resolvedReviewCount)
      : storedCompletedBookings
  const lowestServicePrice = normalizedServices.reduce(
    (lowestPrice, service) => Math.min(lowestPrice, service.price),
    Number.POSITIVE_INFINITY,
  )
  const name = trimText(talent.name) || `Talent ${resolvedId}`
  const avatarUrl = trimText(talent.avatarUrl)
  const avatarOriginalUrl = trimText(talent.avatarOriginalUrl) || avatarUrl
  const avatarThumbnailUrl = trimText(talent.avatarThumbnailUrl) || avatarUrl
  const avatarSrcSet = trimText(talent.avatarSrcSet)
  const shopLink = trimText(talent.shopLink) || buildAmazonMerchUrl(name)
  const aliases = normalizeStringList(talent.aliases).filter(
    (alias) => alias.toLowerCase() !== name.toLowerCase(),
  )

  return {
    ...talent,
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
    rating: resolvedRating,
    reviewCount: resolvedReviewCount,
    completedBookings: resolvedCompletedBookings,
    popularityScore: normalizeNonNegativeNumber(talent.popularityScore, 0),
    responseTime: trimText(talent.responseTime) || '72h',
    available: talent.available ?? true,
    verified: talent.verified ?? true,
    gradient: trimText(talent.gradient) || DEFAULT_TALENT_GRADIENT,
    avatarUrl,
    avatarOriginalUrl,
    avatarThumbnailUrl,
    avatarSrcSet,
    shopLink,
    wikidataId: trimText(talent.wikidataId),
    sourceItem: trimText(talent.sourceItem),
    startingPrice: Number.isFinite(lowestServicePrice)
      ? lowestServicePrice
      : normalizePositiveNumber(talent.startingPrice, 0),
  }
}
