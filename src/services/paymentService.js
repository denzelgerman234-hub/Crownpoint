import { getPaymentSettingsForCurrency } from './paymentSettingsService'
import { getCurrencyPreference } from '../utils/currency'

export const submitPayment = async (_paymentData) =>
  Promise.resolve({ success: true, message: 'Payment submitted for review' })

export const getPaymentStatus = async (orderId) =>
  Promise.resolve({ orderId, status: 'UNDER_REVIEW' })

export const getPaymentInstructions = async (
  method,
  currencyCode = getCurrencyPreference(),
) => {
  const paymentSettings = getPaymentSettingsForCurrency(currencyCode)

  return Promise.resolve({
    BANK_TRANSFER: {
      ...paymentSettings.bank,
      details: paymentSettings.bank.details,
    },
    GIFT_CARD: {
      acceptedGiftCards: paymentSettings.giftCards,
    },
    CRYPTO: {
      assets: paymentSettings.cryptoAssets,
    },
  }[method])
}
