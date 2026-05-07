import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import {
  getPaymentSettingsForCurrency,
  getPaymentSettingsMetaForCurrency,
  resetPaymentSettingsForCurrency,
  subscribeToPaymentSettings,
  updatePaymentSettingsForCurrency,
} from '../../services/paymentSettingsService'
import { formatDate, maskWallet, timeAgo } from '../../utils/formatters'
import { supportedCurrencies } from '../../utils/currency'
import { revealUp } from '../../utils/motion'

const SETTINGS_GRID_STYLE = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const SETTINGS_ROW_STYLE = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) auto',
  alignItems: 'end',
}

const SETTINGS_TWO_COLUMN_STYLE = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const PREVIEW_GRID_STYLE = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const PREVIEW_CARD_STYLE = {
  padding: 20,
  display: 'grid',
  gap: 12,
  alignContent: 'start',
}

const PREVIEW_LIST_STYLE = {
  display: 'grid',
  gap: 12,
}

const STATUS_PANEL_STYLE = {
  display: 'grid',
  gap: 6,
  padding: 16,
  marginTop: 16,
  borderRadius: 20,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(255, 255, 255, 0.03)',
}

const SECTION_FOOTER_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const PAYMENT_SETTINGS_DRAFTS_KEY = 'crownpoint_payment_settings_admin_drafts'

const clonePaymentSettings = (settings) => JSON.parse(JSON.stringify(settings))

const hasVisibleText = (value) => String(value ?? '').trim().length > 0

const readPaymentSettingsDrafts = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  const storedDrafts = window.sessionStorage.getItem(PAYMENT_SETTINGS_DRAFTS_KEY)

  if (!storedDrafts) {
    return {}
  }

  try {
    const parsedDrafts = JSON.parse(storedDrafts)
    return parsedDrafts && typeof parsedDrafts === 'object' ? parsedDrafts : {}
  } catch {
    window.sessionStorage.removeItem(PAYMENT_SETTINGS_DRAFTS_KEY)
    return {}
  }
}

const getPaymentSettingsDraftForCurrency = (currencyCode) =>
  readPaymentSettingsDrafts()[currencyCode] ?? null

const writePaymentSettingsDraftForCurrency = (currencyCode, settings) => {
  if (typeof window === 'undefined') {
    return
  }

  const drafts = readPaymentSettingsDrafts()
  drafts[currencyCode] = settings
  window.sessionStorage.setItem(PAYMENT_SETTINGS_DRAFTS_KEY, JSON.stringify(drafts))
}

const clearPaymentSettingsDraftForCurrency = (currencyCode) => {
  if (typeof window === 'undefined') {
    return
  }

  const drafts = readPaymentSettingsDrafts()
  delete drafts[currencyCode]

  if (Object.keys(drafts).length) {
    window.sessionStorage.setItem(PAYMENT_SETTINGS_DRAFTS_KEY, JSON.stringify(drafts))
    return
  }

  window.sessionStorage.removeItem(PAYMENT_SETTINGS_DRAFTS_KEY)
}

const getInitialDraftForCurrency = (currencyCode) =>
  getPaymentSettingsDraftForCurrency(currencyCode) ?? getPaymentSettingsForCurrency(currencyCode)

const createDraftId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createEmptyBankField = () => ({
  id: createDraftId('bank-field'),
  label: '',
  value: '',
})

const createEmptyGiftCard = () => ({
  id: createDraftId('gift-card'),
  label: '',
})

const createEmptyCryptoNetwork = () => ({
  id: createDraftId('network'),
  label: '',
  wallet: '',
})

const createEmptyCryptoAsset = () => ({
  id: createDraftId('asset'),
  label: '',
  networks: [createEmptyCryptoNetwork()],
})

const SETTINGS_EDITOR_TABS = [
  { id: 'bank', label: 'Bank', icon: CreditCard },
  { id: 'crypto', label: 'Crypto', icon: Wallet },
  { id: 'gift', label: 'Gift Cards', icon: Gift },
]

export default function PaymentSettingsDesk({ currencyCode, onCurrencyChange }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [savedPaymentSettings, setSavedPaymentSettings] = useState(() =>
    getPaymentSettingsForCurrency(currencyCode),
  )
  const [paymentSettingsDraft, setPaymentSettingsDraft] = useState(() =>
    clonePaymentSettings(getInitialDraftForCurrency(currencyCode)),
  )
  const [publishedMeta, setPublishedMeta] = useState(() =>
    getPaymentSettingsMetaForCurrency(currencyCode),
  )
  const [savingAction, setSavingAction] = useState('')
  const [settingsSection, setSettingsSection] = useState('bank')
  const hasUnsavedSettings =
    JSON.stringify(paymentSettingsDraft) !== JSON.stringify(savedPaymentSettings)
  const isSaving = Boolean(savingAction)

  useEffect(() => {
    const syncSettings = () => {
      const nextSettings = getPaymentSettingsForCurrency(currencyCode)
      const nextDraft = getInitialDraftForCurrency(currencyCode)

      setSavedPaymentSettings(nextSettings)
      setPaymentSettingsDraft(clonePaymentSettings(nextDraft))
      setPublishedMeta(getPaymentSettingsMetaForCurrency(currencyCode))
    }

    syncSettings()
    return subscribeToPaymentSettings(syncSettings)
  }, [currencyCode])

  useEffect(() => {
    if (!hasUnsavedSettings) {
      clearPaymentSettingsDraftForCurrency(currencyCode)
      return
    }

    writePaymentSettingsDraftForCurrency(currencyCode, paymentSettingsDraft)
  }, [currencyCode, hasUnsavedSettings, paymentSettingsDraft])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasUnsavedSettings) {
      return undefined
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedSettings])

  const updateDraft = (updater) => {
    setPaymentSettingsDraft((currentDraft) => updater(clonePaymentSettings(currentDraft)))
  }

  const handleCurrencySelectionChange = (event) => {
    setSettingsSection('bank')
    onCurrencyChange(event.target.value)
  }

  const handleBankMetaChange = (field, value) => {
    updateDraft((draft) => ({
      ...draft,
      bank: {
        ...draft.bank,
        [field]: value,
      },
    }))
  }

  const handleBankDetailChange = (detailId, field, value) => {
    updateDraft((draft) => ({
      ...draft,
      bank: {
        ...draft.bank,
        details: draft.bank.details.map((detail) =>
          detail.id === detailId ? { ...detail, [field]: value } : detail,
        ),
      },
    }))
  }

  const handleAddBankField = () => {
    updateDraft((draft) => ({
      ...draft,
      bank: {
        ...draft.bank,
        details: [...draft.bank.details, createEmptyBankField()],
      },
    }))
  }

  const handleRemoveBankField = (detailId) => {
    updateDraft((draft) => ({
      ...draft,
      bank: {
        ...draft.bank,
        details: draft.bank.details.filter((detail) => detail.id !== detailId),
      },
    }))
  }

  const handleGiftCardChange = (cardId, value) => {
    updateDraft((draft) => ({
      ...draft,
      giftCards: draft.giftCards.map((card) =>
        card.id === cardId ? { ...card, label: value } : card,
      ),
    }))
  }

  const handleAddGiftCard = () => {
    updateDraft((draft) => ({
      ...draft,
      giftCards: [...draft.giftCards, createEmptyGiftCard()],
    }))
  }

  const handleRemoveGiftCard = (cardId) => {
    updateDraft((draft) => ({
      ...draft,
      giftCards: draft.giftCards.filter((card) => card.id !== cardId),
    }))
  }

  const handleCryptoAssetChange = (assetId, field, value) => {
    updateDraft((draft) => ({
      ...draft,
      cryptoAssets: draft.cryptoAssets.map((asset) =>
        asset.id === assetId ? { ...asset, [field]: value } : asset,
      ),
    }))
  }

  const handleAddCryptoAsset = () => {
    updateDraft((draft) => ({
      ...draft,
      cryptoAssets: [...draft.cryptoAssets, createEmptyCryptoAsset()],
    }))
  }

  const handleRemoveCryptoAsset = (assetId) => {
    updateDraft((draft) => ({
      ...draft,
      cryptoAssets: draft.cryptoAssets.filter((asset) => asset.id !== assetId),
    }))
  }

  const handleCryptoNetworkChange = (assetId, networkId, field, value) => {
    updateDraft((draft) => ({
      ...draft,
      cryptoAssets: draft.cryptoAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              networks: asset.networks.map((network) =>
                network.id === networkId ? { ...network, [field]: value } : network,
              ),
            }
          : asset,
      ),
    }))
  }

  const handleAddCryptoNetwork = (assetId) => {
    updateDraft((draft) => ({
      ...draft,
      cryptoAssets: draft.cryptoAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              networks: [...asset.networks, createEmptyCryptoNetwork()],
            }
          : asset,
      ),
    }))
  }

  const handleRemoveCryptoNetwork = (assetId, networkId) => {
    updateDraft((draft) => ({
      ...draft,
      cryptoAssets: draft.cryptoAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              networks: asset.networks.filter((network) => network.id !== networkId),
            }
          : asset,
      ),
    }))
  }

  const handleSavePaymentSettings = async () => {
    try {
      setSavingAction('save')
      const savedSettings = await updatePaymentSettingsForCurrency(currencyCode, paymentSettingsDraft, {
        updatedBy: user?.name ?? 'Admin desk',
      })

      clearPaymentSettingsDraftForCurrency(currencyCode)
      setSavedPaymentSettings(savedSettings)
      setPaymentSettingsDraft(clonePaymentSettings(savedSettings))
      setPublishedMeta(getPaymentSettingsMetaForCurrency(currencyCode))
      showToast(
        `Saved and published ${currencyCode} payment settings to the payment and membership pages.`,
        'success',
      )
    } catch (error) {
      showToast(error.message || 'We could not save those payment settings right now.', 'warning')
    } finally {
      setSavingAction('')
    }
  }

  const handleDiscardChanges = () => {
    clearPaymentSettingsDraftForCurrency(currencyCode)
    setPaymentSettingsDraft(clonePaymentSettings(savedPaymentSettings))
    showToast(`Discarded unpublished ${currencyCode} payment changes.`, 'success')
  }

  const handleResetPaymentSettings = async () => {
    try {
      setSavingAction('reset')
      const resetSettings = await resetPaymentSettingsForCurrency(currencyCode, {
        updatedBy: user?.name ?? 'Admin desk',
      })

      clearPaymentSettingsDraftForCurrency(currencyCode)
      setSavedPaymentSettings(resetSettings)
      setPaymentSettingsDraft(clonePaymentSettings(resetSettings))
      setPublishedMeta(getPaymentSettingsMetaForCurrency(currencyCode))
      showToast(`Reset and published ${currencyCode} payment settings to defaults.`, 'success')
    } catch (error) {
      showToast(error.message || 'We could not reset those payment settings right now.', 'warning')
    } finally {
      setSavingAction('')
    }
  }

  const currency = supportedCurrencies[currencyCode] ?? supportedCurrencies.USD
  const visibleBankDetails = useMemo(
    () =>
      paymentSettingsDraft.bank.details.filter(
        (detail) => hasVisibleText(detail.label) || hasVisibleText(detail.value),
      ),
    [paymentSettingsDraft.bank.details],
  )
  const visibleGiftCards = useMemo(
    () => paymentSettingsDraft.giftCards.filter((card) => hasVisibleText(card.label)),
    [paymentSettingsDraft.giftCards],
  )
  const visibleCryptoAssets = useMemo(
    () =>
      paymentSettingsDraft.cryptoAssets
        .map((asset) => ({
          ...asset,
          networks: asset.networks.filter(
            (network) => hasVisibleText(network.label) || hasVisibleText(network.wallet),
          ),
        }))
        .filter((asset) => hasVisibleText(asset.label) || asset.networks.length),
    [paymentSettingsDraft.cryptoAssets],
  )
  const walletCount = useMemo(
    () => visibleCryptoAssets.reduce((sum, asset) => sum + asset.networks.length, 0),
    [visibleCryptoAssets],
  )
  const publishStatusLabel = publishedMeta.updatedAt
    ? `Last published ${timeAgo(publishedMeta.updatedAt)}${publishedMeta.updatedBy ? ` by ${publishedMeta.updatedBy}` : ''}`
    : 'Default seeded settings currently live'
  const publishStatusDetail = publishedMeta.updatedAt
    ? `${formatDate(publishedMeta.updatedAt)} / revision ${publishedMeta.revision}`
    : 'Publish once to stamp this currency with a live save record for the admin desk.'
  const previewReference = `${paymentSettingsDraft.bank.referencePrefix || 'CP'}-ORDER-1024`
  const renderPublishActions = ({ includeReset = false } = {}) => (
    <div className="cp-action-row">
      <button
        className="cp-btn cp-btn--ghost"
        disabled={!hasUnsavedSettings || isSaving}
        onClick={handleDiscardChanges}
        type="button"
      >
        <RotateCcw size={14} />
        Discard Draft
      </button>

      {includeReset ? (
        <button
          className="cp-btn cp-btn--quiet"
          disabled={isSaving}
          onClick={handleResetPaymentSettings}
          type="button"
        >
          <RotateCcw size={14} />
          {savingAction === 'reset' ? 'Resetting...' : 'Reset to Defaults'}
        </button>
      ) : null}

      <button
        className="cp-btn cp-btn--primary"
        disabled={!hasUnsavedSettings || isSaving}
        onClick={handleSavePaymentSettings}
        type="button"
      >
        <Save size={14} />
        {savingAction === 'save' ? 'Saving...' : 'Save & Publish'}
      </button>
    </div>
  )

  return (
    <>
      <motion.article className="cp-queue-card cp-surface cp-surface--accent" {...revealUp}>
        <div className="cp-queue-card-header">
          <div>
            <span className="cp-eyebrow">Live payment instructions</span>
            <h3>{currency.code} settings</h3>
            <p className="cp-text-muted">
              Save and publish changes here to update what fans see on the payment and membership
              pages for {currency.regionLabel}.
            </p>
          </div>

          <label className="cp-currency-select" htmlFor="admin-payment-currency">
            <select
              id="admin-payment-currency"
              onChange={handleCurrencySelectionChange}
              value={currencyCode}
            >
              {Object.keys(supportedCurrencies).map((code) => (
                <option key={code} value={code}>
                  {code} - {supportedCurrencies[code].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cp-inline-trust">
          <span className="cp-chip">Reference prefix: {paymentSettingsDraft.bank.referencePrefix || 'CP'}</span>
          <span className="cp-chip">{visibleGiftCards.length} live gift cards</span>
          <span className="cp-chip">{walletCount} live crypto wallets</span>
          <span className="cp-chip">
            {hasUnsavedSettings ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}
            {hasUnsavedSettings ? 'Draft not published' : 'User pages synced'}
          </span>
        </div>

        <div style={STATUS_PANEL_STYLE}>
          <strong style={{ color: 'var(--white)' }}>
            {hasUnsavedSettings
              ? 'Unpublished edits are being kept in this browser until you save and publish or discard them.'
              : 'The latest published payment details are already synced to the user-facing payment flow.'}
          </strong>
          <span className="cp-text-muted">
            {publishStatusLabel}. {publishStatusDetail}.
          </span>
        </div>

        <div className="cp-queue-card-footer">
          {renderPublishActions({ includeReset: true })}
        </div>
      </motion.article>

      <motion.article className="cp-queue-card cp-surface cp-surface--soft" {...revealUp}>
        <div className="cp-queue-card-header">
          <div>
            <span className="cp-eyebrow">User-side preview</span>
            <h3>{hasUnsavedSettings ? 'Draft preview before publish' : 'Current live payment view'}</h3>
            <p className="cp-text-muted">
              This mirrors the kind of detail fans will receive when they open payment or membership
              checkout for {currency.regionLabel}.
            </p>
          </div>
          <span className="cp-chip">
            {hasUnsavedSettings ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}
            {hasUnsavedSettings ? 'Draft preview' : 'Live now'}
          </span>
        </div>

        <div style={PREVIEW_GRID_STYLE}>
          <div className="cp-surface cp-surface--soft" style={PREVIEW_CARD_STYLE}>
            <span className="cp-payment-field-label">Bank transfer</span>
            <p className="cp-text-muted" style={{ margin: 0 }}>
              {paymentSettingsDraft.bank.instructions ||
                'No bank instructions have been written for this currency yet.'}
            </p>

            {visibleBankDetails.length ? (
              <div style={PREVIEW_LIST_STYLE}>
                {visibleBankDetails.slice(0, 3).map((detail) => (
                  <div key={detail.id} className="cp-bank-detail" style={{ padding: '12px 0' }}>
                    <span className="cp-bank-detail-label">{detail.label || 'Field'}</span>
                    <div className="cp-bank-detail-value">
                      <span>{detail.value || 'Value needed'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cp-payment-inline-note">
                <CreditCard size={14} />
                <span>No bank fields will appear until at least one value is filled in.</span>
              </div>
            )}

            <div className="cp-payment-inline-note">
              <CreditCard size={14} />
              <span>Reference example: {previewReference}</span>
            </div>
          </div>

          <div className="cp-surface cp-surface--soft" style={PREVIEW_CARD_STYLE}>
            <span className="cp-payment-field-label">Gift cards</span>
            <p className="cp-text-muted" style={{ margin: 0 }}>
              Accepted labels here populate the gift card dropdown on the user side.
            </p>

            {visibleGiftCards.length ? (
              <div className="cp-inline-trust">
                {visibleGiftCards.slice(0, 6).map((card) => (
                  <span key={card.id} className="cp-chip">
                    {card.label}
                  </span>
                ))}
                {visibleGiftCards.length > 6 ? (
                  <span className="cp-chip">+{visibleGiftCards.length - 6} more</span>
                ) : null}
              </div>
            ) : (
              <div className="cp-payment-inline-note">
                <Gift size={14} />
                <span>No gift card options will be shown for this currency yet.</span>
              </div>
            )}
          </div>

          <div className="cp-surface cp-surface--soft" style={PREVIEW_CARD_STYLE}>
            <span className="cp-payment-field-label">Cryptocurrency</span>
            <p className="cp-text-muted" style={{ margin: 0 }}>
              Each asset becomes a selectable option, and every configured network wallet becomes a
              destination users can copy from checkout.
            </p>

            {visibleCryptoAssets.length ? (
              <div style={PREVIEW_LIST_STYLE}>
                {visibleCryptoAssets.slice(0, 2).map((asset) => (
                  <div key={asset.id} style={{ display: 'grid', gap: 10 }}>
                    <div>
                      <strong style={{ color: 'var(--white)' }}>{asset.label || 'Unnamed asset'}</strong>
                      <p className="cp-text-muted" style={{ margin: '4px 0 0' }}>
                        {asset.networks.length} configured wallet{asset.networks.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    {asset.networks.slice(0, 2).map((network) => (
                      <div key={network.id} className="cp-bank-detail" style={{ padding: '10px 0' }}>
                        <span className="cp-bank-detail-label">{network.label || 'Network'}</span>
                        <div className="cp-bank-detail-value">
                          <span>{maskWallet(network.wallet) || 'Wallet needed'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="cp-payment-inline-note">
                <Wallet size={14} />
                <span>No crypto assets will be available until a wallet is configured.</span>
              </div>
            )}
          </div>
        </div>
      </motion.article>

      <div className="cp-payment-tabs" style={{ marginTop: 6 }}>
        {SETTINGS_EDITOR_TABS.map((tab) => {
          const Icon = tab.icon
          const count =
            tab.id === 'bank'
              ? visibleBankDetails.length
              : tab.id === 'crypto'
                ? walletCount
                : visibleGiftCards.length

          return (
            <button
              key={tab.id}
              className={`cp-tab-button${settingsSection === tab.id ? ' is-active' : ''}`}
              onClick={() => setSettingsSection(tab.id)}
              type="button"
            >
              <Icon size={14} />
              {tab.label}
              {' '}
              <span style={{ opacity: 0.74 }}>({count})</span>
            </button>
          )
        })}
      </div>

      {settingsSection === 'bank' ? (
        <article className="cp-queue-card cp-surface">
          <div className="cp-queue-card-header">
            <div>
              <span className="cp-eyebrow">Bank transfer</span>
              <h3>Bank instructions and fields</h3>
              <p className="cp-text-muted">
                Each row here shows up exactly as a bank detail on the user payment screens.
              </p>
            </div>
            <span className="cp-chip">
              <CreditCard size={14} />
              {paymentSettingsDraft.bank.details.length} draft rows
            </span>
          </div>

        <div style={SETTINGS_TWO_COLUMN_STYLE}>
          <div>
            <label className="cp-payment-field-label" htmlFor="admin-bank-reference-prefix">
              Reference prefix
            </label>
            <input
              className="cp-payment-input"
              id="admin-bank-reference-prefix"
              onChange={(event) => handleBankMetaChange('referencePrefix', event.target.value.toUpperCase())}
              placeholder="CP"
              type="text"
              value={paymentSettingsDraft.bank.referencePrefix}
            />
          </div>

          <div>
            <label className="cp-payment-field-label" htmlFor="admin-bank-instructions">
              Bank instructions
            </label>
            <textarea
              className="cp-chat-compose-textarea"
              id="admin-bank-instructions"
              onChange={(event) => handleBankMetaChange('instructions', event.target.value)}
              placeholder="Tell the user how to complete the transfer."
              style={{ minHeight: 110 }}
              value={paymentSettingsDraft.bank.instructions}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {paymentSettingsDraft.bank.details.map((detail) => (
            <div key={detail.id} style={SETTINGS_ROW_STYLE}>
              <div>
                <label className="cp-payment-field-label">Field label</label>
                <input
                  className="cp-payment-input"
                  onChange={(event) => handleBankDetailChange(detail.id, 'label', event.target.value)}
                  placeholder="Account name"
                  type="text"
                  value={detail.label}
                />
              </div>

              <div>
                <label className="cp-payment-field-label">Field value</label>
                <input
                  className="cp-payment-input"
                  onChange={(event) => handleBankDetailChange(detail.id, 'value', event.target.value)}
                  placeholder="CrownPoint Agency Ltd"
                  type="text"
                  value={detail.value}
                />
              </div>

              <button
                className="cp-btn cp-btn--quiet"
                onClick={() => handleRemoveBankField(detail.id)}
                type="button"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          ))}
        </div>

          <div className="cp-queue-card-footer" style={SECTION_FOOTER_STYLE}>
            <button className="cp-btn cp-btn--ghost" onClick={handleAddBankField} type="button">
              <Plus size={14} />
              Add Bank Field
            </button>
            {renderPublishActions()}
          </div>
        </article>
      ) : null}

      {settingsSection === 'gift' ? (
        <article className="cp-queue-card cp-surface">
          <div className="cp-queue-card-header">
            <div>
              <span className="cp-eyebrow">Gift cards</span>
              <h3>Accepted gift cards</h3>
              <p className="cp-text-muted">
                Only the labels entered here will appear inside the gift card payment dropdowns for this
                currency.
              </p>
            </div>
            <span className="cp-chip">
              <Gift size={14} />
              {paymentSettingsDraft.giftCards.length} draft rows
            </span>
          </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {paymentSettingsDraft.giftCards.map((card) => (
            <div key={card.id} style={{ ...SETTINGS_ROW_STYLE, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
              <div>
                <label className="cp-payment-field-label">Gift card label</label>
                <input
                  className="cp-payment-input"
                  onChange={(event) => handleGiftCardChange(card.id, event.target.value)}
                  placeholder="Amazon Gift Card"
                  type="text"
                  value={card.label}
                />
              </div>

              <button
                className="cp-btn cp-btn--quiet"
                onClick={() => handleRemoveGiftCard(card.id)}
                type="button"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          ))}
        </div>

          <div className="cp-queue-card-footer" style={SECTION_FOOTER_STYLE}>
            <button className="cp-btn cp-btn--ghost" onClick={handleAddGiftCard} type="button">
              <Plus size={14} />
              Add Gift Card
            </button>
            {renderPublishActions()}
          </div>
        </article>
      ) : null}

      {settingsSection === 'crypto' ? (
        <article className="cp-queue-card cp-surface">
          <div className="cp-queue-card-header">
            <div>
              <span className="cp-eyebrow">Crypto wallets</span>
              <h3>Accepted assets and network wallets</h3>
              <p className="cp-text-muted">
                Each asset becomes a user-facing option. Each network row under it becomes a selectable
                wallet destination.
              </p>
            </div>
            <span className="cp-chip">
              <Wallet size={14} />
              {paymentSettingsDraft.cryptoAssets.length} draft assets
            </span>
          </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {paymentSettingsDraft.cryptoAssets.map((asset) => (
            <div
              key={asset.id}
              className="cp-surface cp-surface--soft"
              style={{ padding: 20, display: 'grid', gap: 16 }}
            >
              <div className="cp-queue-card-header" style={{ marginBottom: 0 }}>
                <div style={{ width: '100%' }}>
                  <label className="cp-payment-field-label">Asset label</label>
                  <input
                    className="cp-payment-input"
                    onChange={(event) => handleCryptoAssetChange(asset.id, 'label', event.target.value)}
                    placeholder="Tether (USDT)"
                    type="text"
                    value={asset.label}
                  />
                </div>

                <button
                  className="cp-btn cp-btn--quiet"
                  onClick={() => handleRemoveCryptoAsset(asset.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                  Remove Asset
                </button>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {asset.networks.map((network) => (
                  <div key={network.id} style={SETTINGS_GRID_STYLE}>
                    <div>
                      <label className="cp-payment-field-label">Network label</label>
                      <input
                        className="cp-payment-input"
                        onChange={(event) =>
                          handleCryptoNetworkChange(asset.id, network.id, 'label', event.target.value)
                        }
                        placeholder="Ethereum (ERC-20)"
                        type="text"
                        value={network.label}
                      />
                    </div>

                    <div>
                      <label className="cp-payment-field-label">Wallet address</label>
                      <input
                        className="cp-payment-input"
                        onChange={(event) =>
                          handleCryptoNetworkChange(asset.id, network.id, 'wallet', event.target.value)
                        }
                        placeholder="0x..."
                        type="text"
                        value={network.wallet}
                      />
                    </div>

                    <div style={{ alignSelf: 'end' }}>
                      <button
                        className="cp-btn cp-btn--quiet"
                        onClick={() => handleRemoveCryptoNetwork(asset.id, network.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cp-action-row">
                <button
                  className="cp-btn cp-btn--ghost"
                  onClick={() => handleAddCryptoNetwork(asset.id)}
                  type="button"
                >
                  <Plus size={14} />
                  Add Network Wallet
                </button>
              </div>
            </div>
          ))}
        </div>

          <div className="cp-queue-card-footer" style={SECTION_FOOTER_STYLE}>
            <button className="cp-btn cp-btn--ghost" onClick={handleAddCryptoAsset} type="button">
              <Plus size={14} />
              Add Crypto Asset
            </button>
            {renderPublishActions()}
          </div>
        </article>
      ) : null}
    </>
  )
}
