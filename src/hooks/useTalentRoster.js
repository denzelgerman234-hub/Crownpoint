import { useEffect, useState } from 'react'
import {
  getAllTalents,
  getTalentRosterSnapshot,
  subscribeToTalentRoster,
} from '../services/talentService'

export const useTalentRoster = () => {
  const [talentRoster, setTalentRoster] = useState(() => getTalentRosterSnapshot())

  useEffect(() => {
    let isMounted = true

    const syncTalentRoster = async () => {
      try {
        const nextTalentRoster = await getAllTalents()

        if (!isMounted) {
          return
        }

        setTalentRoster(nextTalentRoster)
      } catch (error) {
        console.warn(error)
      }
    }

    syncTalentRoster()

    const unsubscribe = subscribeToTalentRoster(syncTalentRoster)

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return talentRoster
}
