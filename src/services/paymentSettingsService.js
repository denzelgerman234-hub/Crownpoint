import { createDefaultPaymentSettingsByCurrency } from '../data/paymentOptions'
import api from '../utils/api'
import {
  BACKEND_REQUIRED_MESSAGE,
  LOCAL_BACKEND_FALLBACKS_ENABLED,
  SUPABASE_AUTH_ENABLED,
} from '../utils/backendConfig'
import { PAYMENT_METHODS } from '../utils/constants'
import { supportedCurrencies } from '../utils/currency'

const PAYMENT_SETTINGS_KEY = 'crownpoint_payment_settings'
const PAYMENT_SETTINGS_META_KEY = 'crownpoint_payment_settings_meta'
const PAYMENT_SETTINGS_UPDATED_EVENT = 'crownpoint:payment-settings-updated'
const PAYMENT_SETTINGS_API_START_HINT =
  'Start `npm run api` so payment settings can load from the backend API.'
const PAYMENT_SETTINGS_BACKEND_ENABLED = SUPABASE_AUTH_ENABLED
const PAYMENT_SETTINGS_LOCAL_FALLBACKS_ENABLED = LOCAL_BACKEND_FALLBACKS_ENABLED

let hasWarnedPaymentSettingsBackendUnavailable = false
let hasScheduledInitialPaymentSettingsLoad = false
let activePaymentSettingsRefresh = null

const trimText = (value) => String(value ?? '').trim()

const slugify = (value) => {
  const normalized = trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'item'
}

const cloneDefaults = () => createDefaultPaymentSettingsByCurrency()

const createDefaultPaymentSettingsMetaByCurrency = () =>
  Object.keys(supportedCurrencies).reduce((metaByCurrency, currencyCode) => {
    metaByCurrency[currencyCode] = {
      updatedAt: null,
      updatedBy: '',
      revision: 0,
    }

    return metaByCurrency
  }, {})

const readApiErrorMessage = (error, fallbackMessage) =>
  String(error?.response?.data?.message ?? error?.message ?? fallbackMessage)

const warnPaymentSettingsBackendUnavailable = (error) => {
  if (hasWarnedPaymentSettingsBackendUnavailable) {
    return
  }

  hasWarnedPaymentSettingsBackendUnavailable = true
  console.warn(
    `Falling back to browser-cached payment settings because the backend API is unavailable. ${readApiErrorMessage(error, PAYMENT_SETTINGS_API_START_HINT)}`,
  )
}

const shouldFallbackToLocalPaymentSettings = (error) =>
  !error?.response || Number(error.response.status) >= 500

const normalizeTimestamp = (value) => {
  const timestamp = trimText(value)
  return timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? timestamp : null
}

const normalizeRevision = (value) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0
}

const normalizeCurrencyMeta = (meta = {}) => ({
  updatedAt: normalizeTimestamp(meta?.updatedAt),
  updatedBy: trimText(meta?.updatedBy),
  revision: normalizeRevision(meta?.revision),
})

const normalizeBankDetails = (details = []) =>
  details
    .map((detail, index) => {
      const label = trimText(detail?.label)
      const value = trimText(detail?.value)

      return {
        id: trimText(detail?.id) || `bank-${slugify(label || `field-${index + 1}`)}`,
        label,
        value,
      }
    })
    .filter((detail) => detail.label || detail.value)
    .map((detail, index) => ({
      ...detail,
      label: detail.label || `Field ${index + 1}`,
    }))

const normalizeGiftCards = (giftCards = []) =>
  giftCards
    .map((card, index) => {
      const label = trimText(card?.label)

      return {
        id: trimText(card?.id) || `gift-card-${slugify(label || `card-${index + 1}`)}`,
        label,
      }
    })
    .filter((card) => card.label)

const normalizeCryptoAssets = (cryptoAssets = []) =>
  cryptoAssets
    .map((asset, index) => {
      const label = trimText(asset?.label)
      const networks = Array.isArray(asset?.networks)
        ? asset.networks
            .map((network, networkIndex) => {
              const networkLabel = trimText(network?.label)
              const wallet = trimText(network?.wallet)

              return {
                id:
                  trimText(network?.id) ||
                  `network-${slugify(networkLabel || `${label || 'asset'}-${networkIndex + 1}`)}`,
                label: networkLabel,
                wallet,
              }
            })
            .filter((network) => network.label || network.wallet)
            .map((network, networkIndex) => ({
              ...network,
              label: network.label || `Network ${networkIndex + 1}`,
            }))
        : []

      return {
        id: trimText(asset?.id) || `asset-${slugify(label || `asset-${index + 1}`)}`,
        label,
        networks,
      }
    })
    .filter((asset) => asset.label || asset.networks.length)
    .map((asset, index) => ({
      ...asset,
      label: asset.label || `Asset ${index + 1}`,
    }))

const normalizeCurrencyCode = (currencyCode) =>
  Object.prototype.hasOwnProperty.call(supportedCurrencies, currencyCode) ? currencyCode : 'USD'

const normalizeCurrencySettings = (settings = {}, currencyCode) => {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode)
  const defaults = cloneDefaults()[normalizedCurrencyCode]
  const bankSettings = settings?.bank ?? {}

  return {
    currencyCode: normalizedCurrencyCode,
    bank: {
      referencePrefix: trimText(bankSettings.referencePrefix) || defaults.bank.referencePrefix,
      instructions: trimText(bankSettings.instructions) || defaults.bank.instructions,
      details: Array.isArray(bankSettings.details)
        ? normalizeBankDetails(bankSettings.details)
        : normalizeBankDetails(defaults.bank.details),
    },
    giftCards: Array.isArray(settings?.giftCards)
      ? normalizeGiftCards(settings.giftCards)
      : normalizeGiftCards(defaults.giftCards),
    cryptoAssets: Array.isArray(settings?.cryptoAssets)
      ? normalizeCryptoAssets(settings.cryptoAssets)
      : normalizeCryptoAssets(defaults.cryptoAssets),
  }
}

const emitPaymentSettingsUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PAYMENT_SETTINGS_UPDATED_EVENT))
  }
}

const writeAllPaymentSettingsMeta = (metaByCurrency) => {
  const normalizedMeta = Object.keys(supportedCurrencies).reduce((nextMeta, currencyCode) => {
    nextMeta[currencyCode] = normalizeCurrencyMeta(metaByCurrency[currencyCode])
    return nextMeta
  }, {})

  if (typeof window !== 'undefined') {
    localStorage.setItem(PAYMENT_SETTINGS_META_KEY, JSON.stringify(normalizedMeta))
  }

  return normalizedMeta
}

const readAllPaymentSettingsMeta = () => {
  const defaults = createDefaultPaymentSettingsMetaByCurrency()

  if (typeof window === 'undefined') {
    return defaults
  }

  const storedMeta = localStorage.getItem(PAYMENT_SETTINGS_META_KEY)

  if (!storedMeta) {
    return writeAllPaymentSettingsMeta(defaults)
  }

  try {
    const parsedMeta = JSON.parse(storedMeta)
    return writeAllPaymentSettingsMeta(
      Object.keys(supportedCurrencies).reduce((nextMeta, currencyCode) => {
        nextMeta[currencyCode] = normalizeCurrencyMeta(parsedMeta?.[currencyCode])
        return nextMeta
      }, {}),
    )
  } catch {
    return writeAllPaymentSettingsMeta(defaults)
  }
}

const writeAllPaymentSettings = (settingsByCurrency) => {
  const normalizedSettings = Object.keys(supportedCurrencies).reduce((nextSettings, currencyCode) => {
    nextSettings[currencyCode] = normalizeCurrencySettings(
      settingsByCurrency[currencyCode],
      currencyCode,
    )
    return nextSettings
  }, {})

  if (typeof window !== 'undefined') {
    localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(normalizedSettings))
  }

  return normalizedSettings
}

const readAllPaymentSettings = () => {
  const defaults = cloneDefaults()

  if (typeof window === 'undefined') {
    return defaults
  }

  const storedSettings = localStorage.getItem(PAYMENT_SETTINGS_KEY)

  if (!storedSettings) {
    return writeAllPaymentSettings(defaults)
  }

  try {
    const parsedSettings = JSON.parse(storedSettings)
    return writeAllPaymentSettings(
      Object.keys(supportedCurrencies).reduce((nextSettings, currencyCode) => {
        nextSettings[currencyCode] = normalizeCurrencySettings(
          parsedSettings?.[currencyCode],
          currencyCode,
        )
        return nextSettings
      }, {}),
    )
  } catch {
    return writeAllPaymentSettings(defaults)
  }
}

let paymentSettingsCache = readAllPaymentSettings()
let paymentSettingsMetaCache = readAllPaymentSettingsMeta()

const syncPaymentSettingsCache = (
  settingsByCurrency,
  metaByCurrency,
  { emit = false, persist = true } = {},
) => {
  paymentSettingsCache = Object.keys(supportedCurrencies).reduce((nextSettings, currencyCode) => {
    nextSettings[currencyCode] = normalizeCurrencySettings(
      settingsByCurrency[currencyCode],
      currencyCode,
    )
    return nextSettings
  }, {})

  paymentSettingsMetaCache = Object.keys(supportedCurrencies).reduce((nextMeta, currencyCode) => {
    nextMeta[currencyCode] = normalizeCurrencyMeta(metaByCurrency[currencyCode])
    return nextMeta
  }, {})

  if (persist) {
    writeAllPaymentSettings(paymentSettingsCache)
    writeAllPaymentSettingsMeta(paymentSettingsMetaCache)
  }

  if (emit) {
    emitPaymentSettingsUpdate()
  }

  return paymentSettingsCache
}

const applyPaymentSettingsRecord = (record = {}, options = {}) => {
  const currencyCode = normalizeCurrencyCode(record?.currencyCode)

  return syncPaymentSettingsCache(
    {
      ...paymentSettingsCache,
      [currencyCode]: normalizeCurrencySettings(record?.settings, currencyCode),
    },
    {
      ...paymentSettingsMetaCache,
      [currencyCode]: normalizeCurrencyMeta({
        updatedAt: record?.updatedAt,
        updatedBy: record?.updatedBy,
        revision: record?.revision,
      }),
    },
    options,
  )[currencyCode]
}

const applyPaymentSettingsRecords = (records = [], options = {}) => {
  const nextSettings = cloneDefaults()
  const nextMeta = createDefaultPaymentSettingsMetaByCurrency()

  for (const record of Array.isArray(records) ? records : []) {
    const currencyCode = normalizeCurrencyCode(record?.currencyCode)
    nextSettings[currencyCode] = normalizeCurrencySettings(record?.settings, currencyCode)
    nextMeta[currencyCode] = normalizeCurrencyMeta({
      updatedAt: record?.updatedAt,
      updatedBy: record?.updatedBy,
      revision: record?.revision,
    })
  }

  return syncPaymentSettingsCache(nextSettings, nextMeta, options)
}

const fetchPaymentSettingsFromBackend = async () => {
  const response = await api.get('/payment-settings')
  return Array.isArray(response?.data) ? response.data : []
}

const ensurePaymentSettingsLoaded = () => {
  if (!PAYMENT_SETTINGS_BACKEND_ENABLED || hasScheduledInitialPaymentSettingsLoad) {
    return
  }

  hasScheduledInitialPaymentSettingsLoad = true
  refreshPaymentSettings().catch((error) => {
    console.warn(error)
  })
}

export const refreshPaymentSettings = async () => {
  if (!PAYMENT_SETTINGS_BACKEND_ENABLED) {
    return paymentSettingsCache
  }

  if (activePaymentSettingsRefresh) {
    return activePaymentSettingsRefresh
  }

  activePaymentSettingsRefresh = (async () => {
    const records = await fetchPaymentSettingsFromBackend()
    applyPaymentSettingsRecords(records, { emit: true })
    return paymentSettingsCache
  })()
    .catch((error) => {
      if (
        PAYMENT_SETTINGS_LOCAL_FALLBACKS_ENABLED &&
        shouldFallbackToLocalPaymentSettings(error)
      ) {
        warnPaymentSettingsBackendUnavailable(error)
        return paymentSettingsCache
      }

      throw new Error(readApiErrorMessage(error, BACKEND_REQUIRED_MESSAGE))
    })
    .finally(() => {
      activePaymentSettingsRefresh = null
    })

  return activePaymentSettingsRefresh
}

const updatePaymentSettingsLocally = (currencyCode, settings, options = {}) =>
  applyPaymentSettingsRecord(
    {
      currencyCode,
      settings,
      updatedAt: new Date().toISOString(),
      updatedBy: trimText(options.updatedBy),
      revision:
        normalizeRevision(paymentSettingsMetaCache[normalizeCurrencyCode(currencyCode)]?.revision) + 1,
    },
    { emit: true },
  )

const writePaymentSettingsToBackend = async (currencyCode, settings, options = {}) => {
  const response = await api.put(`/payment-settings/${normalizeCurrencyCode(currencyCode)}`, {
    settings,
    updatedByName: trimText(options.updatedBy),
  })

  return response?.data ?? null
}

export const getAllPaymentSettings = () => {
  ensurePaymentSettingsLoaded()
  return paymentSettingsCache
}

export const getPaymentSettingsMetaForCurrency = (currencyCode) => {
  ensurePaymentSettingsLoaded()
  return paymentSettingsMetaCache[normalizeCurrencyCode(currencyCode)] ?? paymentSettingsMetaCache.USD
}

export const getPaymentSettingsForCurrency = (currencyCode) => {
  ensurePaymentSettingsLoaded()
  return paymentSettingsCache[normalizeCurrencyCode(currencyCode)] ?? paymentSettingsCache.USD
}

export const updatePaymentSettingsForCurrency = async (currencyCode, settings, options = {}) => {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode)
  const normalizedSettings = normalizeCurrencySettings(settings, normalizedCurrencyCode)

  if (PAYMENT_SETTINGS_BACKEND_ENABLED) {
    try {
      const record = await writePaymentSettingsToBackend(
        normalizedCurrencyCode,
        normalizedSettings,
        options,
      )
      return applyPaymentSettingsRecord(record, { emit: true })
    } catch (error) {
      if (
        PAYMENT_SETTINGS_LOCAL_FALLBACKS_ENABLED &&
        shouldFallbackToLocalPaymentSettings(error)
      ) {
        warnPaymentSettingsBackendUnavailable(error)
        return updatePaymentSettingsLocally(normalizedCurrencyCode, normalizedSettings, options)
      }

      throw new Error(
        readApiErrorMessage(error, 'We could not save those payment settings right now.'),
      )
    }
  }

  return updatePaymentSettingsLocally(normalizedCurrencyCode, normalizedSettings, options)
}

export const resetPaymentSettingsForCurrency = async (currencyCode, options = {}) =>
  updatePaymentSettingsForCurrency(
    normalizeCurrencyCode(currencyCode),
    cloneDefaults()[normalizeCurrencyCode(currencyCode)],
    options,
  )

export const subscribeToPaymentSettings = (listener) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleUpdate = () => listener(getAllPaymentSettings())
  const handleStorage = (event) => {
    if (event.key === PAYMENT_SETTINGS_KEY || event.key === PAYMENT_SETTINGS_META_KEY) {
      paymentSettingsCache = readAllPaymentSettings()
      paymentSettingsMetaCache = readAllPaymentSettingsMeta()
      listener(getAllPaymentSettings())
    }
  }

  window.addEventListener(PAYMENT_SETTINGS_UPDATED_EVENT, handleUpdate)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(PAYMENT_SETTINGS_UPDATED_EVENT, handleUpdate)
    window.removeEventListener('storage', handleStorage)
  }
}

export const findCryptoAssetById = (cryptoAssets, assetId) =>
  cryptoAssets.find((asset) => asset.id === assetId) ?? cryptoAssets[0] ?? { id: '', label: '', networks: [] }

export const isPaymentMethodConfigured = (settings, paymentMethod) => {
  if (!settings) {
    return false
  }

  switch (paymentMethod) {
    case PAYMENT_METHODS.BANK:
      return settings.bank.details.some((detail) => detail.value)
    case PAYMENT_METHODS.GIFT_CARD:
      return settings.giftCards.length > 0
    case PAYMENT_METHODS.CRYPTO:
      return settings.cryptoAssets.some((asset) => asset.networks.length > 0)
    default:
      return false
  }
}

export const getConfiguredPaymentMethods = (settings) =>
  Object.values(PAYMENT_METHODS).filter((method) => isPaymentMethodConfigured(settings, method))
