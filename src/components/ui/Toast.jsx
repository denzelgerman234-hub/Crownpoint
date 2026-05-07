import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheckBig, Info, X } from 'lucide-react'
import { useToast } from '../../hooks/useToast'

const iconByType = {
  success: CircleCheckBig,
  info: Info,
  warning: CircleAlert,
  error: CircleAlert,
}

export default function Toast() {
  const { toasts, removeToast } = useToast()

  return (
    <div aria-live="polite" className="cp-toast-stack">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconByType[toast.type] ?? Info

          return (
            <motion.div
              key={toast.id}
              animate={{ opacity: 1, x: 0 }}
              className={`cp-toast cp-toast--${toast.type}`}
              exit={{ opacity: 0, x: 24 }}
              initial={{ opacity: 0, x: 24 }}
              layout
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="cp-toast-icon">
                <Icon size={16} />
              </span>
              <p>{toast.message}</p>
              <button
                aria-label="Dismiss notification"
                className="cp-toast-close"
                onClick={() => removeToast(toast.id)}
                type="button"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
