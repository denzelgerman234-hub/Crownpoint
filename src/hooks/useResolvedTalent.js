import { useEffect, useState } from 'react'
import {
  getTalent,
  getTalentSnapshotById,
  subscribeToTalentRoster,
} from '../services/talentService'

const buildInitialState = (talentId) => {
  const resolvedTalentId = Number(talentId)
  const cachedTalent = Number.isFinite(resolvedTalentId) ? getTalentSnapshotById(resolvedTalentId) : null

  return {
    error: null,
    isLoading: !cachedTalent,
    talent: cachedTalent,
  }
}

export const useResolvedTalent = (talentId) => {
  const [state, setState] = useState(() => buildInitialState(talentId))

  useEffect(() => {
    const resolvedTalentId = Number(talentId)

    if (!Number.isFinite(resolvedTalentId)) {
      setState({
        error: new Error('That talent profile could not be found.'),
        isLoading: false,
        talent: null,
      })
      return () => {}
    }

    let isActive = true
    const cachedTalent = getTalentSnapshotById(resolvedTalentId)

    setState({
      error: null,
      isLoading: !cachedTalent,
      talent: cachedTalent,
    })

    const syncTalent = async () => {
      try {
        const nextTalent = await getTalent(resolvedTalentId)

        if (!isActive) {
          return
        }

        setState({
          error: null,
          isLoading: false,
          talent: nextTalent,
        })
      } catch (error) {
        if (!isActive) {
          return
        }

        setState((current) => ({
          error,
          isLoading: false,
          talent: current.talent,
        }))
      }
    }

    syncTalent()

    const unsubscribe = subscribeToTalentRoster(() => {
      if (!isActive) {
        return
      }

      const nextCachedTalent = getTalentSnapshotById(resolvedTalentId)

      if (nextCachedTalent) {
        setState(() => ({
          error: null,
          isLoading: false,
          talent: nextCachedTalent,
        }))
      }
    })

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [talentId])

  return state
}
