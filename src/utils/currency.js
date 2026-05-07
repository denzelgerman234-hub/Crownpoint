const CURRENCY_STORAGE_KEY = 'crownpoint_currency_preference'
const CURRENCY_CHANGE_EVENT = 'crownpoint:currency-changed'
const DEFAULT_CURRENCY = 'USD'

const EURO_REGIONS = new Set([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
])

const TIMEZONE_REGION_MAP = {
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/New_York': 'US',
  'America/Toronto': 'CA',
  'Asia/Dubai': 'AE',
  'Australia/Sydney': 'AU',
  'Europe/Dublin': 'IE',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
}

const REGION_CURRENCY_MAP = {
  AE: 'AED',
  AU: 'AUD',
  CA: 'CAD',
  GB: 'GBP',
  US: 'USD',
}

// Demo-side regional pricing multipliers. Production should come from
// a backend pricing service so finance can update them centrally.
export const supportedCurrencies = {
  USD: {
    code: 'USD',
    label: 'US Dollar',
    locale: 'en-US',
    regionLabel: 'United States',
    rate: 1,
  },
  GBP: {
    code: 'GBP',
    label: 'British Pound',
    locale: 'en-GB',
    regionLabel: 'United Kingdom',
    rate: 0.79,
  },
  EUR: {
    code: 'EUR',
    label: 'Euro',
    locale: 'en-IE',
    regionLabel: 'Eurozone',
    rate: 0.92,
  },
  CAD: {
    code: 'CAD',
    label: 'Canadian Dollar',
    locale: 'en-CA',
    regionLabel: 'Canada',
    rate: 1.36,
  },
  AUD: {
    code: 'AUD',
    label: 'Australian Dollar',
    locale: 'en-AU',
    regionLabel: 'Australia',
    rate: 1.52,
  },
  AED: {
    code: 'AED',
    label: 'UAE Dirham',
    locale: 'en-AE',
    regionLabel: 'United Arab Emirates',
    rate: 3.67,
  },
}

const isBrowser = () => typeof window !== 'undefined'

const getStoredCurrency = () => {
  if (!isBrowser()) {
    return null
  }

  const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY)
  return storedCurrency && supportedCurrencies[storedCurrency] ? storedCurrency : null
}

const getBrowserLocales = () => {
  if (typeof navigator === 'undefined') {
    return []
  }

  return [...(navigator.languages ?? []), navigator.language].filter(Boolean)
}

const getRegionFromLocale = (locale) => {
  const localeParts = String(locale).split('-')
  const region = localeParts.at(-1)?.toUpperCase()

  if (!region || region.length !== 2) {
    return null
  }

  return region
}

const detectRegion = () => {
  const localeRegion = getBrowserLocales()
    .map(getRegionFromLocale)
    .find(Boolean)

  if (localeRegion) {
    return localeRegion
  }

  if (typeof Intl === 'undefined') {
    return null
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return TIMEZONE_REGION_MAP[timeZone] ?? null
}

export const detectRegionalCurrency = () => {
  const region = detectRegion()

  if (!region) {
    return DEFAULT_CURRENCY
  }

  if (EURO_REGIONS.has(region)) {
    return 'EUR'
  }

  return REGION_CURRENCY_MAP[region] ?? DEFAULT_CURRENCY
}

export const getCurrencyPreference = () => getStoredCurrency() ?? detectRegionalCurrency()

export const getCurrencyConfig = (currencyCode = getCurrencyPreference()) =>
  supportedCurrencies[currencyCode] ?? supportedCurrencies[DEFAULT_CURRENCY]

export const convertUsdAmount = (amount, currencyCode = getCurrencyPreference()) =>
  amount * getCurrencyConfig(currencyCode).rate

export const formatUsdAmount = (amount, currencyCode = getCurrencyPreference(), options = {}) => {
  const currency = getCurrencyConfig(currencyCode)

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
  }).format(convertUsdAmount(amount, currency.code))
}

export const setCurrencyPreference = (currencyCode) => {
  if (!isBrowser() || !supportedCurrencies[currencyCode]) {
    return
  }

  window.localStorage.setItem(CURRENCY_STORAGE_KEY, currencyCode)
  window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT))
}

export const subscribeToCurrencyChanges = (listener) => {
  if (!isBrowser()) {
    return () => {}
  }

  const handleChange = () => listener(getCurrencyPreference())
  window.addEventListener(CURRENCY_CHANGE_EVENT, handleChange)
  return () => window.removeEventListener(CURRENCY_CHANGE_EVENT, handleChange)
}
