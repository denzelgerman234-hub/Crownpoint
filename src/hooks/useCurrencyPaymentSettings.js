import { useEffect, useState } from 'react'
import {
  getPaymentSettingsForCurrency,
  subscribeToPaymentSettings,
} from '../services/paymentSettingsService'
import {
  getCurrencyConfig,
  getCurrencyPreference,
  setCurrencyPreference,
  subscribeToCurrencyChanges,
} from '../utils/currency'

export const useCurrencyPaymentSettings = () => {
  const [currencyCode, setCurrencyCodeState] = useState(() => getCurrencyPreference())
  const [paymentSettings, setPaymentSettings] = useState(() =>
    getPaymentSettingsForCurrency(getCurrencyPreference()),
  )

  useEffect(() => {
    const handleCurrencyChange = (nextCurrencyCode) => {
      setCurrencyCodeState(nextCurrencyCode)
      setPaymentSettings(getPaymentSettingsForCurrency(nextCurrencyCode))
    }

    handleCurrencyChange(getCurrencyPreference())
    return subscribeToCurrencyChanges(handleCurrencyChange)
  }, [])

  useEffect(() => {
    const syncPaymentSettings = () => {
      setPaymentSettings(getPaymentSettingsForCurrency(currencyCode))
    }

    syncPaymentSettings()
    return subscribeToPaymentSettings(syncPaymentSettings)
  }, [currencyCode])

  const setCurrencyCode = (nextCurrencyCode) => {
    setCurrencyCodeState(nextCurrencyCode)
    setPaymentSettings(getPaymentSettingsForCurrency(nextCurrencyCode))
    setCurrencyPreference(nextCurrencyCode)
  }

  return {
    currencyCode,
    currencyConfig: getCurrencyConfig(currencyCode),
    paymentSettings,
    setCurrencyCode,
  }
}
