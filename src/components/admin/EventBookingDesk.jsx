import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, MailCheck, PencilLine, Trash2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import {
  deleteEventBookingRequest,
  EVENT_BOOKING_REQUEST_STATUS,
  getEventBookingRequests,
  refreshEventBookingRequests,
  subscribeToEventBookingRequests,
  updateEventBookingRequestStatus,
} from '../../services/eventBookingService'
import { updateTalent } from '../../services/talentService'
import { formatCurrency, formatDate, timeAgo, truncate } from '../../utils/formatters'

const PANEL_GRID_STYLE = {
  display: 'grid',
  gap: 20,
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  alignItems: 'start',
}

const CARD_GRID_STYLE = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
}

const CARD_STYLE = { padding: 18, display: 'grid', gap: 12 }

const splitCommaSeparated = (value = '') =>
  String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const createEventBookingDraft = () => ({
  available: true,
  appearanceFee: '',
  premiumLabel: 'Premium star',
  responseCommitment: 'During normal business hours, we respond to most inquiries within 4 hours.',
  intro:
    'We are happy to assist with booking inquiries. Share the event details, your approximate budget, and your organiser information so our team can review availability and come back to you promptly.',
  eventTypes: 'Meet & greet, Corporate event, Festival appearance, Private celebration, Brand campaign',
  budgetOptions: 'Under $10,000, $10,000 - $25,000, $25,000 - $50,000, $50,000 and above',
  logisticsNotes:
    'Include the event date, venue city, expected audience, and any hospitality or travel notes that matter for the booking review.',
})

const mapEventBookingToDraft = (eventBooking) => ({
  available: eventBooking?.available ?? true,
  appearanceFee: eventBooking?.appearanceFee != null ? String(eventBooking.appearanceFee) : '',
  premiumLabel: eventBooking?.premiumLabel ?? 'Premium star',
  responseCommitment:
    eventBooking?.responseCommitment ??
    'During normal business hours, we respond to most inquiries within 4 hours.',
  intro:
    eventBooking?.intro ??
    'We are happy to assist with booking inquiries. Share the event details, your approximate budget, and your organiser information so our team can review availability and come back to you promptly.',
  eventTypes: Array.isArray(eventBooking?.eventTypes) ? eventBooking.eventTypes.join(', ') : '',
  budgetOptions: Array.isArray(eventBooking?.budgetOptions) ? eventBooking.budgetOptions.join(', ') : '',
  logisticsNotes:
    eventBooking?.logisticsNotes ??
    'Include the event date, venue city, expected audience, and any hospitality or travel notes that matter for the booking review.',
})

const requestStatusLabels = {
  [EVENT_BOOKING_REQUEST_STATUS.NEW]: 'New',
  [EVENT_BOOKING_REQUEST_STATUS.IN_REVIEW]: 'In review',
  [EVENT_BOOKING_REQUEST_STATUS.IN_TOUCH]: 'In touch',
  [EVENT_BOOKING_REQUEST_STATUS.CLOSED]: 'Closed',
}

export default function EventBookingDesk({ selectedTalent = null, talentRoster = [] }) {
  const { showToast } = useToast()
  const [bookingDraft, setBookingDraft] = useState(createEventBookingDraft)
  const [requests, setRequests] = useState(() => getEventBookingRequests())
  const [savingKey, setSavingKey] = useState('')

  useEffect(() => {
    const syncRequests = () => setRequests(getEventBookingRequests())
    syncRequests()
    refreshEventBookingRequests()
      .then(syncRequests)
      .catch((error) => {
        showToast(error.message || 'We could not refresh booking requests right now.', 'warning')
      })
    return subscribeToEventBookingRequests(syncRequests)
  }, [showToast])

  const selectedTalentRequests = useMemo(
    () => requests.filter((request) => request.talentId === selectedTalent?.id),
    [requests, selectedTalent?.id],
  )

  useEffect(() => {
    if (!selectedTalent) {
      setBookingDraft(createEventBookingDraft())
      return
    }

    setBookingDraft(mapEventBookingToDraft(selectedTalent.eventBooking))
  }, [selectedTalent])

  const requestCounts = useMemo(
    () => ({
      total: selectedTalentRequests.length,
      new: selectedTalentRequests.filter((request) => request.status === EVENT_BOOKING_REQUEST_STATUS.NEW).length,
      active: selectedTalentRequests.filter((request) =>
        [EVENT_BOOKING_REQUEST_STATUS.NEW, EVENT_BOOKING_REQUEST_STATUS.IN_REVIEW, EVENT_BOOKING_REQUEST_STATUS.IN_TOUCH].includes(
          request.status,
        ),
      ).length,
    }),
    [selectedTalentRequests],
  )

  const eventBookingEnabledCount = useMemo(
    () => talentRoster.filter((talent) => talent.eventBooking?.available).length,
    [talentRoster],
  )

  const updateDraft = (field, value) => {
    setBookingDraft((current) => ({ ...current, [field]: value }))
  }

  const withSaving = async (key, action, successMessage, fallbackMessage) => {
    setSavingKey(key)

    try {
      await action()
      if (successMessage) {
        showToast(successMessage, 'success')
      }
    } catch (error) {
      showToast(error.message || fallbackMessage, 'warning')
    } finally {
      setSavingKey('')
    }
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()

    if (!selectedTalent) {
      showToast('Focus a talent from Talent Management before saving the booking profile.', 'warning')
      return
    }

    const appearanceFee = Number(bookingDraft.appearanceFee)

    if (!Number.isFinite(appearanceFee) || appearanceFee <= 0) {
      showToast('Set a valid appearance fee before saving.', 'warning')
      return
    }

    if (!bookingDraft.premiumLabel.trim()) {
      showToast('Add a premium label before saving.', 'warning')
      return
    }

    if (!bookingDraft.responseCommitment.trim()) {
      showToast('Add the response commitment before saving.', 'warning')
      return
    }

    const payload = {
      eventBooking: {
        available: bookingDraft.available,
        appearanceFee,
        premiumLabel: bookingDraft.premiumLabel.trim(),
        responseCommitment: bookingDraft.responseCommitment.trim(),
        intro: bookingDraft.intro.trim(),
        eventTypes: splitCommaSeparated(bookingDraft.eventTypes),
        budgetOptions: splitCommaSeparated(bookingDraft.budgetOptions),
        logisticsNotes: bookingDraft.logisticsNotes.trim(),
      },
    }

    await withSaving(
      'booking-profile',
      () => updateTalent(selectedTalent.id, payload),
      `${selectedTalent.name}'s event booking setup was updated.`,
      'We could not update that event booking setup right now.',
    )
  }

  const handleRequestStatus = async (requestId, status) => {
    await withSaving(
      `request-${requestId}-${status}`,
      () => updateEventBookingRequestStatus(requestId, status),
      `Booking request marked as ${requestStatusLabels[status].toLowerCase()}.`,
      'We could not update that booking request right now.',
    )
  }

  const handleRequestDelete = async (request) => {
    if (typeof window !== 'undefined') {
      const shouldDelete = window.confirm(
        `Delete the booking request from ${request.fullName}? This will remove it from the admin queue.`,
      )

      if (!shouldDelete) {
        return
      }
    }

    await withSaving(
      `delete-request-${request.id}`,
      () => deleteEventBookingRequest(request.id),
      'Booking request removed from the queue.',
      'We could not remove that booking request right now.',
    )
  }

  if (!talentRoster.length) {
    return (
      <article className="cp-info-card cp-surface">
        <span className="cp-eyebrow">Event booking</span>
        <h3>Publish a talent profile before opening event booking.</h3>
        <p className="cp-text-muted">
          Event booking is managed per talent, so the roster needs at least one live profile before
          booking requests can be configured and reviewed.
        </p>
      </article>
    )
  }

  if (!selectedTalent) {
    return (
      <article className="cp-info-card cp-surface">
        <span className="cp-eyebrow">Event booking</span>
        <h3>Search for and focus a talent before opening event booking.</h3>
        <p className="cp-text-muted">
          The current talent focus now comes from the Talent Management search at the top of the
          page, so this tab stays locked to the same profile you selected there.
        </p>
      </article>
    )
  }

  return (
    <>
      <article className="cp-summary-card cp-surface cp-surface--accent">
        <span className="cp-eyebrow">Event booking</span>
        <h3>Configure appearance enquiries and review incoming booking requests.</h3>
        <p className="cp-text-muted">
          This replaces the old ticket-date setup with a cleaner event-booking model built for
          private appearances, brand campaigns, festivals, and premium live requests.
        </p>

        <div className="cp-metric-grid" style={{ marginTop: 20 }}>
          <div className="cp-metric-card cp-surface cp-surface--soft">
            <strong>{eventBookingEnabledCount}</strong>
            <span>Talent profiles currently open for event booking</span>
          </div>
          <div className="cp-metric-card cp-surface cp-surface--soft">
            <strong>{requestCounts.total}</strong>
            <span>Requests currently tied to the selected talent</span>
          </div>
          <div className="cp-metric-card cp-surface cp-surface--soft">
            <strong>{requestCounts.new}</strong>
            <span>New enquiries waiting on first review</span>
          </div>
          <div className="cp-metric-card cp-surface cp-surface--soft">
            <strong>{selectedTalent?.name ?? 'Choose one'}</strong>
            <span>Talent currently open in event booking admin</span>
          </div>
        </div>
      </article>

      <article className="cp-info-card cp-surface">
        <span className="cp-eyebrow">Booking profile</span>
        <h3>Shape the public event booking setup for {selectedTalent.name}.</h3>
        <p className="cp-text-muted">
          The current talent focus comes from the Talent Management search above, so the public
          setup and incoming requests stay tied to the same profile all the way through.
        </p>

        <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
          <div className="cp-field">
            <label htmlFor="admin-event-booking-talent">Current talent</label>
            <input
              disabled
              id="admin-event-booking-talent"
              value={`${selectedTalent.name} / ${selectedTalent.category || 'Category pending'}`}
            />
          </div>

          <div className="cp-field">
            <label htmlFor="admin-event-booking-status">Booking visibility</label>
            <select
              id="admin-event-booking-status"
              onChange={(event) => updateDraft('available', event.target.value === 'true')}
              value={String(bookingDraft.available)}
            >
              <option value="true">Open for booking enquiries</option>
              <option value="false">Temporarily hidden</option>
            </select>
          </div>
        </div>

        <div className="cp-inline-trust" style={{ marginTop: 18 }}>
          <span className="cp-chip">
            {selectedTalent?.location || 'Location pending'}
          </span>
          <span className="cp-chip">
            {selectedTalent?.eventBooking?.available ? 'Booking open' : 'Booking hidden'}
          </span>
          <span className="cp-chip">
            {selectedTalent?.eventBooking?.appearanceFee
              ? `${formatCurrency(selectedTalent.eventBooking.appearanceFee)} appearance fee`
              : 'Appearance fee pending'}
          </span>
          <span className="cp-chip">
            {requestCounts.active} active request{requestCounts.active === 1 ? '' : 's'}
          </span>
        </div>
      </article>

      <div style={PANEL_GRID_STYLE}>
        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">Public setup</span>
          <h3>{selectedTalent ? `Edit ${selectedTalent.name}'s booking details` : 'Choose a talent'}</h3>
          <p className="cp-text-muted">
            These fields power the public event-booking page users see before they send an enquiry.
          </p>

          <form onSubmit={handleProfileSubmit}>
            <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
              <div className="cp-field">
                <label htmlFor="admin-event-booking-fee">Appearance fee (USD)</label>
                <input
                  id="admin-event-booking-fee"
                  min="1"
                  onChange={(event) => updateDraft('appearanceFee', event.target.value)}
                  placeholder="5260"
                  step="10"
                  type="number"
                  value={bookingDraft.appearanceFee}
                />
              </div>

              <div className="cp-field">
                <label htmlFor="admin-event-booking-label">Premium label</label>
                <input
                  id="admin-event-booking-label"
                  onChange={(event) => updateDraft('premiumLabel', event.target.value)}
                  placeholder="Premium star"
                  value={bookingDraft.premiumLabel}
                />
              </div>

              <div className="cp-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="admin-event-booking-response">Response commitment</label>
                <input
                  id="admin-event-booking-response"
                  onChange={(event) => updateDraft('responseCommitment', event.target.value)}
                  placeholder="During normal business hours, we respond within 4 hours."
                  value={bookingDraft.responseCommitment}
                />
              </div>

              <div className="cp-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="admin-event-booking-types">Event types</label>
                <input
                  id="admin-event-booking-types"
                  onChange={(event) => updateDraft('eventTypes', event.target.value)}
                  placeholder="Corporate event, Festival appearance, Private celebration"
                  value={bookingDraft.eventTypes}
                />
              </div>

              <div className="cp-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="admin-event-booking-budgets">Budget options</label>
                <input
                  id="admin-event-booking-budgets"
                  onChange={(event) => updateDraft('budgetOptions', event.target.value)}
                  placeholder="Under $10,000, $10,000 - $25,000"
                  value={bookingDraft.budgetOptions}
                />
              </div>
            </div>

            <div className="cp-field" style={{ marginTop: 18 }}>
              <label htmlFor="admin-event-booking-intro">Intro copy</label>
              <textarea
                id="admin-event-booking-intro"
                onChange={(event) => updateDraft('intro', event.target.value)}
                placeholder="We are happy to assist with your interest in booking..."
                value={bookingDraft.intro}
              />
            </div>

            <div className="cp-field" style={{ marginTop: 18 }}>
              <label htmlFor="admin-event-booking-logistics">Logistics note</label>
              <textarea
                id="admin-event-booking-logistics"
                onChange={(event) => updateDraft('logisticsNotes', event.target.value)}
                placeholder="Include the event date, venue city, audience size..."
                value={bookingDraft.logisticsNotes}
              />
            </div>

            <div className="cp-queue-card-footer" style={{ marginTop: 18 }}>
              <div className="cp-meta-row">
                <span>{requestCounts.total} request{requestCounts.total === 1 ? '' : 's'} logged</span>
                <span>{selectedTalent?.eventBooking?.available ? 'Public booking page is live' : 'Public booking page is hidden'}</span>
              </div>
              <div className="cp-action-row">
                <button
                  className="cp-btn cp-btn--quiet"
                  onClick={() => setBookingDraft(mapEventBookingToDraft(selectedTalent?.eventBooking))}
                  type="button"
                >
                  Reset
                </button>
                <button
                  className="cp-btn cp-btn--primary"
                  disabled={savingKey === 'booking-profile'}
                  type="submit"
                >
                  <PencilLine size={14} />
                  {savingKey === 'booking-profile' ? 'Saving...' : 'Save booking profile'}
                </button>
              </div>
            </div>
          </form>
        </article>

        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">Incoming requests</span>
          <h3>{selectedTalent?.name ?? 'Selected talent'} booking enquiries</h3>
          <p className="cp-text-muted">
            Review what the organiser is planning, note the budget range, and move each enquiry
            through a simple status without leaving the admin desk.
          </p>

          {selectedTalentRequests.length ? (
            <div style={{ ...CARD_GRID_STYLE, marginTop: 18 }}>
              {selectedTalentRequests.map((request) => (
                <div key={request.id} className="cp-surface cp-surface--soft" style={CARD_STYLE}>
                  <div className="cp-price-row">
                    <div>
                      <strong>{request.fullName}</strong>
                      <span>{request.organizationName || request.jobTitle}</span>
                    </div>
                    <span>{requestStatusLabels[request.status]}</span>
                  </div>

                  <div className="cp-inline-trust">
                    <span className="cp-chip">
                      <CalendarDays size={14} />
                      {request.eventDate ? formatDate(request.eventDate) : 'Date pending'}
                    </span>
                    <span className="cp-chip">{request.eventType || 'Type pending'}</span>
                    <span className="cp-chip">{request.approximateBudget || 'Budget pending'}</span>
                  </div>

                  <p className="cp-text-muted">
                    {truncate(request.additionalInfo || request.eventLocation || 'No additional event detail shared yet.', 180)}
                  </p>

                  <div className="cp-message-preview" style={{ marginTop: 0 }}>
                    <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                      Contact
                    </strong>
                    {request.emailAddress}
                    <br />
                    {request.phoneNumber}
                    <br />
                    {request.fullAddress}
                    <br />
                    {request.nearestAirport}
                  </div>

                  <div className="cp-meta-row">
                    <span>{request.eventLocation || 'Location pending'}</span>
                    <span>{timeAgo(request.submittedAt)}</span>
                    <span>{request.jobTitle || 'Role pending'}</span>
                  </div>

                  <div className="cp-action-row">
                    <button
                      className="cp-btn cp-btn--ghost"
                      disabled={savingKey === `request-${request.id}-${EVENT_BOOKING_REQUEST_STATUS.IN_REVIEW}`}
                      onClick={() => handleRequestStatus(request.id, EVENT_BOOKING_REQUEST_STATUS.IN_REVIEW)}
                      type="button"
                    >
                      <MailCheck size={14} />
                      Review
                    </button>
                    <button
                      className="cp-btn cp-btn--quiet"
                      disabled={savingKey === `request-${request.id}-${EVENT_BOOKING_REQUEST_STATUS.IN_TOUCH}`}
                      onClick={() => handleRequestStatus(request.id, EVENT_BOOKING_REQUEST_STATUS.IN_TOUCH)}
                      type="button"
                    >
                      Mark in touch
                    </button>
                    <button
                      className="cp-btn cp-btn--primary"
                      disabled={savingKey === `request-${request.id}-${EVENT_BOOKING_REQUEST_STATUS.CLOSED}`}
                      onClick={() => handleRequestStatus(request.id, EVENT_BOOKING_REQUEST_STATUS.CLOSED)}
                      type="button"
                    >
                      Close
                    </button>
                    <button
                      className="cp-btn cp-btn--danger"
                      disabled={savingKey === `delete-request-${request.id}`}
                      onClick={() => handleRequestDelete(request)}
                      type="button"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cp-message-preview" style={{ marginTop: 18 }}>
              No booking enquiries have been submitted for this talent yet.
            </div>
          )}
        </article>
      </div>
    </>
  )
}
