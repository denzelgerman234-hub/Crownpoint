import { startTransition, useDeferredValue, useMemo, useState } from 'react'

const DEFAULT_MIN_QUERY_LENGTH = 2
const DEFAULT_VISIBLE_RESULTS = 18

const normalizeSearchQuery = (value = '') => value.trim().toLowerCase()

const buildTalentSearchHaystack = (talent = {}) =>
  [
    talent.name,
    talent.category,
    talent.subcategory,
    talent.location,
    ...(talent.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()

const buildSearchIndex = (talents = []) =>
  talents.map((talent) => ({
    talent,
    haystack: buildTalentSearchHaystack(talent),
  }))

const matchesCategory = (talent, activeCategory) =>
  activeCategory === 'All' ||
  talent.category === activeCategory ||
  talent.subcategory?.includes(activeCategory)

export const matchesTalentFilters = (talent, activeCategory, query) => {
  const normalizedQuery = normalizeSearchQuery(query)

  return (
    matchesCategory(talent, activeCategory) &&
    (!normalizedQuery || buildTalentSearchHaystack(talent).includes(normalizedQuery))
  )
}

export const useTalentFilters = (
  talents = [],
  {
    requireSearch = false,
    minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
    visibleResults = DEFAULT_VISIBLE_RESULTS,
    visibleIncrement = DEFAULT_VISIBLE_RESULTS,
  } = {},
) => {
  const [activeCategory, setActiveCategoryState] = useState('All')
  const [searchQuery, setSearchQueryState] = useState('')
  const [additionalVisibleCount, setAdditionalVisibleCount] = useState(0)
  const deferredSearch = useDeferredValue(searchQuery)
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery)
  const normalizedDeferredSearch = normalizeSearchQuery(deferredSearch)
  const searchIndex = useMemo(() => buildSearchIndex(talents), [talents])
  const hasCategoryFilter = activeCategory !== 'All'
  const hasTypedSearch = normalizedSearchQuery.length > 0
  const hasUsableQuery = normalizedDeferredSearch.length >= minQueryLength
  const hasSearchIntent = hasTypedSearch || hasCategoryFilter
  const isQueryTooShort = hasTypedSearch && !hasUsableQuery && !hasCategoryFilter
  const canShowResults = requireSearch ? hasCategoryFilter || hasUsableQuery : true
  const isSearchPending = normalizedSearchQuery !== normalizedDeferredSearch

  const visibleCount = visibleResults + additionalVisibleCount

  const allMatchingTalents = useMemo(() => {
    if (!canShowResults) {
      return []
    }

    return searchIndex
      .filter(({ talent, haystack }) => {
        if (!matchesCategory(talent, activeCategory)) {
          return false
        }

        return !normalizedDeferredSearch || haystack.includes(normalizedDeferredSearch)
      })
      .map(({ talent }) => talent)
  }, [activeCategory, canShowResults, normalizedDeferredSearch, searchIndex])

  const filteredTalents = useMemo(
    () => allMatchingTalents.slice(0, visibleCount),
    [allMatchingTalents, visibleCount],
  )

  const setSearchQuery = (value) => {
    startTransition(() => {
      setSearchQueryState(value)
      setAdditionalVisibleCount(0)
    })
  }

  const setActiveCategory = (nextCategory) => {
    startTransition(() => {
      setActiveCategoryState(nextCategory)
      setAdditionalVisibleCount(0)
    })
  }

  const clearFilters = () => {
    startTransition(() => {
      setSearchQueryState('')
      setActiveCategoryState('All')
      setAdditionalVisibleCount(0)
    })
  }

  const showMoreResults = () => {
    setAdditionalVisibleCount((current) => current + visibleIncrement)
  }

  return {
    activeCategory,
    allMatchingTalents,
    canShowResults,
    clearFilters,
    filteredTalents,
    hasSearchIntent,
    hasTypedSearch,
    hasUsableQuery,
    hiddenResultCount: Math.max(allMatchingTalents.length - filteredTalents.length, 0),
    isQueryTooShort,
    isSearchPending,
    resultCount: allMatchingTalents.length,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
    showMoreResults,
  }
}
