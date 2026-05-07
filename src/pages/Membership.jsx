import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Gift,
  Globe2,
  LockKeyhole,
  Upload,
  Wallet,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import BillingCycleToggle from '../components/membership/BillingCycleToggle'
import PageWrapper from '../components/layout/PageWrapper'
import StatusBadge from '../components/ui/StatusBadge'
import {
  getMembershipPlanById,
  getMembershipPriceLabel,
  getMembershipPriceUsd,
  isValidMembershipBillingCycle,
  membershipPlans,
} from '../data/membershipPlans'
import { useCurrencyPaymentSettings } from '../hooks/useCurrencyPaymentSettings'
import { useAuth } from '../hooks/useAuth'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import {
  getLatestMembershipRequest,
  refreshMembershipQueue,
  submitMembershipRequest,
  subscribeToMembershipUpdates,
} from '../services/membershipService'
import {
  findCryptoAssetById,
  isPaymentMethodConfigured,
} from '../services/paymentSettingsService'
import {
  uploadPaymentProofFile,
  validatePaymentProofFile,
} from '../services/storageService'
import { supportedCurrencies } from '../utils/currency'
import {
  MEMBERSHIP_BILLING_CYCLES,
  MEMBERSHIP_PLANS,
  MEMBERSHIP_STATUS,
  PAYMENT_METHODS,
} from '../utils/constants'
import { formatCurrency, formatDate, maskWallet, timeAgo } from '../utils/formatters'
import {
  getBillingCycleLabel,
  getMembershipScopeCopy,
  getMembershipSelectionLabel,
} from '../utils/memberships'
import { revealUp } from '../utils/motion'

const PAYMENT_TABS = [
  { id: PAYMENT_METHODS.BANK, label: 'Bank Transfer', icon: CreditCard },
  { id: PAYMENT_METHODS.GIFT_CARD, label: 'Gift Card', icon: Gift },
  { id: PAYMENT_METHODS.CRYPTO, label: 'Cryptocurrency', icon: Wallet },
]

const paidPlans = membershipPlans.filter((plan) => plan.id !== MEMBERSHIP_PLANS.FREE)

const renderMembershipPlanBody = ({ billingCycle, currencyCode, isSelected, plan }) => {
  const planPriceUsd = getMembershipPriceUsd(plan.id, billingCycle)

  return (
    <>
      <div className="cp-plan-card-top">
        <span className="cp-eyebrow">{plan.eyebrow}</span>
        <div className="cp-plan-card-top-meta">
          {isSelected ? <span className="cp-plan-badge">Selected</span> : null}
        </div>
      </div>

      <h3>{plan.name}</h3>
      <p className="cp-text-muted">{plan.summary}</p>

      <div className="cp-plan-price">
        <strong>{formatCurrency(planPriceUsd, currencyCode)}</strong>
        <span>{getMembershipPriceLabel(billingCycle)}</span>
      </div>
    </>
  )
}

export default function Membership() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    currentPlan,
    currentPlanBillingCycleLabel,
    currentPlanLabel,
    hasPlan,
    unlockedTalentIds,
    user,
  } = useAuth()
  const { showToast } = useToast()
  const talentRoster = useTalentRoster()
  const { currencyCode, currencyConfig, paymentSettings, setCurrencyCode } = useCurrencyPaymentSettings()
  const fileInputRef = useRef(null)
  const [selectedPlan, setSelectedPlan] = useState(() => {
    const requestedPlan = searchParams.get('plan')
    return paidPlans.some((plan) => plan.id === requestedPlan)
      ? requestedPlan
      : currentPlan !== MEMBERSHIP_PLANS.FREE
        ? currentPlan
        : MEMBERSHIP_PLANS.INNER_CIRCLE
  })
  const [billingCycle, setBillingCycle] = useState(() => {
    const requestedCycle = searchParams.get('cycle')
    return isValidMembershipBillingCycle(requestedCycle)
      ? requestedCycle
      : MEMBERSHIP_BILLING_CYCLES.MONTHLY
  })
  const [selectedTalentId, setSelectedTalentId] = useState(() => {
    const requestedTalent = searchParams.get('talent')
    return requestedTalent ?? String(unlockedTalentIds[0] ?? talentRoster[0]?.id ?? '')
  })
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.BANK)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [proofSummary, setProofSummary] = useState('')
  const acceptedGiftCards = paymentSettings.giftCards
  const cryptoAssets = paymentSettings.cryptoAssets
  const [giftCardCode, setGiftCardCode] = useState('')
  const [selectedGiftCardBrand, setSelectedGiftCardBrand] = useState(
    acceptedGiftCards[0]?.id || '',
  )
  const [cryptoHash, setCryptoHash] = useState('')
  const [selectedCryptoAsset, setSelectedCryptoAsset] = useState(
    cryptoAssets[0]?.id || '',
  )
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState(
    cryptoAssets[0]?.networks[0]?.id || '',
  )
  const [confirmed, setConfirmed] = useState(false)
  const [copiedField, setCopiedField] = useState(null)
  const [submittedRequest, setSubmittedRequest] = useState(null)
  const defaultInnerCircleTalentId = String(unlockedTalentIds[0] ?? talentRoster[0]?.id ?? '')
  const resolvedSelectedTalentId =
    selectedPlan !== MEMBERSHIP_PLANS.INNER_CIRCLE ||
    talentRoster.some((talent) => String(talent.id) === String(selectedTalentId))
      ? selectedTalentId
      : defaultInnerCircleTalentId
  const latestRequest = user
    ? submittedRequest?.userId === Number(user.id)
      ? submittedRequest
      : getLatestMembershipRequest(user.id)
    : null
  const hasPendingRequest = latestRequest?.status === MEMBERSHIP_STATUS.UNDER_REVIEW
  const selectedPlanMeta = getMembershipPlanById(selectedPlan)
  const selectedPlanPriceUsd = getMembershipPriceUsd(selectedPlan, billingCycle)
  const unlockedCount = currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS ? talentRoster.length : unlockedTalentIds.length
  const resolvedPaymentMethod =
    isPaymentMethodConfigured(paymentSettings, paymentMethod)
      ? paymentMethod
      : PAYMENT_TABS.find((tab) => isPaymentMethodConfigured(paymentSettings, tab.id))?.id ??
        PAYMENT_METHODS.BANK
  const resolvedGiftCardBrand =
    acceptedGiftCards.some((card) => card.id === selectedGiftCardBrand)
      ? selectedGiftCardBrand
      : acceptedGiftCards[0]?.id || ''
  const resolvedSelectedGiftCardLabel =
    acceptedGiftCards.find((card) => card.id === resolvedGiftCardBrand)?.label
  const resolvedCryptoAssetMeta =
    (selectedCryptoAsset && cryptoAssets.some((asset) => asset.id === selectedCryptoAsset)
      ? findCryptoAssetById(cryptoAssets, selectedCryptoAsset)
      : cryptoAssets.find((asset) => asset.networks.length > 0) ?? cryptoAssets[0]) ?? {
      id: '',
      label: '',
      networks: [],
    }
  const resolvedCryptoAsset = resolvedCryptoAssetMeta.id
  const resolvedCryptoNetworkMeta =
    resolvedCryptoAssetMeta.networks.find((network) => network.id === selectedCryptoNetwork) ??
    resolvedCryptoAssetMeta.networks[0] ?? {
      id: '',
      label: 'No network configured',
      wallet: '',
    }
  const resolvedCryptoNetwork = resolvedCryptoNetworkMeta.id
  const membershipBankDetails = [
    ...paymentSettings.bank.details,
    {
      id: 'membership-reference',
      label: 'Reference / note',
      value: `${paymentSettings.bank.referencePrefix || 'CP'}-${selectedPlanMeta?.name?.replace(/\s+/g, '-').toUpperCase() || 'MEMBERSHIP'}-${user?.id ?? 'NEW'}`,
    },
  ].filter((detail) => detail.value)
  const activeMethodConfigured = isPaymentMethodConfigured(paymentSettings, resolvedPaymentMethod)
  const proofReady =
    activeMethodConfigured &&
    !!uploadedFile &&
    confirmed &&
    (resolvedPaymentMethod !== PAYMENT_METHODS.GIFT_CARD || (resolvedGiftCardBrand && giftCardCode.trim())) &&
    (resolvedPaymentMethod !== PAYMENT_METHODS.CRYPTO ||
      (resolvedCryptoAsset && resolvedCryptoNetwork && cryptoHash.trim()))

  const handleCurrencyChange = (event) => {
    setCurrencyCode(event.target.value)
  }

  useEffect(() => {
    if (!user) {
      return undefined
    }

    const syncLatestRequest = () => setSubmittedRequest(getLatestMembershipRequest(user.id))
    refreshMembershipQueue()
      .then(syncLatestRequest)
      .catch((error) => {
        showToast(error.message || 'We could not refresh your membership status right now.', 'warning')
      })
    return subscribeToMembershipUpdates(syncLatestRequest)
  }, [showToast, user])

  const syncSearchParams = ({
    nextPlan = selectedPlan,
    nextBillingCycle = billingCycle,
    nextTalentId = resolvedSelectedTalentId,
  } = {}) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('plan', nextPlan)
    nextParams.set('cycle', nextBillingCycle)

    if (nextPlan === MEMBERSHIP_PLANS.INNER_CIRCLE && nextTalentId) {
      nextParams.set('talent', nextTalentId)
    } else {
      nextParams.delete('talent')
    }

    setSearchParams(nextParams, { replace: true })
  }

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId)
    syncSearchParams({ nextPlan: planId })
  }

  const handleBillingCycleChange = (nextBillingCycle) => {
    setBillingCycle(nextBillingCycle)
    syncSearchParams({ nextBillingCycle })
  }

  const handleTalentChange = (event) => {
    const nextTalentId = event.target.value
    setSelectedTalentId(nextTalentId)
    syncSearchParams({ nextTalentId })
  }

  const handlePlanCardKeyDown = (event, planId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handlePlanSelect(planId)
    }
  }

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 2000)
    } catch {
      showToast('Copy was blocked on this browser. Try again manually.', 'warning')
    }
  }

  const handleUpload = (event) => {
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

  const handleSubmit = async () => {
    if (!user) {
      showToast('Sign in before applying for a membership.', 'warning')
      return
    }

    if (hasPendingRequest) {
      showToast('Your last membership request is still under review.', 'warning')
      return
    }

    if (!activeMethodConfigured) {
      showToast('This payment method is not configured for the selected currency yet.', 'warning')
      return
    }

    if (selectedPlan === MEMBERSHIP_PLANS.INNER_CIRCLE && !selectedTalentId) {
      showToast('Choose the talent you want unlocked first.', 'warning')
      return
    }

    if (!uploadedFile) {
      showToast('Upload proof before sending your membership request.', 'warning')
      return
    }

    if (resolvedPaymentMethod === PAYMENT_METHODS.GIFT_CARD && !resolvedGiftCardBrand) {
      showToast('Choose the gift card brand before you continue.', 'warning')
      return
    }

    if (resolvedPaymentMethod === PAYMENT_METHODS.GIFT_CARD && !giftCardCode.trim()) {
      showToast('Enter the gift card code before you continue.', 'warning')
      return
    }

    if (resolvedPaymentMethod === PAYMENT_METHODS.CRYPTO && (!resolvedCryptoAsset || !resolvedCryptoNetwork)) {
      showToast('Choose the crypto asset and network before you continue.', 'warning')
      return
    }

    if (resolvedPaymentMethod === PAYMENT_METHODS.CRYPTO && !cryptoHash.trim()) {
      showToast('Add the transaction hash before you continue.', 'warning')
      return
    }

    if (!confirmed) {
      showToast('Confirm that your membership proof is accurate before submitting.', 'warning')
      return
    }

    const paymentSummary =
      resolvedPaymentMethod === PAYMENT_METHODS.GIFT_CARD
        ? `${resolvedSelectedGiftCardLabel} / code ${giftCardCode.trim()}`
        : resolvedPaymentMethod === PAYMENT_METHODS.CRYPTO
          ? `${resolvedCryptoAssetMeta.label} / ${resolvedCryptoNetworkMeta.label} / hash ${cryptoHash.trim()}`
          : `Bank transfer proof uploaded as ${uploadedFile.name}`

    try {
      const proofUpload = await uploadPaymentProofFile({
        file: uploadedFile,
        category: 'membership',
        ownerKey: user.authUserId || 'guest',
      })
      const request = await submitMembershipRequest({
        userId: user.id,
        plan: selectedPlan,
        billingCycle,
        talentId: selectedPlan === MEMBERSHIP_PLANS.INNER_CIRCLE ? resolvedSelectedTalentId : null,
        paymentMethod: resolvedPaymentMethod,
        proofFileName: proofUpload.fileName,
        proofUpload,
        proofSummary: proofSummary.trim()
          ? `${paymentSummary}. ${proofSummary.trim()}`
          : paymentSummary,
        currencyCode,
      })

      setSubmittedRequest(request)
      showToast('Membership request submitted for review.', 'success')
    } catch (error) {
      showToast(error.message || 'We could not submit your membership request right now.', 'warning')
    }
  }

  return (
    <PageWrapper className="cp-page--membership">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Membership application</span>
            <h1 className="cp-page-title">
              Apply for membership and unlock a more <em>personal connection.</em>
            </h1>
            <p className="cp-page-intro">
              Select your plan, choose a payment method, and submit proof for review. We will
              confirm your access as soon as it is approved.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 16 }}>
        <div className="cp-container">
          <div className="cp-membership-layout">
            <div className="cp-step-stack">
            <Link className="cp-payment-backlink" to="/pricing">
              <ArrowLeft size={14} />
              Back to pricing
            </Link>

            <motion.article className="cp-payment-panel cp-surface cp-surface--accent" {...revealUp}>
              <div className="cp-payment-header">
                <h2 className="cp-payment-title">Select your membership</h2>
                <p className="cp-payment-subtitle">
                  Regional pricing is shown automatically, and every application is reviewed with
                  care before access is activated.
                </p>
              </div>

              <div className="cp-currency-bar cp-currency-bar--compact cp-surface cp-surface--soft">
                <div>
                  <span className="cp-eyebrow">Display currency</span>
                  <p className="cp-text-muted">
                    Auto-detected for {currencyConfig.regionLabel}. Change it if you need another market.
                  </p>
                </div>

                <label className="cp-currency-select" htmlFor="membership-currency">
                  <Globe2 size={16} />
                  <select
                    id="membership-currency"
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

              <div className="cp-plan-grid-shell">
                <BillingCycleToggle billingCycle={billingCycle} onChange={handleBillingCycleChange} />

                <div className="cp-plan-grid cp-plan-grid--compact">
                {paidPlans.map((plan) => {
                  const isSelected = selectedPlan === plan.id

                  return (
                    <article
                      key={plan.id}
                      aria-pressed={isSelected}
                      className={`cp-plan-card cp-plan-card--${plan.tone} cp-plan-card--flip${isSelected ? ' is-selected' : ''}${billingCycle === MEMBERSHIP_BILLING_CYCLES.YEARLY ? ' is-flipped' : ''}`}
                      onClick={() => handlePlanSelect(plan.id)}
                      onKeyDown={(event) => handlePlanCardKeyDown(event, plan.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="cp-plan-card-stage">
                        <div className="cp-plan-card-face cp-surface">
                          {renderMembershipPlanBody({
                            billingCycle: MEMBERSHIP_BILLING_CYCLES.MONTHLY,
                            currencyCode,
                            isSelected,
                            plan,
                          })}
                        </div>

                        <div className="cp-plan-card-face cp-plan-card-face--back cp-surface">
                          {renderMembershipPlanBody({
                            billingCycle: MEMBERSHIP_BILLING_CYCLES.YEARLY,
                            currencyCode,
                            isSelected,
                            plan,
                          })}
                        </div>
                      </div>
                    </article>
                  )
                })}
                </div>
              </div>

              {selectedPlan === MEMBERSHIP_PLANS.INNER_CIRCLE ? (
                <div className="cp-membership-field">
                  <label className="cp-payment-field-label" htmlFor="inner-circle-talent">
                    Select the talent for your Inner Circle access
                  </label>
                  <select
                    className="cp-payment-input"
                    id="inner-circle-talent"
                    onChange={handleTalentChange}
                    value={resolvedSelectedTalentId}
                  >
                    {talentRoster.map((talent) => (
                      <option key={talent.id} value={talent.id}>
                        {talent.name} - {talent.category}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="cp-membership-field">
                <p className="cp-section-label">Included with {selectedPlanMeta.name}</p>
                <ul className="cp-checklist">
                  {selectedPlanMeta.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="cp-payment-tabs" style={{ marginTop: 24 }}>
                {PAYMENT_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isConfigured = isPaymentMethodConfigured(paymentSettings, tab.id)

                  return (
                    <button
                      key={tab.id}
                      className={`cp-tab-button${resolvedPaymentMethod === tab.id ? ' is-active' : ''}`}
                      disabled={!isConfigured}
                      onClick={() => isConfigured && setPaymentMethod(tab.id)}
                      type="button"
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <div className="cp-payment-content cp-surface cp-surface--soft">
                {resolvedPaymentMethod === PAYMENT_METHODS.BANK ? (
                  <div>
                    <p className="cp-section-label">Bank transfer details</p>
                    <p className="cp-payment-helper">
                      {paymentSettings.bank.instructions || 'Include the transfer reference or sender note so we can match your payment quickly.'}
                    </p>

                    {membershipBankDetails.length ? membershipBankDetails.map((detail) => (
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
                        <CreditCard size={14} />
                        <span>Bank details have not been added for {currencyCode} yet.</span>
                      </div>
                    )}
                  </div>
                ) : null}

                {resolvedPaymentMethod === PAYMENT_METHODS.GIFT_CARD ? (
                  <div>
                    <p className="cp-section-label">Gift card payment</p>
                    <p className="cp-payment-helper">
                      Choose the accepted gift card brand, then add the code you are submitting for review.
                    </p>

                    {acceptedGiftCards.length ? (
                      <>
                        <label className="cp-payment-field-label" htmlFor="membership-gift-card">
                          Accepted gift card
                        </label>
                        <select
                          className="cp-payment-input"
                          id="membership-gift-card"
                          onChange={(event) => setSelectedGiftCardBrand(event.target.value)}
                          value={resolvedGiftCardBrand}
                        >
                          {acceptedGiftCards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.label}
                            </option>
                          ))}
                        </select>

                        <label className="cp-payment-field-label" htmlFor="membership-gift-code">
                          Gift card code
                        </label>
                        <input
                          className="cp-payment-input"
                          id="membership-gift-code"
                          maxLength={19}
                          onChange={(event) => setGiftCardCode(event.target.value.toUpperCase())}
                          placeholder="XXXX-XXXX-XXXX-XXXX"
                          type="text"
                          value={giftCardCode}
                        />
                      </>
                    ) : (
                      <div className="cp-payment-inline-note">
                        <Gift size={14} />
                        <span>No gift cards have been added for {currencyCode} yet.</span>
                      </div>
                    )}
                  </div>
                ) : null}

                {resolvedPaymentMethod === PAYMENT_METHODS.CRYPTO ? (
                  <div>
                    <p className="cp-section-label">Cryptocurrency payment</p>
                    <p className="cp-payment-helper">
                      Choose the asset, choose the network, then add the transaction hash for the membership desk.
                    </p>

                    {cryptoAssets.length ? (
                      <>
                        <label className="cp-payment-field-label" htmlFor="membership-crypto-asset">
                          Accepted asset
                        </label>
                        <select
                          className="cp-payment-input"
                          id="membership-crypto-asset"
                          onChange={handleCryptoAssetChange}
                          value={resolvedCryptoAsset}
                        >
                          {cryptoAssets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.label}
                            </option>
                          ))}
                        </select>

                        <label className="cp-payment-field-label" htmlFor="membership-crypto-network">
                          Network
                        </label>
                        <select
                          className="cp-payment-input"
                          id="membership-crypto-network"
                          onChange={(event) => setSelectedCryptoNetwork(event.target.value)}
                          value={resolvedCryptoNetwork}
                        >
                          {resolvedCryptoAssetMeta.networks.map((network) => (
                            <option key={network.id} value={network.id}>
                              {network.label}
                            </option>
                          ))}
                        </select>

                        <div className="cp-bank-detail">
                          <span className="cp-bank-detail-label">Wallet address</span>
                          <div className="cp-bank-detail-value">
                            <span>{maskWallet(resolvedCryptoNetworkMeta.wallet)}</span>
                            <button
                              className={`cp-copy-btn${copiedField === 'membership-wallet' ? ' is-copied' : ''}`}
                              onClick={() => handleCopy(resolvedCryptoNetworkMeta.wallet, 'membership-wallet')}
                              title="Copy wallet address"
                              type="button"
                            >
                              {copiedField === 'membership-wallet' ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        <label className="cp-payment-field-label" htmlFor="membership-crypto-hash">
                          Transaction hash
                        </label>
                        <input
                          className="cp-payment-input"
                          id="membership-crypto-hash"
                          onChange={(event) => setCryptoHash(event.target.value.trim())}
                          placeholder="Paste the transaction hash"
                          type="text"
                          value={cryptoHash}
                        />
                      </>
                    ) : (
                      <div className="cp-payment-inline-note">
                        <Wallet size={14} />
                        <span>No crypto wallets have been added for {currencyCode} yet.</span>
                      </div>
                    )}
                  </div>
                ) : null}

                <label className="cp-payment-field-label" htmlFor="membership-proof-note">
                  Payment note
                </label>
                <textarea
                  className="cp-chat-compose-textarea"
                  id="membership-proof-note"
                  onChange={(event) => setProofSummary(event.target.value)}
                  placeholder="Example: Sent from the same account used for my previous renewal."
                  value={proofSummary}
                />
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
                    onChange={handleUpload}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
              </div>

              <div className="cp-confirm-row">
                <input
                  checked={confirmed}
                  className="cp-confirm-checkbox"
                  id="confirm-membership"
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <label className="cp-confirm-label" htmlFor="confirm-membership">
                  I confirm that this membership payment proof is accurate and ready for review.
                </label>
              </div>

              <button
                className={`cp-submit-payment${proofReady && !hasPendingRequest ? ' is-enabled' : ''}`}
                disabled={!proofReady || hasPendingRequest}
                onClick={handleSubmit}
                type="button"
              >
                {hasPendingRequest ? 'Membership Under Review' : 'Submit Membership Application'}
              </button>
            </motion.article>
            </div>

            <aside className="cp-sticky-stack">
              <motion.div className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
                <span className="cp-eyebrow">Current access</span>
                <h3>{currentPlanLabel}</h3>
                <p className="cp-text-muted">
                  {getMembershipScopeCopy(user, unlockedCount)}
                </p>

                <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                  <span className="cp-chip">
                    <LockKeyhole size={14} />
                    {hasPlan ? 'Membership active' : 'Free account'}
                  </span>
                  {hasPlan && currentPlanBillingCycleLabel ? (
                    <span className="cp-chip">{currentPlanBillingCycleLabel} billing</span>
                  ) : null}
                  {user?.planExpiry ? (
                    <span className="cp-chip">Ends {formatDate(user.planExpiry)}</span>
                  ) : null}
                </div>

                <div className="cp-price-row">
                  <div>
                    <strong>{formatCurrency(selectedPlanPriceUsd, currencyCode)}</strong>
                    <span>
                      {selectedPlanMeta.name} / {getMembershipPriceLabel(billingCycle)}
                    </span>
                  </div>
                  <span>{currencyConfig.code}</span>
                </div>

                <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                  <span className="cp-chip">{getBillingCycleLabel(billingCycle)} billing selected</span>
                  {billingCycle === MEMBERSHIP_BILLING_CYCLES.YEARLY ? (
                    <span className="cp-chip">20% yearly savings applied</span>
                  ) : null}
                </div>
              </motion.div>

              {latestRequest ? (
                <motion.div className="cp-info-card cp-surface" {...revealUp}>
                  <span className="cp-eyebrow">Latest request</span>
                  <h3>{getMembershipSelectionLabel(latestRequest.plan, latestRequest.billingCycle)}</h3>
                  <p className="cp-text-muted">
                    {latestRequest.talentName} / submitted {timeAgo(latestRequest.submittedAt)}
                  </p>
                  <div style={{ marginTop: 18 }}>
                    <StatusBadge status={latestRequest.status} />
                  </div>
                  <ul className="cp-list" style={{ marginTop: 18 }}>
                    <li>{formatCurrency(latestRequest.amountUsd, latestRequest.currencyCode)}</li>
                    <li>{getBillingCycleLabel(latestRequest.billingCycle) || 'Monthly'} billing</li>
                    <li>{latestRequest.region}</li>
                    <li>{latestRequest.proofSummary}</li>
                    <li>{latestRequest.proofFileName}</li>
                  </ul>
                </motion.div>
              ) : null}
            </aside>
          </div>

        </div>
      </section>
    </PageWrapper>
  )
}
