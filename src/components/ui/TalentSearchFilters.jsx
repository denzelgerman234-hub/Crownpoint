import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { categories } from '../../data/categories'

export default function TalentSearchFilters({
  activeCategory,
  helperText = '',
  onCategoryChange,
  onClear,
  onSearchChange,
  panelClassName = 'cp-filter-panel cp-surface',
  placeholder = 'Search talents, tags, categories, or locations',
  searchQuery,
}) {
  const [draftQuery, setDraftQuery] = useState(searchQuery)
  const hasActiveFilters = draftQuery.trim() || activeCategory !== 'All'

  useEffect(() => {
    setDraftQuery(searchQuery)
  }, [searchQuery])

  const handleSearchChange = (event) => {
    const nextQuery = event.target.value
    setDraftQuery(nextQuery)
    onSearchChange(nextQuery)
  }

  const resetFilters = () => {
    setDraftQuery('')
    onClear?.()
  }

  return (
    <div className={panelClassName}>
      <div className="cp-search">
        <Search size={18} />
        <input
          autoComplete="off"
          inputMode="search"
          onChange={handleSearchChange}
          placeholder={placeholder}
          type="search"
          value={draftQuery}
        />
      </div>

      <div className="cp-search-meta">
        <p className="cp-search-helper">{helperText}</p>
        {hasActiveFilters && onClear ? (
          <button className="cp-search-clear" onClick={resetFilters} type="button">
            Reset search
          </button>
        ) : null}
      </div>

      <div className="cp-filter-row">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`cp-filter-chip${activeCategory === category.label ? ' is-active' : ''}`}
            onClick={() => onCategoryChange(category.label)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  )
}
