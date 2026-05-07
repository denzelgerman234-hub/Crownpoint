import { useState, useEffect } from 'react'
import { getUserOrders } from '../services/orderService'

export const useOrders = (userId) => {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!userId) return
    const fetch = async () => {
      setLoading(true)
      try {
        const data = await getUserOrders(userId)
        setOrders(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [userId])

  return { orders, loading, error, setOrders }
}
