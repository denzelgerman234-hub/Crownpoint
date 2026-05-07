import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildOptimizedAvatarSources } from '../shared/wikimediaImage.mjs'

const MIN_STARTING_PRICE = 350
const FEATURED_TALENT_LIMIT = 6
const rootDirectory = process.cwd()
const inputPath = path.resolve(rootDirectory, process.argv[2] ?? 'data/raw/queryCROWNPOINT.json')
const outputPath = path.resolve(rootDirectory, process.argv[3] ?? 'public/data/talents.catalog.json')
const featuredOutputPath = path.resolve(rootDirectory, 'public/data/talents.featured.json')
const featuredSeedPath = path.resolve(rootDirectory, 'src/data/talents.featured.seed.json')

const demonymLocationEntries = [
  ['American', 'United States'],
  ['British', 'United Kingdom'],
  ['English', 'England'],
  ['Scottish', 'Scotland'],
  ['Welsh', 'Wales'],
  ['Irish', 'Ireland'],
  ['Canadian', 'Canada'],
  ['Australian', 'Australia'],
  ['New Zealand', 'New Zealand'],
  ['French', 'France'],
  ['German', 'Germany'],
  ['Italian', 'Italy'],
  ['Spanish', 'Spain'],
  ['Portuguese', 'Portugal'],
  ['Brazilian', 'Brazil'],
  ['Mexican', 'Mexico'],
  ['Colombian', 'Colombia'],
  ['Puerto Rican', 'Puerto Rico'],
  ['Argentine', 'Argentina'],
  ['Argentinian', 'Argentina'],
  ['Chilean', 'Chile'],
  ['Venezuelan', 'Venezuela'],
  ['Peruvian', 'Peru'],
  ['South African', 'South Africa'],
  ['Nigerian', 'Nigeria'],
  ['Ghanaian', 'Ghana'],
  ['Kenyan', 'Kenya'],
  ['Beninese', 'Benin'],
  ['Somali', 'Somalia'],
  ['Lebanese', 'Lebanon'],
  ['Israeli', 'Israel'],
  ['Israeli-American', 'Israel / United States'],
  ['Iranian', 'Iran'],
  ['Indian', 'India'],
  ['Japanese', 'Japan'],
  ['Chinese', 'China'],
  ['Chinese-Singaporean', 'China / Singapore'],
  ['Singaporean', 'Singapore'],
  ['South Korean', 'South Korea'],
  ['Hong Kong', 'Hong Kong'],
  ['Malaysian', 'Malaysia'],
  ['Filipino', 'Philippines'],
  ['Indonesian', 'Indonesia'],
  ['Russian', 'Russia'],
  ['Ukrainian', 'Ukraine'],
  ['Belarusian', 'Belarus'],
  ['Polish', 'Poland'],
  ['Swedish', 'Sweden'],
  ['Norwegian', 'Norway'],
  ['Danish', 'Denmark'],
  ['Finnish', 'Finland'],
  ['Dutch', 'Netherlands'],
  ['Belgian', 'Belgium'],
  ['Austrian', 'Austria'],
  ['Greek', 'Greece'],
  ['Turkish', 'Turkey'],
  ['Serbian', 'Serbia'],
  ['Croatian', 'Croatia'],
  ['Romanian', 'Romania'],
  ['Bulgarian', 'Bulgaria'],
  ['Latvian', 'Latvia'],
  ['Icelandic', 'Iceland'],
]

const catalogRules = [
  {
    category: 'Politics & Leadership',
    keywords: ['prime minister', 'president', 'governor', 'politician', 'royal family'],
    subcategoryMap: {
      'prime minister': 'Prime Minister',
      president: 'President',
      governor: 'Governor',
      politician: 'Politician',
      'royal family': 'Royal Figure',
    },
  },
  {
    category: 'Sports',
    keywords: [
      'basketball player',
      'footballer',
      'tennis player',
      'racing driver',
      'professional wrestler',
      'wrestler',
      'boxer',
      'golfer',
      'athlete',
      'gymnast',
    ],
    subcategoryMap: {
      'basketball player': 'Basketball Player',
      footballer: 'Footballer',
      'tennis player': 'Tennis Player',
      'racing driver': 'Racing Driver',
      'professional wrestler': 'Wrestler',
      wrestler: 'Wrestler',
      boxer: 'Boxer',
      golfer: 'Golfer',
      athlete: 'Athlete',
      gymnast: 'Gymnast',
    },
  },
  {
    category: 'Comedy',
    keywords: ['stand-up comedian', 'comedian'],
    subcategoryMap: {
      'stand-up comedian': 'Stand-up Comedian',
      comedian: 'Comedian',
    },
  },
  {
    category: 'Music',
    keywords: [
      'singer-songwriter',
      'record producer',
      'songwriter',
      'composer',
      'rapper',
      'singer',
      'musician',
      'dj',
    ],
    subcategoryMap: {
      'singer-songwriter': 'Singer-songwriter',
      'record producer': 'Producer',
      songwriter: 'Songwriter',
      composer: 'Composer',
      rapper: 'Rapper',
      singer: 'Singer',
      musician: 'Musician',
      dj: 'DJ',
    },
  },
  {
    category: 'Creators',
    keywords: [
      'talk show host',
      'television host',
      'television presenter',
      'internet personality',
      'media personality',
      'podcaster',
      'streamer',
      'youtuber',
      'onlyfans model',
    ],
    subcategoryMap: {
      'talk show host': 'Host',
      'television host': 'Host',
      'television presenter': 'Presenter',
      'internet personality': 'Digital Creator',
      'media personality': 'Media Personality',
      podcaster: 'Podcaster',
      streamer: 'Streamer',
      youtuber: 'YouTuber',
      'onlyfans model': 'OnlyFans Creator',
    },
  },
  {
    category: 'Film & TV',
    keywords: [
      'voice actor',
      'screenwriter',
      'film producer',
      'television producer',
      'filmmaker',
      'director',
      'producer',
      'actor',
      'actress',
      'martial artist',
    ],
    subcategoryMap: {
      'voice actor': 'Voice Actor',
      screenwriter: 'Screenwriter',
      'film producer': 'Producer',
      'television producer': 'Producer',
      filmmaker: 'Filmmaker',
      director: 'Director',
      producer: 'Producer',
      actor: 'Actor',
      actress: 'Actress',
      'martial artist': 'Action Performer',
    },
  },
  {
    category: 'Business',
    keywords: ['businesswoman', 'businessman', 'entrepreneur', 'computer pioneer', 'inventor'],
    subcategoryMap: {
      businesswoman: 'Businesswoman',
      businessman: 'Businessman',
      entrepreneur: 'Entrepreneur',
      'computer pioneer': 'Technology Pioneer',
      inventor: 'Inventor',
    },
  },
  {
    category: 'Fashion & Modeling',
    keywords: ['fashion model', 'model'],
    subcategoryMap: {
      'fashion model': 'Fashion Model',
      model: 'Model',
    },
  },
  {
    category: 'Arts & Literature',
    keywords: ['journalist', 'screenwriter', 'author', 'writer', 'poet', 'designer', 'painter', 'artist'],
    subcategoryMap: {
      journalist: 'Journalist',
      screenwriter: 'Screenwriter',
      author: 'Author',
      writer: 'Writer',
      poet: 'Poet',
      designer: 'Designer',
      painter: 'Painter',
      artist: 'Artist',
    },
  },
]

const fallbackCategoryMap = {
  actor: ['Film & TV', 'Actor'],
  musician: ['Music', 'Musician'],
  comedian: ['Comedy', 'Comedian'],
  'OnlyFans model': ['Creators', 'OnlyFans Creator'],
}

const categoryStartingPrice = {
  Music: 900,
  'Film & TV': 800,
  Sports: 850,
  Comedy: 650,
  Creators: 450,
  'Politics & Leadership': 1200,
  Business: 1100,
  'Fashion & Modeling': 700,
  'Arts & Literature': 600,
  'Public Figures': 700,
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const cleanText = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()

const buildAmazonMerchUrl = (name) => {
  const query = cleanText(name)

  if (!query) {
    return ''
  }

  return `https://www.amazon.com/s?${new URLSearchParams({ k: `${query} merch` }).toString()}`
}

const splitCommaList = (value) =>
  cleanText(value)
    .split(',')
    .map((entry) => cleanText(entry))
    .filter(Boolean)

const extractWikidataId = (value) => cleanText(value).match(/Q\d+/i)?.[0] ?? ''

const uniqueValues = (values = []) => {
  const results = []
  const seen = new Set()

  values.forEach((value) => {
    const normalizedValue = cleanText(value)

    if (!normalizedValue) {
      return
    }

    const lookupKey = normalizedValue.toLowerCase()

    if (!seen.has(lookupKey)) {
      seen.add(lookupKey)
      results.push(normalizedValue)
    }
  })

  return results
}

const chooseBestDisplayName = (names = []) => {
  const scoreName = (name) => {
    const normalizedName = cleanText(name)

    if (!normalizedName) {
      return Number.NEGATIVE_INFINITY
    }

    const characters = [...normalizedName]
    const latinCount = characters.filter((character) => /\p{Script=Latin}/u.test(character)).length
    const letterCount = characters.filter((character) => /\p{L}/u.test(character)).length
    const readableCount = characters.filter((character) => /[\p{L}\p{N}\s.'&-]/u.test(character)).length
    const wordCount = normalizedName.split(/\s+/).length
    const punctuationPenalty = characters.length - readableCount

    return (
      latinCount * 3 +
      letterCount +
      (wordCount >= 2 && wordCount <= 4 ? 12 : 0) +
      Math.min(normalizedName.length, 36) -
      punctuationPenalty * 4
    )
  }

  return uniqueValues(names).sort((left, right) => scoreName(right) - scoreName(left))[0] ?? ''
}

const extractLocation = (bio) => {
  const intro = cleanText(bio).split(/[,(]/)[0]
  const locations = []

  demonymLocationEntries.forEach(([demonym, label]) => {
    if (new RegExp(`\\b${escapeRegExp(demonym)}\\b`, 'i').test(intro)) {
      locations.push(label)
    }
  })

  return uniqueValues(locations).join(' / ')
}

const deriveClassification = (bio, categories) => {
  const normalizedBio = cleanText(bio).toLowerCase()

  for (const rule of catalogRules) {
    for (const keyword of rule.keywords) {
      if (normalizedBio.includes(keyword)) {
        return {
          category: rule.category,
          subcategory: rule.subcategoryMap[keyword] ?? keyword,
        }
      }
    }
  }

  for (const category of categories) {
    if (fallbackCategoryMap[category]) {
      const [mappedCategory, mappedSubcategory] = fallbackCategoryMap[category]
      return { category: mappedCategory, subcategory: mappedSubcategory }
    }
  }

  return {
    category: 'Public Figures',
    subcategory: 'Notable Figure',
  }
}

const formatTag = (value) =>
  cleanText(value)
    .replace(/\b\w/g, (character) => character.toUpperCase())

const deriveResponseTime = (popularityScore) => {
  const score = Number(popularityScore) || 0

  if (score >= 150) {
    return '72h'
  }

  if (score >= 80) {
    return '48h'
  }

  if (score >= 35) {
    return '24h'
  }

  return '12h'
}

const deriveStartingPrice = (category, popularityScore) => {
  const score = Number(popularityScore) || 0
  const categoryFloor = categoryStartingPrice[category] ?? categoryStartingPrice['Public Figures']
  const popularityAdjustment =
    score >= 250
      ? 2000
      : score >= 175
        ? 1600
        : score >= 125
          ? 1250
          : score >= 80
            ? 950
            : score >= 50
              ? 700
              : score >= 25
                ? 500
                : 350

  return Math.max(
    MIN_STARTING_PRICE,
    Math.round((categoryFloor + popularityAdjustment) / 50) * 50,
  )
}

const buildTags = ({ category, subcategory, sourceCategories, location, aliases }) =>
  uniqueValues([
    category,
    subcategory,
    ...sourceCategories.map((sourceCategory) => formatTag(sourceCategory)),
    location,
    aliases.length > 0 ? 'Known Aliases' : '',
  ]).slice(0, 6)

const buildCatalogRecord = (records, index) => {
  const canonicalRecord =
    [...records]
      .sort((left, right) => cleanText(right.bio).length - cleanText(left.bio).length)[0] ?? {}
  const wikidataId = extractWikidataId(canonicalRecord.item)
  const nameOptions = records.map((record) => record.fullName)
  const name = chooseBestDisplayName(nameOptions)
  const aliases = uniqueValues(nameOptions).filter((alias) => alias.toLowerCase() !== name.toLowerCase())
  const bio = cleanText(canonicalRecord.bio)
  const sourceCategories = uniqueValues(records.flatMap((record) => splitCommaList(record.categories)))
  const { category, subcategory } = deriveClassification(bio, sourceCategories)
  const location = extractLocation(bio)
  const popularityScore = Number(canonicalRecord.popularityScore) || 0
  const avatarSources = buildOptimizedAvatarSources(canonicalRecord.image)

  return {
    id: index + 1,
    wikidataId,
    sourceItem: cleanText(canonicalRecord.item),
    name,
    aliases,
    category,
    subcategory,
    bio,
    avatarUrl: avatarSources.avatarOriginalUrl,
    avatarOriginalUrl: avatarSources.avatarOriginalUrl,
    avatarThumbnailUrl: avatarSources.avatarThumbnailUrl,
    avatarSrcSet: avatarSources.avatarSrcSet,
    shopLink: buildAmazonMerchUrl(name),
    location,
    languages: [],
    tags: buildTags({ category, subcategory, sourceCategories, location, aliases }),
    popularityScore,
    responseTime: deriveResponseTime(popularityScore),
    startingPrice: deriveStartingPrice(category, popularityScore),
    available: true,
    verified: true,
    shopItems: [],
    reviews: [],
  }
}

const sourceBuffer = await readFile(inputPath)
const sourceRows = JSON.parse(sourceBuffer.toString('utf8'))

if (!Array.isArray(sourceRows)) {
  throw new Error('Expected the source query file to contain a top-level array.')
}

const groupedRows = new Map()

sourceRows.forEach((record) => {
  const entityKey = extractWikidataId(record?.item) || cleanText(record?.fullName)

  if (!entityKey) {
    return
  }

  const group = groupedRows.get(entityKey) ?? []
  group.push(record)
  groupedRows.set(entityKey, group)
})

const catalogRecords = [...groupedRows.entries()]
  .sort((left, right) => {
    const leftScore = Number(left[1][0]?.popularityScore) || 0
    const rightScore = Number(right[1][0]?.popularityScore) || 0
    return rightScore - leftScore
  })
  .map(([, records], index) => buildCatalogRecord(records, index))
const featuredRecords = catalogRecords.slice(0, FEATURED_TALENT_LIMIT)

await Promise.all([
  mkdir(path.dirname(outputPath), { recursive: true }),
  mkdir(path.dirname(featuredOutputPath), { recursive: true }),
  mkdir(path.dirname(featuredSeedPath), { recursive: true }),
])

await Promise.all([
  writeFile(outputPath, `${JSON.stringify(catalogRecords, null, 2)}\n`, 'utf8'),
  writeFile(featuredOutputPath, `${JSON.stringify(featuredRecords, null, 2)}\n`, 'utf8'),
  writeFile(featuredSeedPath, `${JSON.stringify(featuredRecords, null, 2)}\n`, 'utf8'),
])

const duplicateCount = sourceRows.length - catalogRecords.length

console.log(
  JSON.stringify(
    {
      inputPath,
      outputPath,
      featuredOutputPath,
      featuredSeedPath,
      sourceCount: sourceRows.length,
      uniqueCount: catalogRecords.length,
      removedDuplicates: duplicateCount,
    },
    null,
    2,
  ),
)
