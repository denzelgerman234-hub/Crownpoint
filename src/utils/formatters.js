import { formatUsdAmount } from './currency'

export const formatCurrency = (amount, currency = undefined, options = {}) =>
  formatUsdAmount(amount, currency, options)

export const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

export const timeAgo = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export const formatCountdown = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

export const truncate = (str, maxLength = 80) =>
  str?.length > maxLength ? `${str.slice(0, maxLength)}...` : str

export const formatOrderRef = (ref) => `REF: #${ref}`

export const maskWallet = (address) =>
  address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ''

const formatSizeValue = (value, unit) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`

export const formatFileSize = (bytes) => {
  const normalizedBytes = Number(bytes ?? 0) || 0

  if (normalizedBytes < 1_000) {
    return `${normalizedBytes} B`
  }

  if (normalizedBytes < 1_000_000) {
    return formatSizeValue(normalizedBytes / 1_000, 'KB')
  }

  return formatSizeValue(normalizedBytes / 1_000_000, 'MB')
}
