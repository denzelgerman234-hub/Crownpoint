import { motion, useInView, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Gift,
  PhoneCall,
  Sparkles,
  Video,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TalentSummaryCard from '../components/ui/TalentSummaryCard'
import heroBackdrop from '../assets/hero-backdrop.png'
import { useFeaturedTalents } from '../hooks/useFeaturedTalents'
import { testimonials } from '../data/testimonials'
import {
  bookingJourney,
  conciergePromises,
  experienceModes,
  heroStats,
} from '../data/demoData'
import { revealUp, staggerChild, staggerParent } from '../utils/motion'

const experienceIcons = {
  Video,
  PhoneCall,
  Gift,
  Sparkles,
}

const heroImage = 'https://images.unsplash.com/photo-1753030768124-dba306907bba?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=80&w=1600'

const parseStatValue = (value = '') => {
  const match = value.match(/^([^0-9]*)([\d,.]+)(.*)$/)

  if (!match) {
    return {
      decimals: 0,
      minIntegerDigits: 0,
      padWhole: false,
      prefix: '',
      suffix: '',
      target: 0,
    }
  }

  const [, prefix, numericPart, suffix] = match
  const normalizedValue = numericPart.replace(/,/g, '')
  const [wholePart = '', fractionalPart = ''] = normalizedValue.split('.')

  return {
    decimals: fractionalPart.length,
    minIntegerDigits: wholePart.length,
    padWhole: /^0\d+$/.test(wholePart),
    prefix,
    suffix,
    target: Number.parseFloat(normalizedValue) || 0,
  }
}

const formatStatValue = (parsedValue, amount) => {
  if (!parsedValue.target) {
    return `${parsedValue.prefix}${parsedValue.suffix}`.trim()
  }

  const safeAmount = Math.max(0, Math.min(parsedValue.target, amount))
  const rawValue =
    parsedValue.decimals > 0
      ? safeAmount.toFixed(parsedValue.decimals)
      : Math.round(safeAmount).toString()
  const [wholePart = '', fractionalPart = ''] = rawValue.split('.')
  const normalizedWhole =
    parsedValue.padWhole && parsedValue.decimals === 0
      ? wholePart.padStart(parsedValue.minIntegerDigits, '0')
      : wholePart

  return parsedValue.decimals > 0
    ? `${parsedValue.prefix}${normalizedWhole}.${fractionalPart}${parsedValue.suffix}`
    : `${parsedValue.prefix}${normalizedWhole}${parsedValue.suffix}`
}

function CountUpStat({ start, value }) {
  const prefersReducedMotion = useReducedMotion()
  const parsedValue = useMemo(() => parseStatValue(value), [value])
  const [displayValue, setDisplayValue] = useState(() =>
    prefersReducedMotion ? value : formatStatValue(parsedValue, 0),
  )
  const restingValue = prefersReducedMotion ? value : formatStatValue(parsedValue, 0)

  useEffect(() => {
    if (!start || prefersReducedMotion) {
      return
    }

    let animationFrame = 0
    let startTime = 0
    const duration = 1600

    const step = (timestamp) => {
      if (!startTime) {
        startTime = timestamp
      }

      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easedProgress = 1 - (1 - progress) ** 3
      setDisplayValue(formatStatValue(parsedValue, parsedValue.target * easedProgress))

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step)
      }
    }

    animationFrame = window.requestAnimationFrame(step)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [parsedValue, prefersReducedMotion, start, value])

  return <span aria-label={value}>{start ? (prefersReducedMotion ? value : displayValue) : restingValue}</span>
}

export default function Home() {
  const featuredTalents = useFeaturedTalents(6)
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { amount: 0.35, once: true })

  return (
    <PageWrapper className="cp-page--home">
      <section
        className="cp-hero"
        style={{ '--cp-hero-backdrop': `url(${heroBackdrop})` }}
      >
        <div className="cp-container cp-hero-grid">
          <motion.div className="cp-hero-copy" {...revealUp}>
            <span className="cp-eyebrow">Private concierge experiences</span>
            <h1 className="cp-hero-title">
              Where fandom meets <em>white-glove access.</em>
            </h1>
            <p className="cp-hero-body">
              CrownPoint turns celebrity connection into a polished concierge experience, with a
              cleaner path from discovery to request to follow-up.
            </p>

            <div className="cp-hero-actions">
              <Link className="cp-btn cp-btn--primary" to="/experiences">
                Start an experience brief
                <ArrowRight size={14} />
              </Link>
              <Link className="cp-btn cp-btn--ghost" to="/talents">
                Browse the roster
              </Link>
            </div>

            <div className="cp-inline-trust">
              <span className="cp-chip">
                <Video size={14} />
                <strong>Video messages</strong>
              </span>
              <span className="cp-chip">
                <PhoneCall size={14} />
                <strong>Private live calls</strong>
              </span>
              <span className="cp-chip">
                <Gift size={14} />
                <strong>Signed keepsakes</strong>
              </span>
            </div>
          </motion.div>

          <motion.div className="cp-hero-visual" {...revealUp}>
            <div className="cp-hero-outline" />
            <div className="cp-hero-frame">
              <img alt="Luxury event space with chandeliers and spotlights" src={heroImage} />
            </div>

            <div className="cp-floating-card cp-floating-card--top cp-surface cp-surface--accent">
              <span className="cp-eyebrow">Concierge note</span>
              <h3>Luxury access, not clutter.</h3>
              <p>
                Every order keeps the signal clear: the talent, the experience, the reference
                code, and the next step.
              </p>
            </div>

            <div className="cp-floating-card cp-floating-card--bottom cp-surface">
              <span className="cp-eyebrow">Popular formats</span>
              <div className="cp-mini-list">
                <div className="cp-mini-row">
                  <span>For birthdays</span>
                  <strong>Video message</strong>
                </div>
                <div className="cp-mini-row">
                  <span>For private access</span>
                  <strong>Live call</strong>
                </div>
                <div className="cp-mini-row">
                  <span>For collectors</span>
                  <strong>Signed item</strong>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section ref={statsRef} className="cp-stats-bar">
        <div className="cp-container cp-stats-shell">
          <motion.div className="cp-stats-head" {...revealUp}>
            <span className="cp-eyebrow">By the numbers</span>
            <p className="cp-stats-copy">
              A quick signal of roster depth, concierge pace, experience range, and demand.
            </p>
          </motion.div>

          <motion.div
            animate={statsInView ? 'visible' : 'hidden'}
            className="cp-stats-grid"
            initial="hidden"
            variants={staggerParent}
          >
            {heroStats.map((stat, index) => (
              <motion.article
                key={stat.label}
                className="cp-stat cp-surface"
                variants={staggerChild}
              >
                <span className="cp-stat-kicker">{String(index + 1).padStart(2, '0')}</span>
                <strong className="cp-stat-value">
                  <CountUpStat start={statsInView} value={stat.value} />
                </strong>
                <p className="cp-stat-label">{stat.label}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container">
          <div className="cp-section-head">
            <div className="cp-section-copy">
              <span className="cp-eyebrow">Featured talents</span>
              <h2 className="section-title">
                Discover talent selected for <em>truly memorable occasions.</em>
              </h2>
              <p>
                Explore the roster, compare styles and services, and move confidently into the
                experience that fits the moment.
              </p>
            </div>
            <Link className="cp-link-inline" to="/talents">
              View full directory
              <ArrowRight size={14} />
            </Link>
          </div>

          <motion.div
            className="cp-card-grid"
            initial="hidden"
            variants={staggerParent}
            viewport={{ once: true, amount: 0.15 }}
            whileInView="visible"
          >
            {featuredTalents.map((talent) => (
              <motion.div
                key={talent.id}
                className="cp-grid-card"
                variants={staggerChild}
              >
                <TalentSummaryCard
                  badgeLabel="Top pick"
                  ctaLabel="View profile"
                  talent={talent}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container">
          <div className="cp-section-head">
            <div className="cp-section-copy">
              <span className="cp-eyebrow">Experience design</span>
              <h2 className="section-title">
                Choose the experience that best suits the <em>occasion.</em>
              </h2>
              <p>
                From thoughtful video messages and reactions to voice drops, coaching sessions,
                signed pieces, and event booking, every request is handled with care.
              </p>
            </div>
          </div>

          <div className="cp-card-grid cp-card-grid--four">
            {experienceModes.map((mode) => {
              const Icon = experienceIcons[mode.iconKey] ?? Sparkles

              return (
                <motion.article key={mode.title} className="cp-feature-card cp-surface" {...revealUp}>
                  <span className="cp-icon-wrap">
                    <Icon size={20} />
                  </span>
                  <h3>{mode.title}</h3>
                  <p>{mode.description}</p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container">
          <div className="cp-section-head">
            <div className="cp-section-copy">
              <span className="cp-eyebrow">How it works</span>
              <h2 className="section-title">
                The booking journey stays elegant from the first brief to the <em>final delivery.</em>
              </h2>
            </div>
          </div>

          <div className="cp-process-grid">
            {bookingJourney.map((step) => (
              <motion.article key={step.step} className="cp-step-card cp-surface" {...revealUp}>
                <span className="cp-step-number">{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container">
          <div className="cp-section-head">
            <div className="cp-section-copy">
              <span className="cp-eyebrow">Fan sentiment</span>
              <h2 className="section-title">
                The best premium experiences still feel <em>personal and human.</em>
              </h2>
            </div>
          </div>

          <div className="cp-testimonial-grid">
            {testimonials.slice(0, 4).map((testimonial) => (
              <motion.article key={testimonial.id} className="cp-quote-card cp-surface" {...revealUp}>
                <blockquote>&quot;{testimonial.text}&quot;</blockquote>
                <footer>
                  <span className="cp-avatar" style={{ background: 'linear-gradient(135deg, #2b6d4d, #0f2f21)' }}>
                    {testimonial.initials}
                  </span>
                  <div>
                    <strong>{testimonial.name}</strong>
                    <div className="cp-text-muted">
                      {testimonial.experience} / {testimonial.location}
                    </div>
                  </div>
                </footer>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container">
          <div className="cp-card-grid">
            {conciergePromises.map((promise) => (
              <motion.article key={promise.title} className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Inside the experience</span>
                <h3>{promise.title}</h3>
                <p>{promise.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-section">
        <div className="cp-container">
          <div className="cp-cta-band cp-surface cp-surface--accent">
            <div>
              <span className="cp-eyebrow">Ready to begin</span>
              <h2>Plan a request worth remembering.</h2>
              <p>
                Tell us who you have in mind, share the occasion, and we will guide you from your
                brief to confirmation with concierge-level care.
              </p>
            </div>
            <Link className="cp-btn cp-btn--primary" to="/experiences">
              Start your experience
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </PageWrapper>
  )
}
