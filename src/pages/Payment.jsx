import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Gift,
  Globe2,
  MessageSquareText,
  Shield,
  Upload,
  Wallet,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import StatusBadge from '../components/ui/StatusBadge'
import TalentAvatar from '../components/ui/TalentAvatar'
import { useCart } from '../context/CartContext'
import { useOrder } from '../context/OrderContext'
import { useCurrencyPaymentSettings } from '../hooks/useCurrencyPaymentSettings'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import {
  fetchOrderByRefCode,
  getOrderByRefCode,
  submitOrderPayment,
  subscribeToOrderUpdates,
} from '../services/orderService'
import {
  uploadPaymentProofFile,
  validatePaymentProofFile,
} from '../services/storageService'
import {
  findCryptoAssetById,
  isPaymentMethodConfigured,
} from '../services/paymentSettingsService'
import {
  getTalentRosterSnapshot,
  getTalentSnapshotById,
} from '../services/talentService'
import {
  ORDER_EXPIRY_MINUTES,
  ORDER_STATUS,
  ORDER_TYPES,
  PAYMENT_METHODS,
} from '../utils/constants'
import { countryPhoneOptions, getCountryPhoneOption } from '../utils/countries'
import { supportedCurrencies } from '../utils/currency'
import {
  buildCheckoutContactFromUser,
  buildShippingAddressFromUser,
  createEmptyCheckoutContact,
  createEmptyShippingAddress,
  getShippingAddressSummary,
  normalizeCheckoutContact,
  normalizeShippingAddress,
} from '../utils/checkout'
import { formatCountdown, formatCurrency, maskWallet } from '../utils/formatters'
import {
  getOrderBackLabel,
  getOrderBackLink,
  getOrderContextLabel,
  getOrderItems,
  getOrderTitle,
  getOrderType,
  getOrderTypeLabel,
} from '../utils/orders'
import { generateRef } from '../utils/generateRef'
import { revealUp } from '../utils/motion'

const TABS = [
  { id: PAYMENT_METHODS.BANK, label: 'Bank Transfer', icon: CreditCard },
  { id: PAYMENT_METHODS.GIFT_CARD, label: 'Gift Card', icon: Gift },
  { id: PAYMENT_METHODS.CRYPTO, label: 'Cryptocurrency', icon: Wallet },
]

const EMAIL_PATTERN = /\S+@\S+\.\S+/
const shopTypeLabels = {
  APPAREL: 'Apparel',
  SIGNED: 'Signed item',
  ACCESSORY: 'Accessory',
  COLLECTIBLE: 'Collectible',
}

const hasCheckoutContactValue = (contact = {}) => {
  const normalizedContact = normalizeCheckoutContact(contact)
  return Boolean(normalizedContact.fullName || normalizedContact.email || normalizedContact.phone)
}

const hasShippingAddressValue = (shippingAddress = {}) => {
  const normalizedShippingAddress = normalizeShippingAddress(shippingAddress)
  return Boolean(
    normalizedShippingAddress.recipient ||
    normalizedShippingAddress.countryCode ||
    normalizedShippingAddress.addressLine1 ||
    normalizedShippingAddress.city ||
    normalizedShippingAddress.postalCode,
  )
}

export default function Payment() {
  const [searchParams] = useSearchParams()
  const { cart, clearCart } = useCart()
  const { currentOrder, updateOrder } = useOrder()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { currencyCode, currencyConfig, paymentSettings, setCurrencyCode } = useCurrencyPaymentSettings()
  const fileInputRef = useRef(null)
  const [generatedReference] = useState(() => searchParams.get('ref') ?? generateRef())
  const requestedOrderType = searchParams.get('type')
  const isRequestedShopCheckout =
    requestedOrderType === ORDER_TYPES.SHOP || currentOrder.orderType === ORDER_TYPES.SHOP

  const fallbackTalentId = searchParams.get('talent') || '1'
  const fallbackTalent =
    currentOrder.talent ??
    getTalentSnapshotById(fallbackTalentId) ??
    getTalentRosterSnapshot()[0]
  const fallbackService = currentOrder.service ?? fallbackTalent?.services?.[0]
  const hasCommittedOrder = !!(
    currentOrder.talent &&
    (currentOrder.service || currentOrder.event || currentOrder.items?.length)
  )

  const serviceFallbackOrder = fallbackTalent && fallbackService
    ? {
        orderType: ORDER_TYPES.SERVICE,
        talent: fallbackTalent,
        service: fallbackService,
        event: null,
        ticketTier: null,
        recipient: '',
        occasion: '',
        tone: '',
        deliveryWindow: '',
        note: '',
        itemLabel: '',
        refCode: generatedReference,
        totalPrice: fallbackService.price,
        items: [{
          id: fallbackService.id,
          title: fallbackService.label,
          subtitle: 'Personalized service request',
          quantity: 1,
          unitPrice: fallbackService.price,
          totalPrice: fallbackService.price,
        }],
        status: ORDER_STATUS.PENDING_PAYMENT,
        paymentMethod: null,
        paymentProof: '',
        paymentProofFileName: '',
        giftCardBrand: '',
        cryptoAsset: '',
        cryptoNetwork: '',
        contact: createEmptyCheckoutContact(),
        shippingAddress: createEmptyShippingAddress(),
      }
    : null
  const shopFallbackTalent =
    currentOrder.talent ?? cart.talent ?? getTalentSnapshotById(fallbackTalentId)
  const shopFallbackItems = (
    currentOrder.items?.length
      ? currentOrder.items
      : cart.items.map((item) => ({
          ...item,
          subtitle:
            item.subtitle ||
            (item.selectedSize ? `Size ${item.selectedSize}` : shopTypeLabels[item.type] ?? item.type),
        }))
  )
  const shopFallbackItemCount = shopFallbackItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
  const shopFallbackTotal = currentOrder.totalPrice || shopFallbackItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const shopFallbackOrder = shopFallbackTalent && shopFallbackItems.length
    ? {
        orderType: ORDER_TYPES.SHOP,
        talent: shopFallbackTalent,
        service: null,
        event: null,
        ticketTier: null,
        recipient: '',
        occasion: 'Artist shop order',
        tone: '',
        deliveryWindow: 'Fulfilled after payment review',
        note: currentOrder.note || `Merchandise order for ${shopFallbackTalent.name}`,
        itemLabel:
          currentOrder.itemLabel ||
          (shopFallbackItems.length === 1
            ? shopFallbackItems[0].title
            : `${shopFallbackItemCount} selected merch items`),
        refCode: currentOrder.refCode ?? generatedReference,
        totalPrice: shopFallbackTotal,
        items: shopFallbackItems,
        status: currentOrder.status ?? ORDER_STATUS.PENDING_PAYMENT,
        paymentMethod: currentOrder.paymentMethod,
        paymentProof: currentOrder.paymentProof,
        paymentProofFileName: currentOrder.paymentProofFileName,
        giftCardBrand: currentOrder.giftCardBrand,
        cryptoAsset: currentOrder.cryptoAsset,
        cryptoNetwork: currentOrder.cryptoNetwork,
        contact: currentOrder.contact,
        shippingAddress: currentOrder.shippingAddress,
      }
    : null

  const referenceCode = (currentOrder.refCode ?? generatedReference)
  const [persistedOrder, setPersistedOrder] = useState(() =>
    getOrderByRefCode(referenceCode, user?.id ?? null),
  )
  const order = persistedOrder ?? (hasCommittedOrder
    ? { ...currentOrder, refCode: currentOrder.refCode ?? generatedReference }
    : (isRequestedShopCheckout ? shopFallbackOrder : serviceFallbackOrder))

  const orderType = getOrderType(order)
  const orderTalent = order?.talent ?? fallbackTalent
  const orderItems = getOrderItems(order)
  const orderTitle = getOrderTitle(order)
  const orderTypeLabel = getOrderTypeLabel(order)
  const totalPrice = order?.totalPrice ?? orderItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const referencePrefix = paymentSettings.bank.referencePrefix || 'CP'
  const acceptedGiftCards = paymentSettings.giftCards
  const cryptoAssets = paymentSettings.cryptoAssets
  const bankDetails = [
    ...paymentSettings.bank.details,
    {
      id: 'reference',
      label: 'Reference',
      value: `${referencePrefix}-${referenceCode}`,
    },
  ].filter((detail) => detail.value)

  const [activeTab, setActiveTab] = useState(() => currentOrder.paymentMethod ?? PAYMENT_METHODS.BANK)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [giftCode, setGiftCode] = useState(() =>
    currentOrder.paymentMethod === PAYMENT_METHODS.GIFT_CARD ? currentOrder.paymentProof ?? '' : '',
  )
  const [selectedGiftCardBrand, setSelectedGiftCardBrand] = useState(() =>
    currentOrder.giftCardBrand || acceptedGiftCards[0]?.id || '',
  )
  const [cryptoHash, setCryptoHash] = useState(() =>
    currentOrder.paymentMethod === PAYMENT_METHODS.CRYPTO ? currentOrder.paymentProof ?? '' : '',
  )
  const [selectedCryptoAsset, setSelectedCryptoAsset] = useState(() =>
    currentOrder.cryptoAsset || cryptoAssets[0]?.id || '',
  )
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState(() => {
    const savedAsset = currentOrder.cryptoAsset
      ? findCryptoAssetById(cryptoAssets, currentOrder.cryptoAsset)
      : cryptoAssets[0]

    return savedAsset?.networks.some((network) => network.id === currentOrder.cryptoNetwork)
      ? currentOrder.cryptoNetwork
      : savedAsset?.networks[0]?.id || ''
  })
  const [copiedField, setCopiedField] = useState(null)
  const submitted = !!order?.status && order.status !== ORDER_STATUS.PENDING_PAYMENT
  const [countdown, setCountdown] = useState(ORDER_EXPIRY_MINUTES * 60)

  useEffect(() => {
    const syncPersistedOrder = () => {
      setPersistedOrder(getOrderByRefCode(referenceCode, user?.id ?? null))
    }

    syncPersistedOrder()
    fetchOrderByRefCode(referenceCode, user?.id ?? null)
      .then((nextOrder) => {
        if (nextOrder) {
          setPersistedOrder(nextOrder)
        }
      })
      .catch((error) => {
        showToast(error.message || 'We could not refresh that order right now.', 'warning')
      })

    return subscribeToOrderUpdates(syncPersistedOrder)
  }, [referenceCode, showToast, user])

  useEffect(() => {
    if (submitted) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [submitted])

  const blockedShopCheckout = isRequestedShopCheckout && !persistedOrder

  if (blockedShopCheckout) {
    return (
      <PageWrapper className="cp-page--payment">
        <section className="cp-empty-state">
          <div className="cp-container">
            <span className="cp-eyebrow">Merch checkout</span>
            <h2 className="section-title">
              Merch purchases now continue on <em>Amazon.</em>
            </h2>
            <p>
              Use the talent merch link to browse products and complete your purchase directly on Amazon.
            </p>
            <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
              {shopFallbackTalent?.shopLink ? (
                <a className="cp-btn cp-btn--primary" href={shopFallbackTalent.shopLink} rel="noreferrer" target="_blank">
                  Open Amazon merch
                </a>
              ) : null}
              <Link className="cp-btn cp-btn--ghost" to={shopFallbackTalent ? `/talent/${shopFallbackTalent.id}` : '/talents'}>
                Back to profile
              </Link>
            </div>
          </div>
        </section>
      </PageWrapper>
    )
  }

  const resolvedActiveTab =
    isPaymentMethodConfigured(paymentSettings, activeTab)
      ? activeTab
      : TABS.find((tab) => isPaymentMethodConfigured(paymentSettings, tab.id))?.id ??
        PAYMENT_METHODS.BANK
  const resolvedGiftCardBrand =
    acceptedGiftCards.some((card) => card.id === selectedGiftCardBrand)
      ? selectedGiftCardBrand
      : acceptedGiftCards[0]?.id || ''
  const selectedGiftCardLabel = acceptedGiftCards.find((card) => card.id === resolvedGiftCardBrand)?.label
  const selectedCryptoAssetMeta =
    (selectedCryptoAsset && cryptoAssets.some((asset) => asset.id === selectedCryptoAsset)
      ? findCryptoAssetById(cryptoAssets, selectedCryptoAsset)
      : cryptoAssets.find((asset) => asset.networks.length > 0) ?? cryptoAssets[0]) ?? {
      id: '',
      label: '',
      networks: [],
    }
  const resolvedCryptoAsset = selectedCryptoAssetMeta.id
  const selectedCryptoNetworkMeta =
    selectedCryptoAssetMeta.networks.find((network) => network.id === selectedCryptoNetwork) ??
    selectedCryptoAssetMeta.networks[0] ?? {
      id: '',
      label: 'No network configured',
      wallet: '',
    }
  const resolvedCryptoNetwork = selectedCryptoNetworkMeta.id
  const activeTabMeta = TABS.find((tab) => tab.id === resolvedActiveTab) ?? TABS[0]
  const ActiveTabIcon = activeTabMeta.icon
  const activeMethodConfigured = isPaymentMethodConfigured(paymentSettings, resolvedActiveTab)
  const normalizedShopContact =
    orderType === ORDER_TYPES.SHOP
      ? normalizeCheckoutContact(
          hasCheckoutContactValue(order?.contact)
            ? order.contact
            : buildCheckoutContactFromUser(user),
        )
      : createEmptyCheckoutContact()
  const normalizedShippingAddress =
    orderType === ORDER_TYPES.SHOP
      ? normalizeShippingAddress(
          hasShippingAddressValue(order?.shippingAddress)
            ? order.shippingAddress
            : buildShippingAddressFromUser(user),
        )
      : createEmptyShippingAddress()
  const shopContactReady = Boolean(
    normalizedShopContact.fullName &&
    normalizedShopContact.phone &&
    EMAIL_PATTERN.test(normalizedShopContact.email),
  )
  const shopShippingReady = Boolean(
    normalizedShippingAddress.recipient &&
    normalizedShippingAddress.countryCode &&
    normalizedShippingAddress.addressLine1 &&
    normalizedShippingAddress.city &&
    normalizedShippingAddress.stateOrRegion &&
    normalizedShippingAddress.postalCode,
  )
  const shopCheckoutReady =
    orderType !== ORDER_TYPES.SHOP || (shopContactReady && shopShippingReady)
  const proofReady =
    activeMethodConfigured &&
    !!uploadedFile &&
    confirmed &&
    shopCheckoutReady &&
    (resolvedActiveTab !== PAYMENT_METHODS.GIFT_CARD || (resolvedGiftCardBrand && giftCode.trim())) &&
    (resolvedActiveTab !== PAYMENT_METHODS.CRYPTO ||
      (resolvedCryptoAsset && resolvedCryptoNetwork && cryptoHash.trim()))

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 2000)
    } catch {
      showToast('Copy was blocked on this browser. Try again manually.', 'warning')
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]

    if (file) {
      try {
        validatePaymentProofFile(file)
        setUploadedFile(file)
      } catch (error) {
        showToast(error.message || 'We could not use that proof file.', 'warning')
      }
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]

    if (file) {
      try {
        validatePaymentProofFile(file)
        setUploadedFile(file)
      } catch (error) {
        showToast(error.message || 'We could not use that proof file.', 'warning')
      }
    }
  }

  const handleCryptoAssetChange = (event) => {
    const nextAssetId = event.target.value
    const nextAsset = findCryptoAssetById(cryptoAssets, nextAssetId)

    setSelectedCryptoAsset(nextAssetId)
    setSelectedCryptoNetwork(nextAsset.networks[0]?.id || '')
  }

  const handleCurrencyChange = (event) => {
    setCurrencyCode(event.target.value)
  }

  const updateDraftCheckout = (updates) => {
    if (!submitted && !persistedOrder && orderType === ORDER_TYPES.SHOP) {
      updateOrder(updates)
    }
  }

  const handleShopContactChange = (field) => (event) => {
    updateDraftCheckout({
      contact: normalizeCheckoutContact({
        ...normalizedShopContact,
        [field]: event.target.value,
      }),
    })
  }

  const handleShippingFieldChange = (field) => (event) => {
    updateDraftCheckout({
      shippingAddress: normalizeShippingAddress({
        ...normalizedShippingAddress,
        [field]: event.target.value,
      }),
    })
  }

  const handleShippingCountryChange = (event) => {
    const nextCountry = getCountryPhoneOption(event.target.value)

    updateDraftCheckout({
      shippingAddress: normalizeShippingAddress({
        ...normalizedShippingAddress,
        countryCode: nextCountry?.code ?? '',
        country: nextCountry?.name ?? '',
      }),
    })
  }

  const handleSubmit = async () => {
    if (!orderTalent || !orderItems.length) {
      showToast('There is no active order to submit for payment.', 'warning')
      return
    }

    if (submitted) {
      showToast('Payment has already been submitted. Track the update in your account.', 'success')
      return
    }

    if (countdown <= 0) {
      showToast('This payment window expired. Start a fresh experience, ticket, or shop order.', 'warning')
      return
    }

    if (!activeMethodConfigured) {
      showToast('This payment method is not configured for the selected currency yet.', 'warning')
      return
    }

    if (orderType === ORDER_TYPES.SHOP && !shopContactReady) {
      if (!EMAIL_PATTERN.test(normalizedShopContact.email)) {
        showToast('Add a valid contact email before submitting this shop order.', 'warning')
        return
      }

      showToast('Add the buyer name, email, and phone before submitting this shop order.', 'warning')
      return
    }

    if (orderType === ORDER_TYPES.SHOP && !shopShippingReady) {
      showToast('Complete the shipping address before submitting this shop order.', 'warning')
      return
    }

    if (!uploadedFile) {
      showToast('Upload your proof of payment before submitting.', 'warning')
      return
    }

    if (resolvedActiveTab === PAYMENT_METHODS.GIFT_CARD && !giftCode.trim()) {
      showToast('Enter the gift card code before you continue.', 'warning')
      return
    }

    if (resolvedActiveTab === PAYMENT_METHODS.GIFT_CARD && !resolvedGiftCardBrand) {
      showToast('Choose the gift card brand before you continue.', 'warning')
      return
    }

    if (resolvedActiveTab === PAYMENT_METHODS.CRYPTO && !cryptoHash.trim()) {
      showToast('Add the transaction hash before you continue.', 'warning')
      return
    }

    if (resolvedActiveTab === PAYMENT_METHODS.CRYPTO && (!resolvedCryptoAsset || !resolvedCryptoNetwork)) {
      showToast('Choose the crypto asset and network before you continue.', 'warning')
      return
    }

    if (!confirmed) {
      showToast('Confirm that the payment details are accurate before submitting.', 'warning')
      return
    }

    const paymentProof =
      resolvedActiveTab === PAYMENT_METHODS.GIFT_CARD
        ? giftCode.trim()
        : resolvedActiveTab === PAYMENT_METHODS.CRYPTO
          ? cryptoHash.trim()
          : uploadedFile.name

    try {
      const proofUpload = await uploadPaymentProofFile({
        file: uploadedFile,
        category: 'order',
        ownerKey: user?.authUserId || 'guest',
      })
      const savedOrder = await submitOrderPayment({
        ...order,
        userId: user?.id ?? null,
        fanName:
          orderType === ORDER_TYPES.SHOP
            ? normalizedShopContact.fullName || user?.name
            : user?.name,
        email:
          orderType === ORDER_TYPES.SHOP
            ? normalizedShopContact.email || user?.email
            : user?.email,
        contact: orderType === ORDER_TYPES.SHOP ? normalizedShopContact : order?.contact,
        shippingAddress: orderType === ORDER_TYPES.SHOP ? normalizedShippingAddress : order?.shippingAddress,
        refCode: referenceCode,
        totalPrice,
        requestedFor:
          orderType === ORDER_TYPES.SHOP
            ? getShippingAddressSummary(normalizedShippingAddress)
            : order?.requestedFor,
        region:
          orderType === ORDER_TYPES.SHOP
            ? normalizedShippingAddress.country || user?.profile?.country || currencyConfig.regionLabel
            : order?.region || user?.profile?.country || currencyConfig.regionLabel,
        paymentMethod: resolvedActiveTab,
        paymentProof,
        paymentProofFileName: proofUpload.fileName,
        proofUpload,
        giftCardBrand: resolvedActiveTab === PAYMENT_METHODS.GIFT_CARD ? resolvedGiftCardBrand : '',
        cryptoAsset: resolvedActiveTab === PAYMENT_METHODS.CRYPTO ? resolvedCryptoAsset : '',
        cryptoNetwork: resolvedActiveTab === PAYMENT_METHODS.CRYPTO ? resolvedCryptoNetwork : '',
        status: ORDER_STATUS.UNDER_REVIEW,
      })
      setPersistedOrder(savedOrder)
      updateOrder(savedOrder)

      if (cart.talent?.id === orderTalent.id) {
        clearCart()
      }
      showToast('Payment submitted for verification. We will update your account shortly.', 'success')
    } catch (error) {
      showToast(error.message || 'We could not submit that payment right now.', 'warning')
    }
  }

  if (!orderTalent || !orderItems.length || !totalPrice) {
    return (
      <PageWrapper className="cp-page--payment">
        <section className="cp-empty-state">
          <div className="cp-container">
            <span className="cp-eyebrow">No order found</span>
            <h2 className="section-title">
              Start with a talent or event request before you open <em>payment.</em>
            </h2>
            <p>Choose an experience first, then return here to complete your payment.</p>
            <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
              <Link className="cp-btn cp-btn--primary" to="/talents">
                Browse talents
              </Link>
            </div>
          </div>
        </section>
      </PageWrapper>
    )
  }

  const backLink = getOrderBackLink(order)
  const backLabel = getOrderBackLabel(order)
  const shopShippingSummary = getShippingAddressSummary(normalizedShippingAddress)
  const shopShippingLocality = [
    normalizedShippingAddress.city,
    normalizedShippingAddress.stateOrRegion,
    normalizedShippingAddress.country,
  ].filter(Boolean).join(', ')
  const shopShippingStreet = [
    normalizedShippingAddress.addressLine1,
    normalizedShippingAddress.postalCode,
  ].filter(Boolean).join(' / ')
  const orderSummaryPoints = (
    orderType === ORDER_TYPES.TICKET
      ? [
          `Event date: ${order.deliveryWindow || 'Selected event date'}`,
          `Ticket tier: ${order.ticketTier?.label ?? 'Selected ticket tier'}`,
          `${orderItems[0]?.quantity ?? 1} ticket(s) tied to ${orderTalent.name}`,
        ]
      : orderType === ORDER_TYPES.SHOP
        ? [
            `${orderItems.length} line item${orderItems.length === 1 ? '' : 's'} in this cart`,
            shopShippingSummary
              ? `Ship to ${shopShippingSummary}`
              : 'Add a recipient and delivery destination before submitting payment',
            shopShippingStreet || shopShippingLocality || 'Sizes and item details stay attached to this cart',
          ]
        : [
            `For ${order.recipient || 'your recipient'}`,
            `Tone: ${order.tone || 'Thoughtful, personalized delivery'}`,
            `Window: ${order.deliveryWindow || orderTalent.responseTime}`,
          ]
  )

  const paymentSubtitle = (
    orderType === ORDER_TYPES.TICKET
      ? `Secure payment to lock in ${orderTalent.name}'s event access.`
      : orderType === ORDER_TYPES.SHOP
        ? `Secure payment to release this ${orderTalent.name} shop cart for fulfillment.`
        : `Secure payment to confirm your experience with ${orderTalent.name}.`
  )

  return (
    <PageWrapper className="cp-page--payment">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Secure payment</span>
            <h1 className="cp-page-title">
              Complete payment for your <em>request.</em>
            </h1>
            <p className="cp-page-intro">
              Choose the payment method that suits you, upload proof, and we will confirm your
              order as soon as it is verified.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 16 }}>
        <div className="cp-container">
          <div className="cp-payment-grid">
            <div className="cp-step-stack">
            <Link className="cp-payment-backlink" to={backLink}>
              <ArrowLeft size={14} />
              {backLabel}
            </Link>

            <motion.article className="cp-payment-panel cp-surface cp-surface--accent" {...revealUp}>
              <div className="cp-payment-header">
                <h2 className="cp-payment-title">Complete your order</h2>
                <p className="cp-payment-subtitle">{paymentSubtitle}</p>
              </div>

              <div className="cp-currency-bar cp-currency-bar--compact cp-surface cp-surface--soft">
                <div>
                  <span className="cp-eyebrow">Payment currency</span>
                  <p className="cp-text-muted">
                    Instructions shown for {currencyConfig.regionLabel}. Switch markets if this order needs another currency.
                  </p>
                </div>

                <label className="cp-currency-select" htmlFor="payment-currency">
                  <Globe2 size={16} />
                  <select
                    id="payment-currency"
                    onChange={handleCurrencyChange}
                    value={currencyCode}
                  >
                    {Object.values(supportedCurrencies).map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="cp-payment-talent-summary">
                <TalentAvatar sizes="62px" talent={orderTalent} />
                <div className="cp-payment-talent-copy">
                  <strong>{orderTitle}</strong>
                  <span>
                    {orderTypeLabel} / {orderTalent.name}
                  </span>
                </div>
                <span className="cp-payment-shield">
                  <Shield size={18} />
                </span>
              </div>

              {orderType === ORDER_TYPES.SHOP ? (
                <div className="cp-payment-content cp-surface cp-surface--soft">
                  <p className="cp-section-label">Contact and shipping</p>
                  <p className="cp-payment-helper">
                    Physical items require a reachable buyer contact and a complete delivery
                    address before fulfillment can begin.
                  </p>

                  <div className="cp-form-grid">
                    <div className="cp-form-grid cp-form-grid--two">
                      <div className="cp-field">
                        <label htmlFor="shop-contact-name">Contact name</label>
                        <input
                          autoComplete="name"
                          disabled={submitted}
                          id="shop-contact-name"
                          onChange={handleShopContactChange('fullName')}
                          placeholder="Full name for this order"
                          type="text"
                          value={normalizedShopContact.fullName}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-contact-email">Contact email</label>
                        <input
                          autoComplete="email"
                          disabled={submitted}
                          id="shop-contact-email"
                          onChange={handleShopContactChange('email')}
                          placeholder="you@example.com"
                          type="email"
                          value={normalizedShopContact.email}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-contact-phone">Phone number</label>
                        <input
                          autoComplete="tel"
                          disabled={submitted}
                          id="shop-contact-phone"
                          onChange={handleShopContactChange('phone')}
                          placeholder="+1 404 555 0182"
                          type="tel"
                          value={normalizedShopContact.phone}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-recipient">Recipient</label>
                        <input
                          autoComplete="shipping name"
                          disabled={submitted}
                          id="shop-shipping-recipient"
                          onChange={handleShippingFieldChange('recipient')}
                          placeholder="Who should receive this package?"
                          type="text"
                          value={normalizedShippingAddress.recipient}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-country">Country</label>
                        <select
                          autoComplete="country"
                          disabled={submitted}
                          id="shop-shipping-country"
                          onChange={handleShippingCountryChange}
                          value={normalizedShippingAddress.countryCode}
                        >
                          <option value="">Select destination country</option>
                          {countryPhoneOptions.map((option) => (
                            <option key={option.code} value={option.code}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-address-1">Address line 1</label>
                        <input
                          autoComplete="shipping address-line1"
                          disabled={submitted}
                          id="shop-shipping-address-1"
                          onChange={handleShippingFieldChange('addressLine1')}
                          placeholder="Street address, house number"
                          type="text"
                          value={normalizedShippingAddress.addressLine1}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-address-2">Address line 2</label>
                        <input
                          autoComplete="shipping address-line2"
                          disabled={submitted}
                          id="shop-shipping-address-2"
                          onChange={handleShippingFieldChange('addressLine2')}
                          placeholder="Apartment, suite, landmark (optional)"
                          type="text"
                          value={normalizedShippingAddress.addressLine2}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-city">City</label>
                        <input
                          autoComplete="shipping address-level2"
                          disabled={submitted}
                          id="shop-shipping-city"
                          onChange={handleShippingFieldChange('city')}
                          placeholder="City"
                          type="text"
                          value={normalizedShippingAddress.city}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-state">State / Province / Region</label>
                        <input
                          autoComplete="shipping address-level1"
                          disabled={submitted}
                          id="shop-shipping-state"
                          onChange={handleShippingFieldChange('stateOrRegion')}
                          placeholder="State, province, or region"
                          type="text"
                          value={normalizedShippingAddress.stateOrRegion}
                        />
                      </div>

                      <div className="cp-field">
                        <label htmlFor="shop-shipping-postal">Postal code</label>
                        <input
                          autoComplete="shipping postal-code"
                          disabled={submitted}
                          id="shop-shipping-postal"
                          onChange={handleShippingFieldChange('postalCode')}
                          placeholder="ZIP / postal code"
                          type="text"
                          value={normalizedShippingAddress.postalCode}
                        />
                      </div>
                    </div>

                    <div className="cp-field">
                      <label htmlFor="shop-shipping-notes">Delivery notes</label>
                      <textarea
                        disabled={submitted}
                        id="shop-shipping-notes"
                        onChange={handleShippingFieldChange('deliveryNotes')}
                        placeholder="Gate code, concierge desk, or delivery timing notes (optional)"
                        value={normalizedShippingAddress.deliveryNotes}
                      />
                    </div>
                  </div>

                  <div className="cp-payment-inline-note" style={{ marginTop: 18 }}>
                    <Shield size={14} />
                    <span>
                      {shopShippingSummary
                        ? `Shipping saved for ${shopShippingSummary}.`
                        : 'These details stay attached to the order for fulfillment and delivery updates.'}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="cp-payment-tabs">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isConfigured = isPaymentMethodConfigured(paymentSettings, tab.id)

                  return (
                    <button
                      key={tab.id}
                      className={`cp-tab-button${resolvedActiveTab === tab.id ? ' is-active' : ''}`}
                      disabled={!isConfigured}
                      onClick={() => isConfigured && setActiveTab(tab.id)}
                      type="button"
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <div className="cp-payment-content cp-surface cp-surface--soft">
                {resolvedActiveTab === PAYMENT_METHODS.BANK && (
                  <div>
                    <p className="cp-section-label">Bank transfer details</p>
                    <p className="cp-payment-helper">
                      {paymentSettings.bank.instructions || 'Transfer the exact amount to the account below and upload your proof of payment.'}
                    </p>

                    {bankDetails.length ? bankDetails.map((detail) => (
                      <div key={detail.id} className="cp-bank-detail">
                        <span className="cp-bank-detail-label">{detail.label}</span>
                        <div className="cp-bank-detail-value">
                          <span>{detail.value}</span>
                          <button
                            className={`cp-copy-btn${copiedField === detail.id ? ' is-copied' : ''}`}
                            onClick={() => handleCopy(detail.value, detail.id)}
                            title="Copy"
                            type="button"
                          >
                            {copiedField === detail.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="cp-payment-inline-note">
                        <Shield size={14} />
                        <span>Bank details have not been added for {currencyCode} yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {resolvedActiveTab === PAYMENT_METHODS.GIFT_CARD && (
                  <div>
                    <p className="cp-section-label">Gift card payment</p>
                    <p className="cp-payment-helper">
                      Enter the gift card code below. Make sure the balance covers the full order amount.
                    </p>

                    {acceptedGiftCards.length ? (
                      <>
                        <label className="cp-payment-field-label" htmlFor="gift-card-brand">
                          Accepted gift card
                        </label>
                        <select
                          className="cp-payment-input"
                          id="gift-card-brand"
                          onChange={(event) => setSelectedGiftCardBrand(event.target.value)}
                          value={resolvedGiftCardBrand}
                        >
                          {acceptedGiftCards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.label}
                            </option>
                          ))}
                        </select>

                        <label className="cp-payment-field-label" htmlFor="gift-code">
                          Gift card code
                        </label>
                        <input
                          className="cp-payment-input"
                          id="gift-code"
                          maxLength={19}
                          onChange={(event) => setGiftCode(event.target.value.toUpperCase())}
                          placeholder="XXXX-XXXX-XXXX-XXXX"
                          type="text"
                          value={giftCode}
                        />

                        <div className="cp-payment-inline-note">
                          <Shield size={14} />
                          <span>{selectedGiftCardLabel || 'Select an accepted gift card'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="cp-payment-inline-note">
                        <Shield size={14} />
                        <span>No gift cards have been added for {currencyCode} yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {resolvedActiveTab === PAYMENT_METHODS.CRYPTO && (
                  <div>
                    <p className="cp-section-label">Cryptocurrency payment</p>
                    <p className="cp-payment-helper">
                      Send the exact amount to the wallet below, then add the transaction hash before submitting.
                    </p>

                    {cryptoAssets.length ? (
                      <>
                        <label className="cp-payment-field-label" htmlFor="crypto-asset">
                          Accepted asset
                        </label>
                        <select
                          className="cp-payment-input"
                          id="crypto-asset"
                          onChange={handleCryptoAssetChange}
                          value={resolvedCryptoAsset}
                        >
                          {cryptoAssets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.label}
                            </option>
                          ))}
                        </select>

                        <label className="cp-payment-field-label" htmlFor="crypto-network">
                          Network
                        </label>
                        <select
                          className="cp-payment-input"
                          id="crypto-network"
                          onChange={(event) => setSelectedCryptoNetwork(event.target.value)}
                          value={resolvedCryptoNetwork}
                        >
                          {selectedCryptoAssetMeta.networks.map((network) => (
                            <option key={network.id} value={network.id}>
                              {network.label}
                            </option>
                          ))}
                        </select>

                        <div className="cp-qr-placeholder">
                          <Wallet className="cp-qr-placeholder-icon" size={40} />
                          <span className="cp-qr-placeholder-text">
                            {selectedCryptoAssetMeta.label || 'Crypto'}
                          </span>
                        </div>

                        <div className="cp-bank-detail">
                          <span className="cp-bank-detail-label">Wallet address</span>
                          <div className="cp-bank-detail-value">
                            <span>{maskWallet(selectedCryptoNetworkMeta.wallet)}</span>
                            <button
                              className={`cp-copy-btn${copiedField === 'wallet' ? ' is-copied' : ''}`}
                              onClick={() => handleCopy(selectedCryptoNetworkMeta.wallet, 'wallet')}
                              title="Copy wallet address"
                              type="button"
                            >
                              {copiedField === 'wallet' ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        <div className="cp-bank-detail">
                          <span className="cp-bank-detail-label">Network</span>
                          <div className="cp-bank-detail-value">
                            <span>{selectedCryptoNetworkMeta.label}</span>
                          </div>
                        </div>

                        <label className="cp-payment-field-label" htmlFor="crypto-hash">
                          Transaction hash
                        </label>
                        <input
                          className="cp-payment-input"
                          id="crypto-hash"
                          onChange={(event) => setCryptoHash(event.target.value.trim())}
                          placeholder="Paste the transaction hash"
                          type="text"
                          value={cryptoHash}
                        />
                      </>
                    ) : (
                      <div className="cp-payment-inline-note">
                        <Shield size={14} />
                        <span>No crypto wallets have been added for {currencyCode} yet.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="cp-order-line-list">
                {orderItems.map((item, index) => (
                  <div key={item.lineId ?? item.id ?? `${item.title}-${index}`} className="cp-order-line">
                    <div className="cp-order-line-meta">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle || getOrderContextLabel(order)}</span>
                    </div>
                    <div className="cp-order-line-meta cp-order-line-meta--price">
                      <strong>{item.quantity} x {formatCurrency(item.unitPrice)}</strong>
                      <span>{formatCurrency(item.totalPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cp-upload-block">
                <p className="cp-section-label">Upload proof of payment</p>
                <div
                  className={`cp-upload-zone${uploadedFile ? ' has-file' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {uploadedFile ? (
                    <div className="cp-upload-file">
                      <Check size={18} />
                      <span>{uploadedFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="cp-upload-icon" size={24} />
                      <p className="cp-upload-text">Click to upload or drag and drop</p>
                      <p className="cp-upload-subtext">PNG, JPG, or PDF up to 10MB</p>
                    </div>
                  )}
                  <input
                    accept=".png,.jpg,.jpeg,.pdf"
                    hidden
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
              </div>

              <div className="cp-ref-code-display">
                <div>
                  <span className="cp-ref-code-label">Your reference</span>
                  <span className="cp-ref-code-text">{referencePrefix}-{referenceCode}</span>
                </div>
                <button
                  className={`cp-copy-btn${copiedField === 'reference' ? ' is-copied' : ''}`}
                  onClick={() => handleCopy(`${referencePrefix}-${referenceCode}`, 'reference')}
                  title="Copy reference"
                  type="button"
                >
                  {copiedField === 'reference' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              <div className="cp-confirm-row">
                <input
                  checked={confirmed}
                  className="cp-confirm-checkbox"
                  id="confirm-payment"
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <label className="cp-confirm-label" htmlFor="confirm-payment">
                  I confirm that I have sent the payment and that the proof uploaded here is accurate.
                </label>
              </div>

              <button
                className={`cp-submit-payment${proofReady && !submitted ? ' is-enabled' : ''}`}
                disabled={!proofReady || submitted}
                onClick={handleSubmit}
                type="button"
              >
                {submitted ? 'Payment Submitted' : 'Submit Payment'}
              </button>

              <p className="cp-payment-note">
                Payments are usually reviewed within 30 minutes. Once approved, your account will
                continue tracking this order under {orderTalent.name}.
              </p>
            </motion.article>
          </div>

            <aside className="cp-sticky-stack">
              <motion.div className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
                <span className="cp-eyebrow">Order status</span>
                <h3>{orderTitle}</h3>
                <p className="cp-text-muted">
                  {orderTalent.name} / {orderTypeLabel}
                </p>

                <div style={{ marginTop: 18 }}>
                  <StatusBadge status={order.status ?? ORDER_STATUS.PENDING_PAYMENT} />
                </div>

                <div className="cp-price-row">
                  <div>
                    <strong>{formatCurrency(totalPrice)}</strong>
                    <span>order amount</span>
                  </div>
                  <span>{referencePrefix}-{referenceCode}</span>
                </div>

                <ul className="cp-checklist">
                  {orderSummaryPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>

                {!submitted && (
                  <div className="cp-timer">
                    <Clock3 size={16} />
                    Payment window
                    <strong>{formatCountdown(countdown)}</strong>
                  </div>
                )}
              </motion.div>
            </aside>
          </div>

        </div>
      </section>
    </PageWrapper>
  )
}
