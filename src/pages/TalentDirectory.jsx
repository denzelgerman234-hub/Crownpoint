import { motion } from 'framer-motion'
import PageWrapper from '../components/layout/PageWrapper'
import TalentSearchFilters from '../components/ui/TalentSearchFilters'
import TalentSummaryCard from '../components/ui/TalentSummaryCard'
import { useTalentFilters } from '../hooks/useTalentFilters'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { revealUp } from '../utils/motion'

const SEARCH_RESULTS_STEP = 12

const buildDirectoryHelperText = ({
  canShowResults,
  hasSearchIntent,
  hiddenResultCount,
  isQueryTooShort,
  isSearchPending,
  resultCount,
}) => {
  if (!hasSearchIntent) {
    return 'Search by name, location, category, or standout tag to begin.'
  }

  if (isSearchPending) {
    return 'Refining the shortlist...'
  }

  if (isQueryTooShort) {
    return 'Add one more letter or choose a category to continue.'
  }

  if (!canShowResults) {
    return 'Use the search field or category chips to narrow the directory.'
  }

  if (!resultCount) {
    return 'No talent matches the current search. Try a broader name, location, tag, or category.'
  }

  return hiddenResultCount
    ? `${resultCount} matches found. Refine the search if you want a shorter shortlist.`
    : `${resultCount} matches ready.`
}

export default function TalentDirectory() {
  const talentRoster = useTalentRoster()
  const {
    activeCategory,
    canShowResults,
    clearFilters,
    filteredTalents,
    hasSearchIntent,
    hiddenResultCount,
    isQueryTooShort,
    isSearchPending,
    resultCount,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
    showMoreResults,
  } = useTalentFilters(talentRoster, {
    requireSearch: true,
    visibleIncrement: SEARCH_RESULTS_STEP,
    visibleResults: SEARCH_RESULTS_STEP,
  })

  const helperText = buildDirectoryHelperText({
    canShowResults,
    hasSearchIntent,
    hiddenResultCount,
    isQueryTooShort,
    isSearchPending,
    resultCount,
  })

  return (
    <PageWrapper className="cp-page--directory">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Talent directory</span>
            <h1 className="cp-page-title">
              Find the right talent for the moment you have in <em>mind.</em>
            </h1>
            <p className="cp-page-intro">
              Search by name, location, category, or standout tag to surface the profiles that fit your request.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 24 }}>
        <div className="cp-container">
          <TalentSearchFilters
            activeCategory={activeCategory}
            helperText={helperText}
            onCategoryChange={setActiveCategory}
            onClear={clearFilters}
            onSearchChange={setSearchQuery}
            placeholder="Search by talent name, location, category, or standout tag"
            searchQuery={searchQuery}
          />

          {canShowResults && resultCount > 0 ? (
            <section className="cp-results-shell">
              <div className="cp-results-bar">
                <div className="cp-section-copy">
                  <span className="cp-eyebrow">Results</span>
                  <h2 className="section-title">
                    Search matched the right profiles for your <em>next request.</em>
                  </h2>
                </div>
                <div className="cp-results-meta">
                  <strong>{resultCount}</strong>
                  <span>matching talents</span>
                </div>
              </div>

              <div className="cp-card-grid">
                {filteredTalents.map((talent) => (
                  <div key={talent.id} className="cp-grid-card">
                    <TalentSummaryCard badgeLabel="Featured" talent={talent} />
                  </div>
                ))}
              </div>

              {hiddenResultCount > 0 ? (
                <div className="cp-results-actions">
                  <button className="cp-btn cp-btn--ghost" onClick={showMoreResults} type="button">
                    Load {Math.min(SEARCH_RESULTS_STEP, hiddenResultCount)} more results
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

        </div>
      </section>
    </PageWrapper>
  )
}
