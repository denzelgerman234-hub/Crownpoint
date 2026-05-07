import { useEffect, useState } from 'react'
import {
  getFeaturedTalents,
  getFeaturedTalentsSnapshot,
  subscribeToTalentRoster,
} from '../services/talentService'

export const useFeaturedTalents = (limit = 6) => {
  const [featuredTalents, setFeaturedTalents] = useState(() => getFeaturedTalentsSnapshot(limit))

  useEffect(() => {
    let isMounted = true

    const syncFeaturedTalents = async () => {
      try {
        const nextFeaturedTalents = await getFeaturedTalents(limit)

        if (!isMounted) {
          return
        }

        setFeaturedTalents(nextFeaturedTalents)
      } catch (error) {
        console.warn(error)
      }
    }

    syncFeaturedTalents()

    const unsubscribe = subscribeToTalentRoster(() => {
      if (!isMounted) {
        return
      }

      setFeaturedTalents(getFeaturedTalentsSnapshot(limit))
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [limit])

  return featuredTalents
}
