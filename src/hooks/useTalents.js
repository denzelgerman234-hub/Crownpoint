import { useState, useEffect } from 'react'
import { filterByCategory, searchTalents } from '../services/talentService'

export const useTalents = (initialCategory = 'All') => {
  const [talents, setTalents]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [category, setCategory]     = useState(initialCategory)
  const [searchQuery, setSearch]    = useState('')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const data = searchQuery
          ? await searchTalents(searchQuery)
          : await filterByCategory(category)
        setTalents(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [category, searchQuery])

  return { talents, loading, error, category, setCategory, searchQuery, setSearch }
}
