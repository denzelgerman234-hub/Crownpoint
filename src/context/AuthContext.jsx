import { createContext, useEffect, useState } from 'react'
import {
  AUTH_USES_SUPABASE,
  clearCurrentSession,
  getCurrentUser,
  hydrateCurrentUser,
  setCurrentSession,
  subscribeToUserUpdates,
} from '../services/authService'
import { ROLES } from '../utils/constants'
import {
  canUserMessageTalent,
  getCurrentPlan,
  getCurrentPlanBillingCycle,
  getBillingCycleLabel,
  getPlanLabel,
  getUnlockedTalentIds,
  hasActiveMembership,
} from '../utils/memberships'

export const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getCurrentUser())
  const [loading, setLoading] = useState(AUTH_USES_SUPABASE)

  useEffect(() => {
    let isMounted = true
    const unsubscribe = subscribeToUserUpdates((nextUser) => {
      if (!isMounted) {
        return
      }

      setUser(nextUser)
      setLoading(false)
    })

    hydrateCurrentUser()
      .catch(() => null)
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const login = (userData, token) => {
    setCurrentSession(userData, token)
    setUser(userData)
  }

  const logout = () => {
    clearCurrentSession()
    setUser(null)
  }

  const currentPlan = getCurrentPlan(user)
  const currentPlanLabel = getPlanLabel(currentPlan)
  const currentPlanBillingCycle = getCurrentPlanBillingCycle(user)
  const currentPlanBillingCycleLabel = getBillingCycleLabel(currentPlanBillingCycle)
  const hasPlan = hasActiveMembership(user)
  const unlockedTalentIds = getUnlockedTalentIds(user)
  const isAdmin = user?.role === ROLES.ADMIN
  const isTalent = user?.role === ROLES.TALENT
  const isFan = user?.role === ROLES.FAN

  const value = {
    user,
    login,
    logout,
    loading,
    isAdmin,
    isTalent,
    isFan,
    currentPlan,
    currentPlanLabel,
    currentPlanBillingCycle,
    currentPlanBillingCycleLabel,
    hasPlan,
    unlockedTalentIds,
    canMessage: (talentId) => canUserMessageTalent(user, talentId),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
