import { supportedCurrencies } from '../utils/currency.js'

const sharedCryptoAssetTemplates = [
  {
    id: 'USDT',
    label: 'Tether (USDT)',
    networks: [
      { id: 'ETH_ERC20', label: 'Ethereum (ERC-20)', wallet: '0x7a3b9C2dE8f4A1b5D6c7E8f9A0b1C2d3E4f5A6b7' },
      { id: 'TRON_TRC20', label: 'Tron (TRC-20)', wallet: 'TQ8n7Yv1mK4n9pX2fL6rV3sA8dC1uH5zQK' },
      { id: 'BSC_BEP20', label: 'BNB Smart Chain (BEP-20)', wallet: '0x94e12D7a3E4f4b19C8d2A3f1c2D4b6E8f7A9c2F4' },
      { id: 'SOL_SPL', label: 'Solana (SPL)', wallet: '7A6uM3Qp8m2sV5nY1cD4kL7tR9wX6zB3fP2qN8hC5jK' },
    ],
  },
  {
    id: 'USDC',
    label: 'USD Coin (USDC)',
    networks: [
      { id: 'ETH_ERC20', label: 'Ethereum (ERC-20)', wallet: '0x2b4C6d8E1f3A5c7D9e2F4a6B8c1D3e5F7a9C2b4D' },
      { id: 'SOL_SPL', label: 'Solana (SPL)', wallet: '5Q2mN8xC4vB7kL1pS6dF9hJ3rT8yU2wE5aZ7nM4cP1R' },
      { id: 'POLYGON_POS', label: 'Polygon (PoS)', wallet: '0x3C5d7E9f1A2b4D6f8C1e3A5c7D9f2B4d6E8f1A3c' },
      { id: 'BASE', label: 'Base', wallet: '0x4D6e8F1a3C5d7E9f1A2b4D6f8C1e3A5c7D9f2B4d' },
    ],
  },
  {
    id: 'BTC',
    label: 'Bitcoin (BTC)',
    networks: [
      { id: 'BITCOIN_MAINNET', label: 'Bitcoin Mainnet', wallet: 'bc1q7n4d2a8p3m5x9v6c1k4r7t2y8u5w3z9s6q2n4d' },
      { id: 'WBTC_ETH', label: 'Wrapped BTC on Ethereum', wallet: '0x7A9c1E3a5C7d9F1b3D5f7A9c1E3a5C7d9F1b3D5f' },
      { id: 'BTCB_BSC', label: 'Bitcoin on BNB Smart Chain', wallet: '0x8B1d3F5a7C9e1A3c5D7f9B1d3F5a7C9e1A3c5D7f' },
      { id: 'WBTC_BASE', label: 'Wrapped BTC on Base', wallet: '0x9C2e4A6c8D1f3B5d7E9a2C4e6F8b1D3f5A7c9E1b' },
    ],
  },
  {
    id: 'ETH',
    label: 'Ethereum (ETH)',
    networks: [
      { id: 'ETH_MAINNET', label: 'Ethereum Mainnet', wallet: '0x1a3C5e7F9b1D3f5A7c9E1b3D5f7A9c1E3a5C7d9F' },
      { id: 'ARBITRUM_ONE', label: 'Arbitrum One', wallet: '0x2b4D6f8A1c3E5d7F9a2C4e6F8b1D3f5A7c9E1b3D' },
      { id: 'BASE', label: 'Base', wallet: '0x3c5E7f9B1d3F5a7C9e1A3c5D7f9B1d3F5a7C9e1A' },
      { id: 'OPTIMISM', label: 'Optimism', wallet: '0x4d6F8a1C3e5D7f9A2c4E6f8B1d3F5a7C9e1A3c5D' },
    ],
  },
  {
    id: 'SOL',
    label: 'Solana (SOL)',
    networks: [
      { id: 'SOLANA_MAINNET', label: 'Solana Mainnet', wallet: '9D4mN7xQ2vC6kL1pS5dF8hJ3rT7yU2wE6aZ9nM4cP2R' },
      { id: 'SOL_ETH', label: 'Wrapped SOL on Ethereum', wallet: '0xB4d6F8a1C3e5D7f9A2c4E6f8B1d3F5a7C9e1A3c5' },
      { id: 'SOL_BASE', label: 'Wrapped SOL on Base', wallet: '0xC5e7F9b1D3f5A7c9E1b3D5f7A9c1E3a5C7d9F1b3' },
      { id: 'SOL_POLY', label: 'Wrapped SOL on Polygon', wallet: '0xE7f9B1d3F5a7C9e1A3c5D7f9B1d3F5a7C9e1A3c5' },
    ],
  },
]

const currencyBankTemplates = {
  USD: {
    instructions: 'Transfer the exact amount with your payment reference so the desk can match it quickly.',
    details: [
      { id: 'account-name', label: 'Account name', value: 'CrownPoint Holdings LLC' },
      { id: 'account-number', label: 'Account number', value: '2048372910' },
      { id: 'bank-name', label: 'Bank', value: 'JPMorgan Chase Bank' },
      { id: 'routing-number', label: 'Routing number', value: '021000021' },
    ],
  },
  GBP: {
    instructions: 'Use the exact GBP total and keep the generated reference in the transfer note.',
    details: [
      { id: 'account-name', label: 'Account name', value: 'CrownPoint Agency Ltd' },
      { id: 'account-number', label: 'Account number', value: '20483729' },
      { id: 'bank-name', label: 'Bank', value: 'Barclays Bank PLC' },
      { id: 'sort-code', label: 'Sort code', value: '20-45-78' },
    ],
  },
  EUR: {
    instructions: 'Send the transfer in EUR and include the reference exactly as shown below.',
    details: [
      { id: 'beneficiary-name', label: 'Beneficiary', value: 'CrownPoint Europe GmbH' },
      { id: 'iban', label: 'IBAN', value: 'DE89370400440532013000' },
      { id: 'bank-name', label: 'Bank', value: 'Deutsche Bank' },
      { id: 'swift', label: 'SWIFT / BIC', value: 'DEUTDEFF' },
    ],
  },
  CAD: {
    instructions: 'Send the transfer in CAD and use the reference so the Canadian desk can reconcile it fast.',
    details: [
      { id: 'account-name', label: 'Account name', value: 'CrownPoint Media Canada Inc.' },
      { id: 'account-number', label: 'Account number', value: '001928374651' },
      { id: 'bank-name', label: 'Bank', value: 'Royal Bank of Canada' },
      { id: 'transit-number', label: 'Transit number', value: '00012' },
      { id: 'institution-number', label: 'Institution number', value: '003' },
    ],
  },
  AUD: {
    instructions: 'Use your reference in the transfer description so the AUD payment can be cleared quickly.',
    details: [
      { id: 'account-name', label: 'Account name', value: 'CrownPoint Agency Pty Ltd' },
      { id: 'bsb', label: 'BSB', value: '082-001' },
      { id: 'account-number', label: 'Account number', value: '16482039' },
      { id: 'bank-name', label: 'Bank', value: 'National Australia Bank' },
    ],
  },
  AED: {
    instructions: 'Transfer the AED amount exactly and include the payment reference in your sender note.',
    details: [
      { id: 'beneficiary-name', label: 'Beneficiary', value: 'CrownPoint Media FZ-LLC' },
      { id: 'iban', label: 'IBAN', value: 'AE070330000123456789012' },
      { id: 'bank-name', label: 'Bank', value: 'Emirates NBD' },
      { id: 'swift', label: 'SWIFT', value: 'EBILAEAD' },
    ],
  },
}

const currencyGiftCardTemplates = {
  USD: [
    { id: 'AMAZON', label: 'Amazon Gift Card' },
    { id: 'APPLE', label: 'Apple Gift Card' },
    { id: 'VISA', label: 'Visa Gift Card' },
    { id: 'MASTERCARD', label: 'Mastercard Gift Card' },
    { id: 'GOOGLE_PLAY', label: 'Google Play Gift Card' },
    { id: 'STEAM', label: 'Steam Gift Card' },
  ],
  GBP: [
    { id: 'AMAZON_UK', label: 'Amazon UK Gift Card' },
    { id: 'APPLE', label: 'Apple Gift Card' },
    { id: 'VISA', label: 'Visa Gift Card' },
    { id: 'MASTERCARD', label: 'Mastercard Gift Card' },
    { id: 'PLAYSTATION', label: 'PlayStation Store Gift Card' },
    { id: 'STEAM', label: 'Steam Gift Card' },
  ],
  EUR: [
    { id: 'AMAZON', label: 'Amazon Gift Card' },
    { id: 'APPLE', label: 'Apple Gift Card' },
    { id: 'CARREFOUR', label: 'Carrefour Gift Card' },
    { id: 'GOOGLE_PLAY', label: 'Google Play Gift Card' },
    { id: 'STEAM', label: 'Steam Gift Card' },
    { id: 'VISA', label: 'Visa Gift Card' },
  ],
  CAD: [
    { id: 'AMAZON_CA', label: 'Amazon.ca Gift Card' },
    { id: 'APPLE', label: 'Apple Gift Card' },
    { id: 'VISA', label: 'Visa Gift Card' },
    { id: 'MASTERCARD', label: 'Mastercard Gift Card' },
    { id: 'GOOGLE_PLAY', label: 'Google Play Gift Card' },
    { id: 'WALMART', label: 'Walmart Gift Card' },
  ],
  AUD: [
    { id: 'AMAZON_AU', label: 'Amazon Australia Gift Card' },
    { id: 'APPLE', label: 'Apple Gift Card' },
    { id: 'JB_HIFI', label: 'JB Hi-Fi Gift Card' },
    { id: 'VISA', label: 'Visa Gift Card' },
    { id: 'GOOGLE_PLAY', label: 'Google Play Gift Card' },
    { id: 'STEAM', label: 'Steam Gift Card' },
  ],
  AED: [
    { id: 'AMAZON_AE', label: 'Amazon.ae Gift Card' },
    { id: 'APPLE', label: 'Apple Gift Card' },
    { id: 'CARREFOUR', label: 'Carrefour Gift Card' },
    { id: 'NOON', label: 'Noon Gift Card' },
    { id: 'VISA', label: 'Visa Gift Card' },
    { id: 'STEAM', label: 'Steam Gift Card' },
  ],
}

const cloneBankTemplate = (currencyCode) => ({
  referencePrefix: 'CP',
  instructions: currencyBankTemplates[currencyCode]?.instructions ?? '',
  details: (currencyBankTemplates[currencyCode]?.details ?? []).map((detail) => ({ ...detail })),
})

const cloneGiftCardTemplate = (currencyCode) =>
  (currencyGiftCardTemplates[currencyCode] ?? []).map((card) => ({ ...card }))

const cloneCryptoTemplate = () =>
  sharedCryptoAssetTemplates.map((asset) => ({
    ...asset,
    networks: asset.networks.map((network) => ({ ...network })),
  }))

export const createDefaultPaymentSettingsByCurrency = () =>
  Object.keys(supportedCurrencies).reduce((settings, currencyCode) => {
    settings[currencyCode] = {
      currencyCode,
      bank: cloneBankTemplate(currencyCode),
      giftCards: cloneGiftCardTemplate(currencyCode),
      cryptoAssets: cloneCryptoTemplate(),
    }

    return settings
  }, {})
