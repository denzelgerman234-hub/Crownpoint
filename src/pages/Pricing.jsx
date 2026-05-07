import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Globe2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import BillingCycleToggle from '../components/membership/BillingCycleToggle'
import PageWrapper from '../components/layout/PageWrapper'
import {
  getMembershipPriceLabel,
  getMembershipPriceUsd,
  isValidMembershipBillingCycle,
  membershipJourney,
  membershipPlans,
} from '../data/membershipPlans'
import { useAuth } from '../hooks/useAuth'
import {
  getCurrencyConfig,
  getCurrencyPreference,
  setCurrencyPreference,
  subscribeToCurrencyChanges,
  supportedCurrencies,
} from '../utils/currency'
import { MEMBERSHIP_BILLING_CYCLES, MEMBERSHIP_PLANS } from '../utils/constants'
import { formatCurrency } from '../utils/formatters'
import { revealUp } from '../utils/motion'

const buildPlanLink = (planId, billingCycle = MEMBERSHIP_BILLING_CYCLES.MONTHLY) =>
  `/membership?plan=${planId}&cycle=${billingCycle}`

const renderPlanCardBody = ({
  actionLabel,
  actionLink,
  billingCycle,
  currencyCode,
  isCurrentPlan,
  isPaidPlan,
  plan,
}) => {
  const planPrice = getMembershipPriceUsd(plan.id, billingCycle)

  return (
    <>
      <div className="cp-plan-card-top">
        <span className="cp-eyebrow">{plan.eyebrow}</span>
        <div className="cp-plan-card-top-meta">
          {isCurrentPlan ? <span className="cp-plan-badge">Current</span> : null}
        </div>
      </div>

      <h3>{plan.name}</h3>
      <p className="cp-text-muted">{plan.summary}</p>

      <div className="cp-plan-price">
        <strong>{formatCurrency(planPrice, currencyCode)}</strong>
        <span>{isPaidPlan ? getMembershipPriceLabel(billingCycle) : 'included'}</span>
      </div>

      <ul className="cp-checklist">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <div className="cp-card-actions">
        <Link
          className={`cp-btn ${isCurrentPlan ? 'cp-btn--ghost' : 'cp-btn--primary'}`}
          to={actionLink}
        >
          {actionLabel}
        </Link>
        {isPaidPlan ? (
          <Link className="cp-btn cp-btn--quiet" to={buildPlanLink(plan.id, billingCycle)}>
            Open application
            <ArrowRight size={14} />
          </Link>
        ) : null}
      </div>
    </>
  )
}

export default function Pricing() {
  const { currentPlan, currentPlanLabel, user } = useAuth()
  const [currencyCode, setCurrencyCode] = useState(() => getCurrencyPreference())
  const [billingCycle, setBillingCycle] = useState(() =>
    isValidMembershipBillingCycle(MEMBERSHIP_BILLING_CYCLES.MONTHLY)
      ? MEMBERSHIP_BILLING_CYCLES.MONTHLY
      : MEMBERSHIP_BILLING_CYCLES.MONTHLY,
  )
  const currencyConfig = getCurrencyConfig(currencyCode)

  useEffect(() => subscribeToCurrencyChanges(setCurrencyCode), [])

  const handleCurrencyChange = (event) => {
    const nextCurrency = event.target.value
    setCurrencyCode(nextCurrency)
    setCurrencyPreference(nextCurrency)
  }

  return (
    <PageWrapper className="cp-page--pricing">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Membership pricing</span>
            <h1 className="cp-page-title">
              Choose the membership that matches how closely you want to <em>stay connected.</em>
            </h1>
            <p className="cp-page-intro">
              Every plan is designed around private access, exclusive updates, and premium
              experiences, with pricing shown in your local currency.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          <motion.div className="cp-currency-bar cp-surface" {...revealUp}>
            <div>
              <span className="cp-eyebrow">Regional pricing</span>
              <h3>Showing prices in {currencyConfig.label}</h3>
              <p className="cp-text-muted">
                Detected region: {currencyConfig.regionLabel}. Switch currencies if you want to
                preview another market.
              </p>
            </div>

            <label className="cp-currency-select" htmlFor="currency-preference">
              <Globe2 size={16} />
              <select
                id="currency-preference"
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
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 12 }}>
        <div className="cp-container">
          <div className="cp-plan-grid-shell">
            <BillingCycleToggle billingCycle={billingCycle} onChange={setBillingCycle} />

            <div className="cp-plan-grid">
            {membershipPlans.map((plan) => {
              const isCurrentPlan = currentPlan === plan.id
              const isPaidPlan = plan.id !== MEMBERSHIP_PLANS.FREE
              const actionLabel = isCurrentPlan
                ? `Current plan: ${currentPlanLabel}`
                : user
                  ? plan.ctaLabel
                  : plan.id === MEMBERSHIP_PLANS.FREE
                    ? 'Create free account'
                    : 'Create account to apply'

              const buildActionLink = (faceCycle) => {
                const authRedirect = encodeURIComponent(buildPlanLink(plan.id, faceCycle))

                return user
                  ? isCurrentPlan && plan.id === MEMBERSHIP_PLANS.FREE
                    ? '/dashboard'
                    : buildPlanLink(plan.id, faceCycle)
                  : `/auth?mode=signup&redirect=${authRedirect}`
              }

              return (
                <motion.article
                  key={plan.id}
                  className={`cp-plan-card cp-plan-card--${plan.tone}${isCurrentPlan ? ' is-current' : ''}${isPaidPlan ? ` cp-plan-card--flip${billingCycle === MEMBERSHIP_BILLING_CYCLES.YEARLY ? ' is-flipped' : ''}` : ' cp-surface'}`}
                  {...revealUp}
                >
                  {isPaidPlan ? (
                    <div className="cp-plan-card-stage">
                      <div className="cp-plan-card-face cp-surface">
                        {renderPlanCardBody({
                          actionLabel,
                          actionLink: buildActionLink(MEMBERSHIP_BILLING_CYCLES.MONTHLY),
                          billingCycle: MEMBERSHIP_BILLING_CYCLES.MONTHLY,
                          currencyCode,
                          isCurrentPlan,
                          isPaidPlan,
                          plan,
                        })}
                      </div>

                      <div className="cp-plan-card-face cp-plan-card-face--back cp-surface">
                        {renderPlanCardBody({
                          actionLabel,
                          actionLink: buildActionLink(MEMBERSHIP_BILLING_CYCLES.YEARLY),
                          billingCycle: MEMBERSHIP_BILLING_CYCLES.YEARLY,
                          currencyCode,
                          isCurrentPlan,
                          isPaidPlan,
                          plan,
                        })}
                      </div>
                    </div>
                  ) : (
                    renderPlanCardBody({
                      actionLabel,
                      actionLink: buildActionLink(MEMBERSHIP_BILLING_CYCLES.MONTHLY),
                      billingCycle: MEMBERSHIP_BILLING_CYCLES.MONTHLY,
                      currencyCode,
                      isCurrentPlan,
                      isPaidPlan,
                      plan,
                    })
                  )}
                </motion.article>
              )
            })}
            </div>
          </div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 12 }}>
        <div className="cp-container">
          <div className="cp-process-grid">
            {membershipJourney.map((item) => (
              <motion.article key={item.step} className="cp-step-card cp-surface" {...revealUp}>
                <span className="cp-step-number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </PageWrapper>
  )
}
