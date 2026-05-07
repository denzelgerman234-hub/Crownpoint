import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Plane,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import Loader from '../components/ui/Loader'
import TalentSearchFilters from '../components/ui/TalentSearchFilters'
import TalentSummaryCard from '../components/ui/TalentSummaryCard'
import { useAuth } from '../hooks/useAuth'
import { useTalentFilters } from '../hooks/useTalentFilters'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import { submitEventBookingRequest } from '../services/eventBookingService'
import { revealUp } from '../utils/motion'

const EVENT_BOOKING_FEE_LABEL = '15% booking fee'
const EVENT_RESULTS_STEP = 9

const buildDefaultEventDetails = (talent) => ({
  celebrityName: talent?.name ?? '',
  eventDate: '',
  approximateBudget: '',
  eventType: '',
  eventLocation: '',
  additionalInfo: '',
})

const buildDefaultOrganizerDetails = (user) => ({
  fullName: user?.name ?? '',
  organizationName: '',
  jobTitle: user?.profile?.occupation ?? '',
  phoneNumber: user?.profile?.phone ?? '',
  emailAddress: user?.email ?? '',
  fullAddress: [user?.profile?.city, user?.profile?.country].filter(Boolean).join(', '),
  nearestAirport: '',
})

function AllTalentEventBooking() {
  const talentRoster = useTalentRoster()
  const availableTalents = useMemo(
    () => talentRoster.filter((talent) => talent.eventBooking?.available),
    [talentRoster],
  )
  const {
    activeCategory,
    canShowResults,
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
    showMoreResults,
  } = useTalentFilters(availableTalents, {
    requireSearch: true,
    visibleIncrement: EVENT_RESULTS_STEP,
    visibleResults: EVENT_RESULTS_STEP,
  })

  const helperText = !hasSearchIntent
    ? 'Search by name, category, or location to find the right talent for your event.'
    : isSearchPending
      ? 'Finding the best event-ready matches...'
      : isQueryTooShort
        ? 'Add one more letter or choose a category to continue.'
        : !resultCount
          ? 'No event-ready profiles match that search just yet.'
          : hiddenResultCount
            ? `${resultCount} matches found. Refine the search if you want a shorter shortlist.`
            : `${resultCount} event-booking match${resultCount === 1 ? '' : 'es'} ready.`

  return (
    <PageWrapper className="cp-page--events-index">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Event booking</span>
            <h1 className="cp-page-title">
              Find event-ready talent for the moment that matters <em>most.</em>
            </h1>
            <p className="cp-page-intro">
              Search by name, location, style, or category to open the event profiles that fit your brief.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          <TalentSearchFilters
            activeCategory={activeCategory}
            helperText={helperText}
            onCategoryChange={setActiveCategory}
            onClear={clearFilters}
            onSearchChange={setSearchQuery}
            placeholder="Search event-ready talents by name, city, style, or category"
            searchQuery={searchQuery}
          />

          {!availableTalents.length ? (
            <motion.article className="cp-info-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">Event booking</span>
              <h3>No talent is currently open for event booking.</h3>
              <p className="cp-text-muted">
                Booking profiles will appear here as soon as they are published by the CrownPoint team.
              </p>
            </motion.article>
          ) : null}

          {availableTalents.length && canShowResults && resultCount > 0 ? (
            <section className="cp-results-shell">
              <div className="cp-results-bar">
                <div className="cp-section-copy">
                  <span className="cp-eyebrow">Booking matches</span>
                  <h2 className="section-title">
                    Premium booking profiles aligned with your <em>search.</em>
                  </h2>
                </div>
                <div className="cp-results-meta">
                  <strong>{resultCount}</strong>
                  <span>event-ready talents</span>
                </div>
              </div>

              <div className="cp-card-grid">
                {filteredTalents.map((talent) => (
                  <div key={talent.id} className="cp-grid-card">
                    <TalentSummaryCard
                      badgeLabel={talent.eventBooking?.premiumLabel || 'Premium booking'}
                      ctaLabel="Request booking"
                      linkTo={`/talent/${talent.id}/events`}
                      talent={talent}
                    />
                  </div>
                ))}
              </div>

              {hiddenResultCount > 0 ? (
                <div className="cp-results-actions">
                  <button className="cp-btn cp-btn--ghost" onClick={showMoreResults} type="button">
                    Load {Math.min(EVENT_RESULTS_STEP, hiddenResultCount)} more booking matches
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

        </div>
      </section>
    </PageWrapper>
  )
}

function TalentEventBooking() {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isLoading, talent } = useResolvedTalent(id)
  const eventBooking = talent?.eventBooking ?? null
  const [submittedRequest, setSubmittedRequest] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [eventDetails, setEventDetails] = useState(() => buildDefaultEventDetails(talent))
  const [organizerDetails, setOrganizerDetails] = useState(() => buildDefaultOrganizerDetails(user))

  useEffect(() => {
    setEventDetails(buildDefaultEventDetails(talent))
    setSubmittedRequest(null)
  }, [talent, eventBooking])

  useEffect(() => {
    setOrganizerDetails((current) => ({
      ...current,
      fullName: current.fullName || user?.name || '',
      jobTitle: current.jobTitle || user?.profile?.occupation || '',
      phoneNumber: current.phoneNumber || user?.profile?.phone || '',
      emailAddress: current.emailAddress || user?.email || '',
      fullAddress:
        current.fullAddress ||
        [user?.profile?.city, user?.profile?.country].filter(Boolean).join(', '),
    }))
  }, [user])

  if (isLoading) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <Loader label="Loading event booking page..." />
          </div>
        </section>
      </PageWrapper>
    )
  }

  if (!talent) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <h2 className="section-title">
              This event booking page is currently <em>unavailable.</em>
            </h2>
            <p>
              We could not find that talent profile right now. Head back to event booking and choose
              another profile.
            </p>
            <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
              <Link className="cp-btn cp-btn--primary" to="/events">
                Browse event booking
              </Link>
            </div>
          </div>
        </section>
      </PageWrapper>
    )
  }

  const handleEventFieldChange = (field) => (event) => {
    setEventDetails((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleOrganizerFieldChange = (field) => (event) => {
    setOrganizerDetails((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!talent.eventBooking?.available) {
      showToast('This talent is not currently open for event booking.', 'warning')
      return
    }

    try {
      setIsSubmitting(true)

      const nextRequest = await submitEventBookingRequest({
        userId: user?.id ?? null,
        talentId: talent.id,
        ...eventDetails,
        ...organizerDetails,
      })

      setSubmittedRequest(nextRequest)
      showToast('Your booking request has been sent. Our team will be in touch shortly.', 'success')
      setEventDetails(buildDefaultEventDetails(talent))
      setOrganizerDetails(buildDefaultOrganizerDetails(user))
    } catch (error) {
      showToast(error.message || 'We could not send your booking request right now.', 'warning')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <TalentDetailLayout
      activeTab="events"
      backLabel="Back to event booking"
      backLink="/events"
      eyebrow="Event booking"
      intro={`Request ${talent.name} for private appearances, premium events, campaigns, and standout live moments.`}
      talent={talent}
      title={(
        <>
          {talent.name} for your next event. <em>Request a private booking.</em>
        </>
      )}
    >
      <motion.article className="cp-info-card cp-surface" {...revealUp}>
        <span className="cp-eyebrow">Booking request</span>
        <h3>Request booking information on {talent.name}</h3>
        <p className="cp-text-muted">
          {eventBooking?.intro}
        </p>

        <div className="cp-inline-trust" style={{ marginTop: 18 }}>
          <span className="cp-chip">{talent.location || 'Location pending'}</span>
          <span className="cp-chip">{eventBooking?.premiumLabel || 'Premium booking'}</span>
          <span className="cp-chip">{EVENT_BOOKING_FEE_LABEL}</span>
        </div>
      </motion.article>

      <motion.article className="cp-info-card cp-surface" {...revealUp}>
        <span className="cp-eyebrow">What to share</span>
        <ul className="cp-list">
          {(eventBooking?.eventTypes?.slice(0, 4) ?? []).map((eventType) => (
            <li key={eventType}>{eventType}</li>
          ))}
        </ul>
        <p className="cp-note">{eventBooking?.logisticsNotes}</p>
      </motion.article>

      <form className="cp-step-stack" onSubmit={handleSubmit}>
        <motion.article className="cp-info-card cp-surface" {...revealUp}>
          <span className="cp-eyebrow">Tell us about your event</span>
          <h3>Share the details that shape the booking.</h3>
          <p className="cp-text-muted">
            {eventBooking?.responseCommitment}
          </p>

          <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
            <div className="cp-field">
              <label htmlFor="event-booking-celebrity">Talent</label>
              <input
                id="event-booking-celebrity"
                onChange={handleEventFieldChange('celebrityName')}
                readOnly
                value={eventDetails.celebrityName}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-date">Event date</label>
              <input
                id="event-booking-date"
                onChange={handleEventFieldChange('eventDate')}
                type="date"
                value={eventDetails.eventDate}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-budget">Approximate budget</label>
              <select
                id="event-booking-budget"
                onChange={handleEventFieldChange('approximateBudget')}
                value={eventDetails.approximateBudget}
              >
                <option disabled value="">
                  Select approximate talent budget
                </option>
                {(eventBooking?.budgetOptions ?? []).map((budgetOption) => (
                  <option key={budgetOption} value={budgetOption}>
                    {budgetOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-type">Event type</label>
              <select
                id="event-booking-type"
                onChange={handleEventFieldChange('eventType')}
                value={eventDetails.eventType}
              >
                <option disabled value="">
                  Select event type
                </option>
                {(eventBooking?.eventTypes ?? []).map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </select>
            </div>

            <div className="cp-field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="event-booking-location">Event location</label>
              <input
                id="event-booking-location"
                onChange={handleEventFieldChange('eventLocation')}
                placeholder="e.g. Atlanta, Georgia"
                value={eventDetails.eventLocation}
              />
            </div>
          </div>

          <div className="cp-field" style={{ marginTop: 18 }}>
            <label htmlFor="event-booking-notes">Additional event information</label>
            <textarea
              id="event-booking-notes"
              onChange={handleEventFieldChange('additionalInfo')}
              placeholder="Tell us about the occasion, audience, venue format, brand context, or any details that matter."
              value={eventDetails.additionalInfo}
            />
          </div>
        </motion.article>

        <motion.article className="cp-info-card cp-surface" {...revealUp}>
          <span className="cp-eyebrow">Tell us about yourself / organisation</span>
          <h3>Give us the right contact and logistics details.</h3>

          <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
            <div className="cp-field">
              <label htmlFor="event-booking-full-name">Full name</label>
              <input
                id="event-booking-full-name"
                onChange={handleOrganizerFieldChange('fullName')}
                placeholder="Your full name"
                value={organizerDetails.fullName}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-organisation">Organisation (optional)</label>
              <input
                id="event-booking-organisation"
                onChange={handleOrganizerFieldChange('organizationName')}
                placeholder="Company, agency, venue, or organisation (optional)"
                value={organizerDetails.organizationName}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-job-title">Job title</label>
              <input
                id="event-booking-job-title"
                onChange={handleOrganizerFieldChange('jobTitle')}
                placeholder="Marketing Director, Event Producer..."
                value={organizerDetails.jobTitle}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-phone">Phone number</label>
              <input
                id="event-booking-phone"
                onChange={handleOrganizerFieldChange('phoneNumber')}
                placeholder="Your best contact number"
                value={organizerDetails.phoneNumber}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-email">Email address</label>
              <input
                id="event-booking-email"
                onChange={handleOrganizerFieldChange('emailAddress')}
                placeholder="you@example.com"
                type="email"
                value={organizerDetails.emailAddress}
              />
            </div>

            <div className="cp-field">
              <label htmlFor="event-booking-airport">Nearest airport</label>
              <input
                id="event-booking-airport"
                onChange={handleOrganizerFieldChange('nearestAirport')}
                placeholder="Nearest major airport"
                value={organizerDetails.nearestAirport}
              />
            </div>
          </div>

          <div className="cp-field" style={{ marginTop: 18 }}>
            <label htmlFor="event-booking-address">Full address</label>
            <textarea
              id="event-booking-address"
              onChange={handleOrganizerFieldChange('fullAddress')}
              placeholder="Full billing or organising address"
              value={organizerDetails.fullAddress}
            />
          </div>

          <div className="cp-card-actions" style={{ marginTop: 18 }}>
            <Link className="cp-btn cp-btn--ghost" to={`/talent/${talent.id}`}>
              Back to profile
            </Link>
            <button
              className="cp-btn cp-btn--primary"
              disabled={isSubmitting || !talent.eventBooking?.available}
              type="submit"
            >
              {isSubmitting ? 'Submitting request...' : 'Submit booking request'}
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.article>
      </form>

      {submittedRequest ? (
        <motion.article className="cp-info-card cp-surface" {...revealUp}>
          <span className="cp-eyebrow">Request received</span>
          <h3>Thank you. We have your event booking enquiry.</h3>
        <div className="cp-inline-trust" style={{ marginTop: 18 }}>
          <span className="cp-chip">Request #{submittedRequest.id}</span>
          <span className="cp-chip">{submittedRequest.approximateBudget}</span>
          <span className="cp-chip">{submittedRequest.eventType}</span>
        </div>
        <p className="cp-note">
          We&apos;ll review the date, location, and organiser details you shared and follow up with the next steps.
        </p>
      </motion.article>
      ) : null}

      <motion.article className="cp-info-card cp-surface" {...revealUp}>
        <span className="cp-eyebrow">Before you send</span>
        <ul className="cp-list">
          <li>Use the most realistic date, city, and budget range available right now.</li>
          <li>Include any audience, hospitality, or campaign context that may affect availability.</li>
          <li>Clear organiser details help our team follow up without delay.</li>
        </ul>
        <div className="cp-inline-trust" style={{ marginTop: 16 }}>
          <span className="cp-chip">
            <CalendarDays size={14} />
            Event timing
          </span>
          <span className="cp-chip">
            <Briefcase size={14} />
            Organiser details
          </span>
          <span className="cp-chip">
            <Plane size={14} />
            Travel logistics
          </span>
        </div>
      </motion.article>
    </TalentDetailLayout>
  )
}

export default function TalentEvents() {
  const { id } = useParams()

  return id ? <TalentEventBooking /> : <AllTalentEventBooking />
}
