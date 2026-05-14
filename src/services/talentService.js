import featuredTalentSeed from '../data/talents.featured.seed.json'
import { supabase } from '../lib/supabaseClient'
import api from '../utils/api'
import {
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  SUPABASE_TALENTS_ENABLED,
} from '../utils/backendConfig'
import {
  applyExperienceCatalogToTalentCollection,
  cloneTalentRecords,
  normalizeAverageRating,
  normalizeNonNegativeNumber,
  normalizeReviewRating,
  normalizeTalent,
  normalizeTalentCollection,
  trimText,
} from '../data/talentModel'

const TALENT_ROSTER_UPDATED_EVENT = 'crownpoint:talent-roster-updated'
const TALENT_ROSTER_SYNC_KEY = 'crownpoint_talent_roster_sync'
const TALENT_API_START_HINT = 'Start `npm run api` so dashboard talent edits can write to talents.catalog.json.'
const TALENT_SUPABASE_START_HINT =
  'Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_USE_SUPABASE_TALENTS=true after you push the talents migration and seed the table.'
const TALENT_MUTATION_API_START_HINT =
  'Start `npm run api` so talent edits and review submissions can write through the local server.'
const TALENT_LOAD_ERROR_MESSAGE = 'We could not load the talent roster right now.'
const TALENT_SAVE_ERROR_MESSAGE = 'We could not save those talent changes right now.'
const TALENT_LIVE_ROSTER_MISMATCH_MESSAGE =
  'The talent save finished, but the live roster did not pick up the new record. This usually means the admin API is writing to the file catalog while the app is reading Supabase. Start the API with `npm run api` locally or enable the Supabase talent env vars on the API host.'
const TALENT_CATALOG_FALLBACK_URL = '/data/talents.catalog.json'
const TALENT_FEATURED_FALLBACK_URL = '/data/talents.featured.json'
const FEATURED_TALENT_LIMIT = 6
const TALENT_SUPABASE_TABLE = 'talents'
const SUPABASE_TALENT_PAGE_SIZE = 1000

const prepareTalentRoster = (records = []) =>
  normalizeTalentCollection(
    applyExperienceCatalogToTalentCollection(cloneTalentRecords(records)),
  )

const prepareFeaturedTalentRoster = (records = []) => normalizeTalentCollection(cloneTalentRecords(records))

let talentRosterCache = []
let featuredTalentCache = prepareFeaturedTalentRoster(featuredTalentSeed).slice(0, FEATURED_TALENT_LIMIT)
let seedTalentRosterPromise = null
let featuredTalentSeedPromise = null

const loadSeedTalentRoster = async () => {
  if (!seedTalentRosterPromise) {
    seedTalentRosterPromise = fetch(TALENT_CATALOG_FALLBACK_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('The fallback talent catalog could not be loaded.')
        }

        return prepareTalentRoster(await response.json())
      })
      .catch((error) => {
        seedTalentRosterPromise = null
        throw error
      })
  }

  return seedTalentRosterPromise
}

const loadSeedFeaturedTalents = async (limit = FEATURED_TALENT_LIMIT) => {
  if (!featuredTalentSeedPromise) {
    featuredTalentSeedPromise = fetch(TALENT_FEATURED_FALLBACK_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('The featured fallback talent catalog could not be loaded.')
        }

        return prepareFeaturedTalentRoster(await response.json())
      })
      .catch((error) => {
        featuredTalentSeedPromise = null
        throw error
      })
  }

  const featuredTalents = await featuredTalentSeedPromise
  return featuredTalents.slice(0, limit)
}

const syncTalentRosterCache = (records = []) => {
  talentRosterCache = prepareTalentRoster(records)
  featuredTalentCache = talentRosterCache.slice(0, FEATURED_TALENT_LIMIT)
  return talentRosterCache
}

const emitTalentRosterUpdate = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(TALENT_ROSTER_UPDATED_EVENT))

  try {
    window.localStorage.setItem(TALENT_ROSTER_SYNC_KEY, new Date().toISOString())
  } catch {
    // Ignore sync-storage failures during local development.
  }
}

const readApiErrorMessage = (error, fallbackMessage) => {
  if (!error?.response) {
    return fallbackMessage
  }

  return trimText(error.response.data?.message) || trimText(error.message) || fallbackMessage
}

const readSupabaseErrorMessage = (error, fallbackMessage) =>
  trimText(error?.message) || trimText(error?.details) || trimText(error?.hint) || fallbackMessage

const logTalentSetupIssue = (message) => {
  console.warn(message)
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
  eventBooking: record.event_booking && typeof record.event_booking === 'object' ? record.event_booking : {},
  shopItems: Array.isArray(record.shop_items) ? record.shop_items : [],
  reviews: Array.isArray(record.reviews) ? record.reviews : [],
  rating: normalizeAverageRating(record.rating, 5),
  reviewCount: normalizeNonNegativeNumber(record.review_count, 0),
  completedBookings: normalizeNonNegativeNumber(record.completed_bookings, 0),
})

const readAllSupabaseTalentRows = async (buildQuery) => {
  const rows = []
  let pageIndex = 0

  while (true) {
    const from = pageIndex * SUPABASE_TALENT_PAGE_SIZE
    const to = from + SUPABASE_TALENT_PAGE_SIZE - 1
    const { data, error } = await buildQuery().range(from, to)

    if (error) {
      throw error
    }

    const nextRows = data ?? []
    rows.push(...nextRows)

    if (nextRows.length < SUPABASE_TALENT_PAGE_SIZE) {
      return rows
    }

    pageIndex += 1
  }
}

const fetchTalentsFromSupabase = async () => {
  const rows = await readAllSupabaseTalentRows(() =>
    supabase
      .from(TALENT_SUPABASE_TABLE)
      .select('*')
      .order('id', { ascending: true }),
  )

  return syncTalentRosterCache(rows.map(fromSupabaseTalentRecord))
}

const fetchFeaturedTalentsFromSupabase = async (limit = FEATURED_TALENT_LIMIT) => {
  const { data, error } = await supabase
    .from(TALENT_SUPABASE_TABLE)
    .select('*')
    .eq('available', true)
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    throw error
  }

  featuredTalentCache = prepareFeaturedTalentRoster((data ?? []).map(fromSupabaseTalentRecord)).slice(0, limit)
  return featuredTalentCache
}

const fetchTalentFromSupabase = async (talentId) => {
  const { data, error } = await supabase
    .from(TALENT_SUPABASE_TABLE)
    .select('*')
    .eq('id', talentId)
    .single()

  if (error) {
    throw error
  }

  return data ? normalizeTalent(fromSupabaseTalentRecord(data), Math.max(getTalentIndex(talentId), 0)) : null
}

const refreshTalentRoster = async () => {
  if (SUPABASE_TALENTS_ENABLED) {
    return fetchTalentsFromSupabase()
  }

  const response = await api.get('/talents')
  return syncTalentRosterCache(response.data)
}

const refreshTalentRosterWithFallback = async () => {
  try {
    return await refreshTalentRoster()
  } catch (error) {
    if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
      if (SUPABASE_TALENTS_ENABLED) {
        logTalentSetupIssue(
          `Talent roster loading failed. ${readSupabaseErrorMessage(error, TALENT_SUPABASE_START_HINT)}`,
        )
      } else {
        logTalentSetupIssue(
          `Talent roster loading failed. ${readApiErrorMessage(error, TALENT_API_START_HINT)}`,
        )
      }

      throw new Error(TALENT_LOAD_ERROR_MESSAGE)
    }

    if (SUPABASE_TALENTS_ENABLED) {
      logTalentSetupIssue(
        `Falling back to seeded talent catalog because Supabase talent loading is unavailable. ${readSupabaseErrorMessage(error, TALENT_SUPABASE_START_HINT)}`,
      )
    } else {
      logTalentSetupIssue(
        `Falling back to seeded talent catalog because the local talent API is unavailable. ${readApiErrorMessage(error, TALENT_API_START_HINT)}`,
      )
    }
    const seededRoster = await loadSeedTalentRoster()
    return syncTalentRosterCache(seededRoster)
  }
}

const requireValidTalentId = (talentId) => {
  const resolvedTalentId = Number(talentId)

  if (!Number.isFinite(resolvedTalentId)) {
    throw new Error('Choose a valid talent before saving changes.')
  }

  return resolvedTalentId
}

const getTalentIndex = (talentId) =>
  talentRosterCache.findIndex((talent) => Number(talent.id) === Number(talentId))

const getTalentFromCache = (talentId) =>
  talentRosterCache.find((talent) => Number(talent.id) === Number(talentId)) ?? null

const buildTalentPayload = (currentTalent, updates = {}, talentIndex = 0) =>
  normalizeTalent(
    {
      ...currentTalent,
      ...updates,
      id: Number(currentTalent?.id ?? updates?.id),
      services: updates?.services === undefined ? currentTalent?.services : updates.services,
      shopItems: updates?.shopItems === undefined ? currentTalent?.shopItems : updates.shopItems,
      reviews: updates?.reviews === undefined ? currentTalent?.reviews : updates.reviews,
      languages: updates?.languages === undefined ? currentTalent?.languages : updates.languages,
      tags: updates?.tags === undefined ? currentTalent?.tags : updates.tags,
    },
    talentIndex,
  )

const persistMutation = async (mutation) => {
  try {
    const result = await mutation()
    await refreshTalentRoster()
    emitTalentRosterUpdate()
    return result
  } catch (error) {
    if (error?.response || error?.request) {
      logTalentSetupIssue(
        `Talent roster update failed. ${readApiErrorMessage(
          error,
          SUPABASE_TALENTS_ENABLED ? TALENT_MUTATION_API_START_HINT : TALENT_API_START_HINT,
        )}`,
      )
      throw new Error(TALENT_SAVE_ERROR_MESSAGE)
    }

    if (SUPABASE_TALENTS_ENABLED) {
      logTalentSetupIssue(
        `Talent roster update failed. ${readSupabaseErrorMessage(error, TALENT_SUPABASE_START_HINT)}`,
      )
      throw new Error(TALENT_SAVE_ERROR_MESSAGE)
    }

    throw error
  }
}

export const getTalentRosterSnapshot = () => talentRosterCache

export const getFeaturedTalentsSnapshot = (limit = FEATURED_TALENT_LIMIT) =>
  featuredTalentCache.slice(0, limit)

export const getTalentSnapshotById = (id) => getTalentFromCache(id)

export const getAllTalents = async () => refreshTalentRosterWithFallback()

export const getFeaturedTalents = async (limit = FEATURED_TALENT_LIMIT) => {
  if (talentRosterCache.length >= limit) {
    featuredTalentCache = talentRosterCache.slice(0, limit)
    return featuredTalentCache
  }

  if (SUPABASE_TALENTS_ENABLED) {
    try {
      return await fetchFeaturedTalentsFromSupabase(limit)
    } catch (error) {
      if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
        throw error
      }

      console.warn(
        `Falling back to the featured talent seed because Supabase is unavailable. ${readSupabaseErrorMessage(error, TALENT_SUPABASE_START_HINT)}`,
      )

      featuredTalentCache = await loadSeedFeaturedTalents(limit)
      return featuredTalentCache
    }
  }

  try {
    const response = await api.get('/talents/featured', {
      params: { limit },
    })
    featuredTalentCache = prepareFeaturedTalentRoster(response.data).slice(0, limit)
    return featuredTalentCache
  } catch (error) {
    if (!LOCAL_BACKEND_FALLBACKS_ENABLED) {
      throw error
    }

    console.warn(
      `Falling back to the featured talent seed because the local talent API is unavailable. ${readApiErrorMessage(error, TALENT_API_START_HINT)}`,
    )

    featuredTalentCache = await loadSeedFeaturedTalents(limit)
    return featuredTalentCache
  }
}

export const getTalent = async (id) => {
  const resolvedTalentId = requireValidTalentId(id)
  const cachedTalent = getTalentFromCache(resolvedTalentId)

  if (SUPABASE_TALENTS_ENABLED) {
    try {
      const nextTalent = await fetchTalentFromSupabase(resolvedTalentId)

      if (!nextTalent) {
        throw new Error('That talent could not be found.')
      }

      const nextRoster =
        cachedTalent == null
          ? [...talentRosterCache, nextTalent]
          : talentRosterCache.map((talent) =>
              talent.id === resolvedTalentId ? nextTalent : talent,
            )

      syncTalentRosterCache(nextRoster)
      return getTalentFromCache(resolvedTalentId) ?? nextTalent
    } catch (error) {
      if (cachedTalent) {
        return cachedTalent
      }

      throw new Error(readSupabaseErrorMessage(error, 'We could not load that talent right now.'))
    }
  }

  try {
    const response = await api.get(`/talents/${resolvedTalentId}`)
    const nextTalentIndex = Math.max(getTalentIndex(resolvedTalentId), 0)
    const nextTalent = normalizeTalent(response.data, nextTalentIndex)
    const nextRoster =
      cachedTalent == null
        ? [...talentRosterCache, nextTalent]
        : talentRosterCache.map((talent) =>
            talent.id === resolvedTalentId ? nextTalent : talent,
          )

    syncTalentRosterCache(nextRoster)
    return getTalentFromCache(resolvedTalentId) ?? nextTalent
  } catch (error) {
    if (cachedTalent) {
      return cachedTalent
    }

    throw new Error(readApiErrorMessage(error, 'We could not load that talent right now.'))
  }
}

export const searchTalents = async (query) => {
  const allTalents = await getAllTalents()
  const normalizedQuery = trimText(query).toLowerCase()

  return allTalents.filter(
    (talent) =>
      talent.name.toLowerCase().includes(normalizedQuery) ||
      talent.category.toLowerCase().includes(normalizedQuery),
  )
}

export const filterByCategory = async (category) => {
  const allTalents = await getAllTalents()

  return category === 'All'
    ? allTalents
    : allTalents.filter(
        (talent) => talent.category === category || talent.subcategory?.includes(category),
      )
}

export const addTalent = async (talent) =>
  {
    const createdTalent = await persistMutation(async () => {
    const payload = buildTalentPayload({ id: talent.id ?? Date.now() }, talent, talentRosterCache.length)
    const response = await api.post('/talents', payload)
    const createdTalentId = Number(response.data?.id)

    return Number.isFinite(createdTalentId)
      ? getTalentFromCache(createdTalentId) ?? normalizeTalent(response.data, talentRosterCache.length)
      : normalizeTalent(response.data, talentRosterCache.length)
  })

    const syncedTalent = Number.isFinite(createdTalent?.id) ? getTalentFromCache(createdTalent.id) : null

    if (SUPABASE_TALENTS_ENABLED && !syncedTalent) {
      throw new Error(TALENT_LIVE_ROSTER_MISMATCH_MESSAGE)
    }

    return syncedTalent ?? createdTalent
  }

export const updateTalent = async (talentId, talent) => {
  const resolvedTalentId = requireValidTalentId(talentId)
  const currentTalent = talentRosterCache.find((candidate) => candidate.id === resolvedTalentId)

  if (!currentTalent) {
    throw new Error('We could not find that talent right now.')
  }

  const nextTalentIndex = Math.max(getTalentIndex(resolvedTalentId), 0)
  const payload = buildTalentPayload(currentTalent, talent, nextTalentIndex)

  return persistMutation(async () => {
    const response = await api.patch(`/talents/${resolvedTalentId}`, payload)
    return normalizeTalent(response.data, nextTalentIndex)
  })
}

export const deleteTalent = async (talentId) => {
  const resolvedTalentId = requireValidTalentId(talentId)
  const currentTalent = talentRosterCache.find((candidate) => candidate.id === resolvedTalentId)

  if (!currentTalent) {
    throw new Error('We could not find that talent right now.')
  }

  return persistMutation(async () => {
    const response = await api.delete(`/talents/${resolvedTalentId}`)
    return response.data ? normalizeTalent(response.data, Math.max(getTalentIndex(resolvedTalentId), 0)) : currentTalent
  })
}

const requireTalentForNestedMutation = async (talentId) => {
  const resolvedTalentId = requireValidTalentId(talentId)
  const currentTalent = talentRosterCache.find((candidate) => candidate.id === resolvedTalentId)

  if (!currentTalent) {
    throw new Error('We could not find that talent right now.')
  }

  return currentTalent
}

export const addExperienceToTalent = async (talentId, experience) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)

  return updateTalent(talentId, {
    services: [...currentTalent.services, experience],
  })
}

export const updateExperienceForTalent = async (talentId, serviceId, experience) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)
  const resolvedServiceId = trimText(serviceId)

  if (!resolvedServiceId) {
    throw new Error('Choose a valid experience before saving changes.')
  }

  if (!currentTalent.services.some((service) => service.id === resolvedServiceId)) {
    throw new Error('We could not find that experience right now.')
  }

  return updateTalent(talentId, {
    services: currentTalent.services.map((service) =>
      service.id === resolvedServiceId
        ? {
            ...service,
            ...experience,
            id: resolvedServiceId,
          }
        : service,
    ),
  })
}

export const deleteExperienceFromTalent = async (talentId, serviceId) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)
  const resolvedServiceId = trimText(serviceId)

  if (!resolvedServiceId) {
    throw new Error('Choose a valid experience before deleting it.')
  }

  if (!currentTalent.services.some((service) => service.id === resolvedServiceId)) {
    throw new Error('We could not find that experience right now.')
  }

  return updateTalent(talentId, {
    services: currentTalent.services.filter((service) => service.id !== resolvedServiceId),
  })
}

export const addShopItemToTalent = async (talentId, shopItem) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)

  return updateTalent(talentId, {
    shopItems: [...currentTalent.shopItems, shopItem],
  })
}

export const updateShopItemForTalent = async (talentId, shopItemId, shopItem) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)
  const resolvedShopItemId = trimText(shopItemId)

  if (!resolvedShopItemId) {
    throw new Error('Choose a valid shop item before saving changes.')
  }

  if (!currentTalent.shopItems.some((item) => item.id === resolvedShopItemId)) {
    throw new Error('We could not find that shop item right now.')
  }

  return updateTalent(talentId, {
    shopItems: currentTalent.shopItems.map((item) =>
      item.id === resolvedShopItemId
        ? {
            ...item,
            ...shopItem,
            id: resolvedShopItemId,
            sizes: Array.isArray(shopItem?.sizes) ? shopItem.sizes : item.sizes,
          }
        : item,
    ),
  })
}

export const deleteShopItemFromTalent = async (talentId, shopItemId) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)
  const resolvedShopItemId = trimText(shopItemId)

  if (!resolvedShopItemId) {
    throw new Error('Choose a valid shop item before deleting it.')
  }

  if (!currentTalent.shopItems.some((item) => item.id === resolvedShopItemId)) {
    throw new Error('We could not find that shop item right now.')
  }

  return updateTalent(talentId, {
    shopItems: currentTalent.shopItems.filter((item) => item.id !== resolvedShopItemId),
  })
}

export const addReviewToTalent = async (talentId, review) => {
  const currentTalent = await requireTalentForNestedMutation(talentId)
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
    currentTalent.reviews.some((existingReview) => existingReview.userId === normalizedUserId)
  ) {
    throw new Error('You already left a review for this talent.')
  }

  const nextReview = {
    ...review,
    userId: normalizedUserId,
    comment: trimmedComment,
    createdAt: review?.createdAt ?? new Date().toISOString(),
    verified: review?.verified ?? true,
    rating: normalizeReviewRating(review?.rating, 5),
  }

  return persistMutation(async () => {
    const response = await api.post(`/talents/${requireValidTalentId(talentId)}/reviews`, nextReview)
    return normalizeTalent(response.data, Math.max(getTalentIndex(talentId), 0))
  })
}

export const subscribeToTalentRoster = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getTalentRosterSnapshot())
  const handleStorage = (event) => {
    if (event.key === TALENT_ROSTER_SYNC_KEY) {
      refreshTalentRosterWithFallback().then(() => listener(getTalentRosterSnapshot()))
    }
  }

  window.addEventListener(TALENT_ROSTER_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(TALENT_ROSTER_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
  }
}
