import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const catalogPath = path.resolve(projectRoot, 'public/data/talents.catalog.json')

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL in the environment.')
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in the environment.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const toTextArray = (value) => (
  Array.isArray(value)
    ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : []
)

const toJson = (value, fallback) => {
  if (value == null) {
    return fallback
  }

  return value
}

const mapTalentRecord = (talent = {}) => ({
  id: toNumber(talent.id),
  wikidata_id: String(talent.wikidataId ?? '').trim() || null,
  source_item: String(talent.sourceItem ?? '').trim() || null,
  name: String(talent.name ?? '').trim(),
  aliases: toTextArray(talent.aliases),
  category: String(talent.category ?? '').trim(),
  subcategory: String(talent.subcategory ?? '').trim(),
  initials: String(talent.initials ?? '').trim(),
  bio: String(talent.bio ?? '').trim(),
  avatar_url: String(talent.avatarUrl ?? '').trim(),
  avatar_original_url: String(talent.avatarOriginalUrl ?? '').trim(),
  avatar_thumbnail_url: String(talent.avatarThumbnailUrl ?? '').trim(),
  avatar_src_set: String(talent.avatarSrcSet ?? '').trim(),
  gradient: String(talent.gradient ?? '').trim(),
  location: String(talent.location ?? '').trim(),
  languages: toTextArray(talent.languages),
  tags: toTextArray(talent.tags),
  popularity_score: toNumber(talent.popularityScore, 0),
  response_time: String(talent.responseTime ?? '72h').trim() || '72h',
  starting_price: toNumber(talent.startingPrice, 0),
  available: talent.available ?? true,
  verified: talent.verified ?? true,
  shop_link: String(talent.shopLink ?? '').trim(),
  services: toJson(talent.services, []),
  event_booking: toJson(talent.eventBooking, {}),
  shop_items: toJson(talent.shopItems, []),
  reviews: toJson(talent.reviews, []),
  rating: toNumber(talent.rating, 5),
  review_count: toNumber(talent.reviewCount, Array.isArray(talent.reviews) ? talent.reviews.length : 0),
  completed_bookings: toNumber(talent.completedBookings, 0),
})

const chunk = (items, size) => {
  const groups = []

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }

  return groups
}

const rawCatalog = await readFile(catalogPath, 'utf8')
const catalogRecords = JSON.parse(rawCatalog)

if (!Array.isArray(catalogRecords)) {
  throw new Error('Talent catalog seed must be a top-level array.')
}

const payload = catalogRecords.map(mapTalentRecord).filter((talent) => talent.id && talent.name)
const groups = chunk(payload, 200)

for (const [index, group] of groups.entries()) {
  const { error } = await supabase.from('talents').upsert(group, { onConflict: 'id' })

  if (error) {
    throw new Error(`Supabase upsert failed on batch ${index + 1}: ${error.message}`)
  }

  console.log(`Seeded batch ${index + 1} of ${groups.length} (${group.length} talents).`)
}

console.log(`Talent seed complete. Upserted ${payload.length} records from ${catalogPath}.`)
