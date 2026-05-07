import { motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, Clock3, ShoppingBag, Star } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import TalentAvatar from '../ui/TalentAvatar'
import PageWrapper from './PageWrapper'
import { revealUp } from '../../utils/motion'

const tabClassName = ({ isActive }) => `cp-talent-tab${isActive ? ' is-active' : ''}`

export default function TalentDetailLayout({
  talent,
  activeTab,
  eyebrow = 'Talent profile',
  title,
  intro,
  children,
  aside,
  backLink = '/talents',
  backLabel = 'Back to talents',
}) {
  const tabs = [
    { id: 'services', label: 'Services', to: `/talent/${talent.id}`, end: true },
    { id: 'events', label: 'Event Booking', to: `/talent/${talent.id}/events` },
    { id: 'shop', label: 'Merch', href: talent.shopLink },
    { id: 'messages', label: 'Direct messaging', to: `/talent/${talent.id}/messages` },
    { id: 'reviews', label: 'Reviews', to: `/talent/${talent.id}/reviews` },
  ]

  return (
    <PageWrapper className={`cp-page--talent cp-page--talent-${activeTab}`}>
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <Link className="cp-payment-backlink cp-detail-backlink" to={backLink}>
              <ArrowLeft size={14} />
              {backLabel}
            </Link>
            <span className="cp-eyebrow">{eyebrow}</span>
            <h1 className="cp-page-title">{title}</h1>
            <p className="cp-page-intro">{intro}</p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          <motion.div className="cp-profile-banner cp-surface cp-surface--accent" {...revealUp}>
            <TalentAvatar priority="high" sizes="92px" talent={talent} />

            <div>
              <div className="cp-inline-trust" style={{ marginBottom: 16 }}>
                <span className="cp-chip cp-chip--featured">
                  <Star size={14} />
                  Featured talent
                </span>
                <span className="cp-chip">
                  <Star size={14} />
                  {talent.rating.toFixed(1)} / 5 rating
                </span>
                <span className="cp-chip">
                  <Clock3 size={14} />
                  {talent.responseTime} response pace
                </span>
                <span className="cp-chip">
                  <CalendarDays size={14} />
                  {talent.eventBooking?.available ? 'Event booking open' : 'Event booking hidden'}
                </span>
                {talent.shopLink ? (
                  <span className="cp-chip">
                    <ShoppingBag size={14} />
                    Amazon merch
                  </span>
                ) : null}
              </div>

              <h2 className="section-title" style={{ marginBottom: 16 }}>
                {talent.name} <em>{talent.subcategory}</em>
              </h2>
              <p>{talent.bio}</p>
            </div>
          </motion.div>

          <motion.nav
            aria-label={`${talent.name} sections`}
            className="cp-talent-tabs cp-surface cp-surface--soft"
            {...revealUp}
          >
            {tabs.map((tab) => (
              tab.href ? (
                <a
                  key={tab.id}
                  className={`cp-talent-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  href={tab.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {tab.label}
                </a>
              ) : (
                <NavLink
                  key={tab.id}
                  className={tabClassName}
                  end={tab.end}
                  to={tab.to}
                >
                  {tab.label}
                </NavLink>
              )
            ))}
          </motion.nav>

          <div className={`cp-profile-grid${aside ? '' : ' cp-profile-grid--single'}`}>
            <div className="cp-step-stack">{children}</div>
            {aside ? <aside className="cp-sticky-stack">{aside}</aside> : null}
          </div>
        </div>
      </section>
    </PageWrapper>
  )
}
