import { createContext, useCallback, useEffect, useRef, useState } from 'react'

export const ToastContext = createContext(null)

const TOAST_LIFETIME_MS = 3500

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const nextToastIdRef = useRef(0)
  const timeoutHandlesRef = useRef(new Map())

  const clearToastTimeout = useCallback((id) => {
    const timeoutHandle = timeoutHandlesRef.current.get(id)

    if (!timeoutHandle) {
      return
    }

    clearTimeout(timeoutHandle)
    timeoutHandlesRef.current.delete(id)
  }, [])

  const removeToast = useCallback((id) => {
    clearToastTimeout(id)
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [clearToastTimeout])

  const showToast = useCallback((message, type = 'success') => {
    const normalizedMessage = String(message ?? '').trim()

    if (!normalizedMessage) {
      return null
    }

    const nextToastId = `toast-${Date.now()}-${nextToastIdRef.current}`
    nextToastIdRef.current += 1

    let activeToastId = nextToastId
    setToasts((prev) => {
      const existingToast = prev.find(
        (toast) => toast.message === normalizedMessage && toast.type === type,
      )

      if (existingToast) {
        activeToastId = existingToast.id
        return prev
      }

      return [...prev, { id: nextToastId, message: normalizedMessage, type }]
    })

    clearToastTimeout(activeToastId)
    timeoutHandlesRef.current.set(
      activeToastId,
      setTimeout(() => {
        timeoutHandlesRef.current.delete(activeToastId)
        setToasts((prev) => prev.filter((toast) => toast.id !== activeToastId))
      }, TOAST_LIFETIME_MS),
    )

    return activeToastId
  }, [clearToastTimeout])

  useEffect(
    () => () => {
      timeoutHandlesRef.current.forEach((timeoutHandle) => clearTimeout(timeoutHandle))
      timeoutHandlesRef.current.clear()
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}
