import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Globe2,
  MapPin,
  Mic,
  PenLine,
  PhoneCall,
  Sparkles,
  Star,
  Video,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import Loader from '../components/ui/Loader'
import TalentSummaryCard from '../components/ui/TalentSummaryCard'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { formatCurrency } from '../utils/formatters'
import { revealUp } from '../utils/motion'

const serviceIcons = {
  VIDEO_MESSAGE: Video,
  REACTION: Video,
  REVIEW: Sparkles,
  VOICE_DROP: Mic,
  COACHING: PhoneCall,
  LIVE_CALL: PhoneCall,
  SIGNED_NOTE: PenLine,
  SIGNED_MERCH: PenLine,
}

export default function TalentProfile() {
  const { id } = useParams()
  const talentRoster = useTalentRoster()
  const { isLoading, talent } = useResolvedTalent(id)
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [mobileRelatedPage, setMobileRelatedPage] = useState(0)

  if (isLoading) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <Loader label="Loading talent profile..." />
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
              This talent profile is currently <em>unavailable.</em>
            </h2>
            <p>
              We could not find that profile. Head back to the directory to explore the available
              talent.
            </p>
            <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
              <Link className="cp-btn cp-btn--primary" to="/talents">
                Back to directory
              </Link>
            </div>
          </div>
        </section>
      </PageWrapper>
    )
  }

  const resolvedSelectedServiceId = talent.services.some((service) => service.id === selectedServiceId)
    ? selectedServiceId
    : talent.services[0]?.id ?? null
  const selectedService =
    talent.services.find((service) => service.id === resolvedSelectedServiceId) ?? talent.services[0] ?? null
  const relatedTalents = talentRoster.filter(
    (candidate) => candidate.id !== talent.id && candidate.category === talent.category,
  )
  const featuredRelatedTalents = relatedTalents.slice(0, 4)
  const desktopRelatedTalents = featuredRelatedTalents.slice(0, 3)
  const mobileRelatedPages = Math.max(1, Math.ceil(featuredRelatedTalents.length / 2))
  const activeMobileRelatedPage = Math.min(mobileRelatedPage, mobileRelatedPages - 1)
  const mobileRelatedStartIndex = activeMobileRelatedPage * 2
  const mobileRelatedTalents = featuredRelatedTalents.slice(
    mobileRelatedStartIndex,
    mobileRelatedStartIndex + 2,
  )
  const showMobileRelatedNavigation = featuredRelatedTalents.length > 2

  const renderSelectedServiceCard = (className = '') => (
    <motion.div
      className={`cp-summary-card cp-surface cp-surface--accent ${className}`.trim()}
      {...revealUp}
    >
      <span className="cp-eyebrow">Selected service</span>
      <h3>{selectedService?.label ?? 'Services coming soon'}</h3>
      <p className="cp-text-muted">
        {selectedService?.description ?? 'This talent profile is live, but bookable services have not been published yet.'}
      </p>

      <div className="cp-price-row">
        <div>
          <strong>{selectedService ? formatCurrency(selectedService.price) : 'Unavailable'}</strong>
          <span>{selectedService ? 'current selection' : 'waiting on live services'}</span>
        </div>
        <span>{talent.responseTime} delivery cue</span>
      </div>

      {selectedService ? (
        <div className="cp-card-actions">
          <Link
            className="cp-btn cp-btn--primary"
            to={`/experiences?talent=${talent.id}&service=${selectedService.id}`}
          >
            Choose this experience
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}
    </motion.div>
  )

  const renderRelatedTalentCard = (candidate) => (
    <TalentSummaryCard
      key={candidate.id}
      className="cp-surface--soft"
      ctaLabel="View profile"
      talent={candidate}
    />
  )

  return (
    <TalentDetailLayout
      activeTab="services"
      eyebrow="Talent profile"
      intro={`Explore services, event booking, and private access options for ${talent.name} in one place.`}
      talent={talent}
      title={(
        <>
          {talent.name}, available for moments that deserve something <em>unforgettable.</em>
        </>
      )}
      aside={renderSelectedServiceCard('cp-desktop-only')}
    >
      <motion.article
        className="cp-info-card cp-surface cp-talent-section--signature"
        {...revealUp}
      >
        <span className="cp-eyebrow">Signature services</span>
        <h3>Choose the experience lens that fits the moment.</h3>
        {talent.services.length ? (
          <div className="cp-service-list">
            {talent.services.map((service) => {
              const Icon = serviceIcons[service.type] ?? Sparkles
              const isSelected = service.id === selectedService?.id

              return (
                <button
                  key={service.id}
                    className={`cp-service-card${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedServiceId(service.id)}
                  type="button"
                >
                  <span className="cp-icon-wrap" style={{ marginBottom: 0 }}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{service.label}</strong>
                    <p>{service.description}</p>
                  </div>
                  <span className="cp-service-price">{formatCurrency(service.price)}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="cp-message-preview">
            Services have not been published for this talent yet. Check back soon for live experience
            options.
          </div>
        )}
      </motion.article>

      <motion.article className="cp-info-card cp-surface cp-talent-section--profile" {...revealUp}>
        <span className="cp-eyebrow">Profile details</span>
        <h3>Key details at a glance</h3>
        <div className="cp-meta-row">
          <span>
            <MapPin size={12} />
            {talent.location}
          </span>
          <span>
            <Globe2 size={12} />
            {talent.languages.join(', ')}
          </span>
          <span>
            <Star size={12} />
            {talent.rating.toFixed(1)} / 5 public rating
          </span>
          <span>{talent.completedBookings.toLocaleString()} completed experiences</span>
        </div>
        <div className="cp-tag-row">
          {talent.tags.map((tag) => (
            <span key={tag} className="cp-tag">
              {tag}
            </span>
          ))}
        </div>
      </motion.article>

      {renderSelectedServiceCard('cp-mobile-only cp-talent-section--selected-mobile')}

      {relatedTalents.length ? (
        <>
          <motion.article
            className="cp-info-card cp-surface cp-mobile-only cp-talent-section--related-mobile"
            {...revealUp}
          >
            <div className="cp-related-roster-mobile-head">
              <div>
                <span className="cp-eyebrow">Related roster</span>
                <h3>More talent you may also like.</h3>
              </div>

              {showMobileRelatedNavigation ? (
                <div className="cp-carousel-nav">
                  <button
                    aria-label="Previous related talent"
                    className="cp-carousel-nav-button"
                    disabled={activeMobileRelatedPage === 0}
                    onClick={() => setMobileRelatedPage((current) => Math.max(0, current - 1))}
                    type="button"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    aria-label="Next related talent"
                    className="cp-carousel-nav-button"
                    disabled={activeMobileRelatedPage >= mobileRelatedPages - 1}
                    onClick={() =>
                      setMobileRelatedPage((current) =>
                        Math.min(mobileRelatedPages - 1, current + 1),
                      )
                    }
                    type="button"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="cp-related-roster-mobile-grid">
              {mobileRelatedTalents.map((candidate) => (
                <div key={candidate.id} className="cp-related-roster-mobile-slide">
                  {renderRelatedTalentCard(candidate)}
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article className="cp-info-card cp-surface cp-desktop-only" {...revealUp}>
            <span className="cp-eyebrow">Related roster</span>
            <h3>More talent you may also like.</h3>
            <div className="cp-card-grid">
              {desktopRelatedTalents.map((candidate) => renderRelatedTalentCard(candidate))}
            </div>
          </motion.article>
        </>
      ) : null}
    </TalentDetailLayout>
  )
}
