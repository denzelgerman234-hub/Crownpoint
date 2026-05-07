import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import Loader from '../components/ui/Loader'
import TalentSearchFilters from '../components/ui/TalentSearchFilters'
import { useCart } from '../context/CartContext'
import { useOrder } from '../context/OrderContext'
import { useTalentFilters } from '../hooks/useTalentFilters'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import { ORDER_STATUS, ORDER_TYPES } from '../utils/constants'
import { formatCurrency } from '../utils/formatters'
import { generateRef } from '../utils/generateRef'
import { revealUp } from '../utils/motion'

const cleanCopy = (value = '') =>
  value.replace(/\u00C2/g, '').replace(/\s*[\u00B7\u2022]\s*/g, ' / ')

const BOOKING_TABS = [
  { id: 'selection', label: 'Step 1 / Selection' },
  { id: 'details', label: 'Step 2 / Details' },
  { id: 'review', label: 'Step 3 / Review' },
]
const BOOKING_VISIBLE_OPTIONS = 10

export default function Booking() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stepStackRef = useRef(null)
  const { addServiceItem } = useCart()
  const { currentOrder, updateOrder } = useOrder()
  const { showToast } = useToast()
  const talentRoster = useTalentRoster()

  const queryTalentId = Number(searchParams.get('talent')) || null
  const requestedServiceId = searchParams.get('service')
  const preferredTalentId = queryTalentId || currentOrder.talent?.id || null
  const preferredTalent =
    talentRoster.find((talent) => talent.id === preferredTalentId) ??
    currentOrder.talent ??
    null
  const preferredServiceId =
    requestedServiceId ??
    (currentOrder.talent?.id === preferredTalent?.id ? currentOrder.service?.id : null) ??
    null
  const backTarget = queryTalentId ? `/talent/${queryTalentId}` : '/talents'
  const backLabel = queryTalentId ? 'Back to profile' : 'Back to talents'
  const {
    activeCategory,
    clearFilters,
    filteredTalents,
    hasSearchIntent,
    hiddenResultCount,
    isQueryTooShort,
    isSearchPending,
    resultCount,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
  } = useTalentFilters(talentRoster, {
    requireSearch: true,
    visibleIncrement: BOOKING_VISIBLE_OPTIONS,
    visibleResults: BOOKING_VISIBLE_OPTIONS,
  })

  const [selectedTalentId, setSelectedTalentId] = useState(() => preferredTalent?.id ?? null)
  const [selectedServiceId, setSelectedServiceId] = useState(
    () => (
      preferredTalent?.services?.some((service) => service.id === preferredServiceId)
        ? preferredServiceId
        : null
    ),
  )
  const [recipient, setRecipient] = useState(currentOrder.recipient ?? '')
  const [occasion, setOccasion] = useState(currentOrder.occasion ?? '')
  const [tone, setTone] = useState(currentOrder.tone ?? 'Warm and celebratory')
  const [deliveryWindow, setDeliveryWindow] = useState(currentOrder.deliveryWindow ?? 'Within 72 hours')
  const [note, setNote] = useState(currentOrder.note ?? '')
  const [activeBookingTab, setActiveBookingTab] = useState('selection')
  const resolvedSelectedTalentId = talentRoster.some((talent) => talent.id === selectedTalentId)
    ? selectedTalentId
    : null
  const selectedTalent =
    talentRoster.find((talent) => talent.id === resolvedSelectedTalentId) ?? null
  const selectableTalents =
    selectedTalent && !filteredTalents.some((talent) => talent.id === selectedTalent.id)
      ? [selectedTalent, ...filteredTalents]
      : filteredTalents
  const resolvedSelectedServiceId = selectedTalent?.services.some(
    (service) => service.id === selectedServiceId,
  )
    ? selectedServiceId
    : null
  const selectedService =
    selectedTalent?.services.find((service) => service.id === resolvedSelectedServiceId) ?? null
  const selectionHelperText = !hasSearchIntent
    ? selectedTalent
      ? `${selectedTalent.name} is selected. Search again if you would like to compare more talent.`
      : 'Search by name, category, or location to begin your experience request.'
    : isSearchPending
      ? 'Finding the best matches for your request...'
      : isQueryTooShort
        ? 'Add one more letter or choose a category to continue.'
        : !resultCount && !selectedTalent
          ? 'No matches yet. Try a broader name, location, or category.'
          : hiddenResultCount
            ? `${resultCount} matches found. Refine the search if you want a shorter shortlist.`
            : `${Math.max(resultCount, selectedTalent ? 1 : 0)} talent option${Math.max(resultCount, selectedTalent ? 1 : 0) === 1 ? '' : 's'} ready.`

  const canContinue = Boolean(selectedService) && recipient.trim() && occasion.trim() && note.trim()
  const canMoveToReview = Boolean(recipient.trim() && occasion.trim() && note.trim())

  const handleTalentChange = (event) => {
    const nextTalentId = Number(event.target.value)

    if (nextTalentId === selectedTalentId) {
      return
    }

    setSelectedTalentId(nextTalentId)
    setSelectedServiceId(null)
  }

  const handleAddToCart = () => {
    if (!selectedTalent) {
      showToast('Choose a talent and a service first.', 'warning')
      return
    }

    if (!selectedService) {
      showToast(
        selectedTalent.services.length
          ? 'Choose a service before continuing.'
          : 'This talent does not have any live experiences yet.',
        'warning',
      )
      return
    }

    if (!canContinue) {
      showToast('Add a recipient, occasion, and request note before continuing.', 'warning')
      return
    }

    const shouldReuseRef =
      currentOrder.refCode &&
      currentOrder.orderType === ORDER_TYPES.SERVICE &&
      currentOrder.talent?.id === selectedTalent.id
    const refCode = shouldReuseRef ? currentOrder.refCode : generateRef()

    updateOrder({
      orderType: ORDER_TYPES.SERVICE,
      talent: selectedTalent,
      service: selectedService,
      event: null,
      ticketTier: null,
      recipient,
      occasion,
      tone,
      deliveryWindow,
      note,
      itemLabel: '',
      refCode,
      totalPrice: selectedService.price,
      items: [{
        id: selectedService.id,
        title: selectedService.label,
        subtitle: occasion || 'Personalized experience request',
        quantity: 1,
        unitPrice: selectedService.price,
        totalPrice: selectedService.price,
      }],
      status: ORDER_STATUS.PENDING_PAYMENT,
      paymentMethod: null,
      paymentProof: '',
      paymentProofFileName: '',
    })
    addServiceItem({
      talent: selectedTalent,
      service: selectedService,
    })

    showToast('Your experience has been added to the cart. Open the cart to continue.', 'success')
  }

  const moveToStep = (nextStep) => {
    setActiveBookingTab(nextStep)

    requestAnimationFrame(() => {
      stepStackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleBack = () => {
    const historyIndex = window.history.state?.idx

    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1)
      return
    }

    navigate(backTarget)
  }

  if (!talentRoster.length) {
    return (
      <PageWrapper className="cp-page--booking">
        <Loader label="Loading booking desk..." />
      </PageWrapper>
    )
  }

  return (
    <PageWrapper className="cp-page--booking">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <button
              className="cp-payment-backlink cp-detail-backlink cp-payment-backlink--button"
              onClick={handleBack}
              type="button"
            >
              <ArrowLeft size={14} />
              {backLabel}
            </button>
            <span className="cp-eyebrow">Experiences</span>
            <h1 className="cp-page-title">
              Create an experience request our concierge team can action with <em>confidence.</em>
            </h1>
            <p className="cp-page-intro">
              Search for the right talent, shape the brief, and keep everything ready for a smooth checkout.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          <div className="cp-booking-grid cp-profile-grid--single">
            <div ref={stepStackRef} className="cp-step-stack">
              <div className="cp-payment-tabs cp-payment-tabs--wrap">
                {BOOKING_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`cp-tab-button${activeBookingTab === tab.id ? ' is-active' : ''}`}
                    onClick={() => setActiveBookingTab(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeBookingTab === 'selection' ? (
                <motion.article className="cp-info-card cp-surface" {...revealUp}>
                  <span className="cp-eyebrow">Step 1</span>
                  <h3>Find the right talent and choose an experience</h3>
                  <TalentSearchFilters
                    activeCategory={activeCategory}
                    helperText={selectionHelperText}
                    onCategoryChange={setActiveCategory}
                    onClear={clearFilters}
                    onSearchChange={setSearchQuery}
                    panelClassName="cp-filter-panel"
                    placeholder="Search for a talent by name, category, city, or tag"
                    searchQuery={searchQuery}
                  />

                  <div className="cp-form-grid cp-form-grid--two">
                    <div className="cp-field">
                      <label htmlFor="talent">Talent</label>
                      <select
                        disabled={!selectableTalents.length}
                        id="talent"
                        onChange={handleTalentChange}
                         value={resolvedSelectedTalentId ?? ''}
                      >
                        <option disabled value="">
                          {selectableTalents.length
                            ? 'Select talent'
                            : hasSearchIntent
                              ? 'No talents match the current filters'
                              : 'Search or filter to view matching talent'}
                        </option>
                        {selectableTalents.map((talent) => (
                          <option key={talent.id} value={talent.id}>
                            {talent.name} - {cleanCopy(talent.subcategory)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="service">Service</label>
                        <select
                          disabled={!selectedTalent || !selectedTalent.services.length}
                          id="service"
                          onChange={(event) => setSelectedServiceId(event.target.value || null)}
                           value={resolvedSelectedServiceId ?? ''}
                        >
                          <option disabled value="">
                            {!selectedTalent
                              ? 'Select talent first'
                              : selectedTalent.services.length
                                ? 'Select service'
                                : 'No experiences published yet'}
                          </option>
                          {selectedTalent?.services.length ? selectedTalent.services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.label} - {formatCurrency(service.price)}
                            </option>
                          )) : null}
                        </select>
                      </div>
                  </div>

                  <div className="cp-message-preview">
                    <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                      {selectedTalent?.name ?? 'Select a talent'}
                    </strong>
                    {selectedTalent
                      ? selectedTalent.services.length
                        ? selectedTalent.bio
                        : 'This profile is live, but experiences have not been published yet.'
                      : selectableTalents.length
                        ? 'Choose a talent from the shortlist to preview available experiences.'
                        : 'Search to reveal matching talent.'}
                  </div>

                  <div className="cp-card-actions cp-booking-step-actions">
                    <button
                      className="cp-btn cp-btn--primary"
                      disabled={!selectedService}
                      onClick={() => moveToStep('details')}
                      type="button"
                    >
                      Next step
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.article>
              ) : null}

              {activeBookingTab === 'details' ? (
                <motion.article className="cp-info-card cp-surface" {...revealUp}>
                  <span className="cp-eyebrow">Step 2</span>
                  <h3>Share the important details</h3>
                  <div className="cp-form-grid cp-form-grid--two">
                    <div className="cp-field">
                      <label htmlFor="recipient">Recipient</label>
                      <input
                        id="recipient"
                        onChange={(event) => setRecipient(event.target.value)}
                        placeholder="Who is this for?"
                        value={recipient}
                      />
                    </div>

                    <div className="cp-field">
                      <label htmlFor="occasion">Occasion</label>
                      <input
                        id="occasion"
                        onChange={(event) => setOccasion(event.target.value)}
                        placeholder="Birthday, milestone, surprise, launch..."
                        value={occasion}
                      />
                    </div>

                    <div className="cp-field">
                      <label htmlFor="tone">Delivery tone</label>
                      <input
                        id="tone"
                        onChange={(event) => setTone(event.target.value)}
                        placeholder="Warm, playful, inspiring..."
                        value={tone}
                      />
                    </div>

                    <div className="cp-field">
                      <label htmlFor="window">Preferred delivery window</label>
                      <input
                        id="window"
                        onChange={(event) => setDeliveryWindow(event.target.value)}
                        placeholder="Within 72 hours"
                        value={deliveryWindow}
                      />
                    </div>
                  </div>

                  <div className="cp-field" style={{ marginTop: 18 }}>
                    <label htmlFor="note">Request note</label>
                    <textarea
                      id="note"
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Share names, pronunciation, emotional context, and any must-include details."
                      value={note}
                    />
                  </div>

                  <div className="cp-card-actions cp-booking-step-actions">
                    <button
                      className="cp-btn cp-btn--primary"
                      disabled={!canMoveToReview}
                      onClick={() => moveToStep('review')}
                      type="button"
                    >
                      Next step
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.article>
              ) : null}

              {activeBookingTab === 'review' ? (
                <motion.article className="cp-info-card cp-surface" {...revealUp}>
                  <span className="cp-eyebrow">Step 3</span>
                  <h3>Review your request</h3>
                  <div className="cp-message-preview">
                    <p>
                      For <strong style={{ color: 'var(--white)' }}>{recipient || 'your recipient'}</strong>:
                      a {tone.toLowerCase()} {(selectedService?.label ?? 'service').toLowerCase()} from {selectedTalent?.name ?? 'your selected talent'}
                      for {occasion || 'a special occasion'}, ideally delivered {deliveryWindow.toLowerCase()}.
                    </p>
                    <p style={{ marginTop: 12 }}>{note || 'Add a personal note to make the request more bespoke.'}</p>
                  </div>

                  <div className="cp-price-row" style={{ marginTop: 18 }}>
                    <div>
                      <strong>{selectedService ? formatCurrency(selectedService.price) : 'Pending selection'}</strong>
                      <span>
                        {selectedService
                          ? selectedService.label
                          : 'Choose a service to view pricing'}
                      </span>
                    </div>
                    <span>{selectedTalent?.responseTime ?? 'Response pace pending'}</span>
                  </div>

                  <div className="cp-card-actions cp-booking-step-actions">
                    <button
                      className="cp-btn cp-btn--primary"
                      disabled={!canContinue}
                      onClick={handleAddToCart}
                      type="button"
                    >
                      Add to cart
                      <ArrowRight size={14} />
                    </button>
                    <Link className="cp-btn cp-btn--ghost" to={selectedTalent ? `/talent/${selectedTalent.id}` : '/talents'}>
                      Back to profile
                    </Link>
                  </div>
                </motion.article>
              ) : null}
            </div>
          </div>

        </div>
      </section>
    </PageWrapper>
  )
}
