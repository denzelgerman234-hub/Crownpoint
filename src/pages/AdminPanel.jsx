import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, Flag, MessageSquareText, ShieldAlert, XCircle } from 'lucide-react'
import PaymentSettingsDesk from '../components/admin/PaymentSettingsDesk'
import TalentManagementDesk from '../components/admin/TalentManagementDesk'
import TalentInboxDesk from '../components/admin/TalentInboxDesk'
import PageWrapper from '../components/layout/PageWrapper'
import StatusBadge from '../components/ui/StatusBadge'
import { useToast } from '../hooks/useToast'
import {
  getTalentInboxSummaries,
  refreshMessageThreads,
  subscribeToMessageUpdates,
} from '../services/messageService'
import {
  getMembershipQueue,
  refreshMembershipQueue,
  reviewMembershipRequest,
  subscribeToMembershipUpdates,
} from '../services/membershipService'
import {
  getPaymentQueue,
  refreshOrders,
  reviewPaymentOrder,
  subscribeToOrderUpdates,
} from '../services/orderService'
import { getAllTalents, subscribeToTalentRoster } from '../services/talentService'
import { MEMBERSHIP_PLANS, MEMBERSHIP_STATUS, ORDER_STATUS, PAYMENT_METHODS } from '../utils/constants'
import { getShippingAddressSummary } from '../utils/checkout'
import { supportedCurrencies } from '../utils/currency'
import { formatCurrency, timeAgo } from '../utils/formatters'
import { getBillingCycleLabel, getMembershipSelectionLabel } from '../utils/memberships'
import { revealUp } from '../utils/motion'

const paymentLabels = {
  [PAYMENT_METHODS.BANK]: 'Bank transfer',
  [PAYMENT_METHODS.GIFT_CARD]: 'Gift card',
  [PAYMENT_METHODS.CRYPTO]: 'Crypto',
}

const DESK_TABS = [
  { id: 'payments', label: 'Payments' },
  { id: 'memberships', label: 'Membership Requests' },
  { id: 'inboxes', label: 'Talent Inboxes' },
  { id: 'talents', label: 'Talent Management' },
  { id: 'settings', label: 'Payment Settings' },
]

const getLatestPendingTimestamp = (items, pendingStatus) =>
  items
    .filter((item) => item.status === pendingStatus)
    .reduce((latest, item) => {
      const timestamp = new Date(item.submittedAt ?? 0).getTime()
      return timestamp > latest ? timestamp : latest
    }, 0)

const getInboxReplyCount = (mailboxes) =>
  mailboxes.reduce((sum, mailbox) => sum + mailbox.needsReplyCount, 0)

const getInboxThreadCount = (mailboxes) =>
  mailboxes.reduce((sum, mailbox) => sum + mailbox.threadCount, 0)

const buildRiskSignals = ({ inboxMailboxes, membershipQueue, paymentQueue }) => {
  const signals = []
  const highRiskPayment = paymentQueue.find(
    (item) => item.risk === 'high' || item.status === ORDER_STATUS.FLAGGED,
  )
  const flaggedMembership = membershipQueue.find(
    (item) => item.status === MEMBERSHIP_STATUS.FLAGGED || item.risk === 'medium',
  )
  const inboxNeedingReply = [...inboxMailboxes]
    .filter((mailbox) => mailbox.needsReplyCount > 0)
    .sort((left, right) => right.needsReplyCount - left.needsReplyCount)[0]

  if (highRiskPayment) {
    signals.push({
      title: 'High-risk payment',
      detail: `REF #${highRiskPayment.refCode} for ${highRiskPayment.fanName} needs closer review before approval.`,
    })
  }

  if (flaggedMembership) {
    signals.push({
      title: 'Membership escalation',
      detail: `${flaggedMembership.fanName}'s ${getMembershipSelectionLabel(flaggedMembership.plan, flaggedMembership.billingCycle)} request needs a second look.`,
    })
  }

  if (inboxNeedingReply) {
    signals.push({
      title: 'Inbox reply backlog',
      detail: `${inboxNeedingReply.talentName} has ${inboxNeedingReply.needsReplyCount} conversation${inboxNeedingReply.needsReplyCount === 1 ? '' : 's'} waiting on a reply.`,
    })
  }

  return signals.slice(0, 3)
}

export default function AdminPanel() {
  const initialPaymentQueue = getPaymentQueue()
  const initialMembershipQueue = getMembershipQueue()
  const initialInboxMailboxes = getTalentInboxSummaries()
  const initialInboxReplyCount = getInboxReplyCount(initialInboxMailboxes)
  const paymentCurrencyCodes = Object.keys(supportedCurrencies)
  const shouldStartOnMemberships =
    getLatestPendingTimestamp(initialMembershipQueue, MEMBERSHIP_STATUS.UNDER_REVIEW) >
    getLatestPendingTimestamp(initialPaymentQueue, ORDER_STATUS.UNDER_REVIEW)
  const shouldStartOnInboxes =
    initialInboxReplyCount > 0 &&
    initialInboxReplyCount >=
      Math.max(
        initialPaymentQueue.filter((item) => item.status === ORDER_STATUS.UNDER_REVIEW).length,
        initialMembershipQueue.filter((item) => item.status === MEMBERSHIP_STATUS.UNDER_REVIEW).length,
      )

  const [activeTab, setActiveTab] = useState(
    shouldStartOnInboxes ? 'inboxes' : shouldStartOnMemberships ? 'memberships' : 'payments',
  )
  const [queue, setQueue] = useState(initialPaymentQueue)
  const [membershipQueue, setMembershipQueue] = useState(initialMembershipQueue)
  const [inboxMailboxes, setInboxMailboxes] = useState(initialInboxMailboxes)
  const [talentRoster, setTalentRoster] = useState([])
  const [talentRosterLoaded, setTalentRosterLoaded] = useState(false)
  const [settingsCurrencyCode, setSettingsCurrencyCode] = useState(paymentCurrencyCodes[0] ?? 'USD')
  const { showToast } = useToast()

  useEffect(() => {
    const syncOrders = () => setQueue(getPaymentQueue())
    syncOrders()
    refreshOrders().catch((error) => {
      showToast(error.message || 'We could not refresh the payment queue right now.', 'warning')
    })
    return subscribeToOrderUpdates(syncOrders)
  }, [showToast])

  useEffect(() => {
    const syncMemberships = () => setMembershipQueue(getMembershipQueue())
    syncMemberships()
    refreshMembershipQueue().catch((error) => {
      showToast(error.message || 'We could not refresh membership requests right now.', 'warning')
    })
    return subscribeToMembershipUpdates(syncMemberships)
  }, [showToast])

  useEffect(() => {
    const syncInboxes = () => setInboxMailboxes(getTalentInboxSummaries())
    syncInboxes()
    refreshMessageThreads()
      .then(syncInboxes)
      .catch((error) => {
        showToast(error.message || 'We could not refresh talent inboxes right now.', 'warning')
      })
    return subscribeToMessageUpdates(syncInboxes)
  }, [showToast])

  useEffect(() => {
    const syncTalents = async (nextRoster) => {
      const roster = Array.isArray(nextRoster) ? nextRoster : await getAllTalents()
      setTalentRoster(roster)
      setTalentRosterLoaded(true)
    }

    syncTalents()
    return subscribeToTalentRoster(syncTalents)
  }, [])

  const handleTalentRosterChange = useCallback((nextRoster) => {
    if (!Array.isArray(nextRoster)) {
      return
    }

    setTalentRoster(nextRoster)
    setTalentRosterLoaded(true)
  }, [])

  const paymentMetrics = useMemo(() => {
    const underReviewCount = queue.filter((item) => item.status === ORDER_STATUS.UNDER_REVIEW).length
    const flaggedCount = queue.filter((item) => item.status === ORDER_STATUS.FLAGGED).length
    const highRiskCount = queue.filter((item) => item.risk === 'high').length
    const queueValue = queue
      .filter((item) => item.status === ORDER_STATUS.UNDER_REVIEW)
      .reduce((sum, item) => sum + item.totalPrice, 0)

    return [
      { value: underReviewCount, label: 'Payments currently awaiting review' },
      { value: flaggedCount, label: 'Items flagged for closer investigation' },
      { value: highRiskCount, label: 'High-risk submissions currently visible in queue' },
      { value: formatCurrency(queueValue), label: 'Value represented by the live review queue' },
    ]
  }, [queue])

  const membershipMetrics = useMemo(() => {
    const underReviewCount = membershipQueue.filter(
      (item) => item.status === MEMBERSHIP_STATUS.UNDER_REVIEW,
    ).length
    const flaggedCount = membershipQueue.filter(
      (item) => item.status === MEMBERSHIP_STATUS.FLAGGED,
    ).length
    const approvedCount = membershipQueue.filter(
      (item) => item.status === MEMBERSHIP_STATUS.APPROVED,
    ).length
    const crownAccessCount = membershipQueue.filter(
      (item) => item.plan === MEMBERSHIP_PLANS.CROWN_ACCESS,
    ).length

    return [
      { value: underReviewCount, label: 'Membership submissions still awaiting review' },
      { value: flaggedCount, label: 'Membership items flagged for deeper checks' },
      { value: approvedCount, label: 'Membership approvals already processed' },
      { value: crownAccessCount, label: 'Crown Access requests visible in this queue' },
    ]
  }, [membershipQueue])

  const inboxMetrics = useMemo(() => {
    const totalThreads = getInboxThreadCount(inboxMailboxes)
    const needsReplyCount = getInboxReplyCount(inboxMailboxes)
    const activeTalents = inboxMailboxes.filter((mailbox) => mailbox.threadCount > 0).length
    const latestMailbox =
      [...inboxMailboxes]
        .filter((mailbox) => mailbox.lastActiveAt)
        .sort(
          (left, right) =>
            new Date(right.lastActiveAt).getTime() - new Date(left.lastActiveAt).getTime(),
        )[0] ?? null

    return [
      { value: needsReplyCount, label: 'Fan conversations currently waiting on a talent reply' },
      { value: totalThreads, label: 'Conversation threads currently stored in the inbox layer' },
      { value: activeTalents, label: 'Talents with at least one active fan thread' },
      { value: latestMailbox?.talentName ?? 'Quiet', label: 'Most recently active talent inbox' },
    ]
  }, [inboxMailboxes])

  const talentMetrics = useMemo(() => {
    const totalExperienceCount = talentRoster.reduce(
      (sum, talent) => sum + talent.services.length,
      0,
    )
    const totalEventBookingCount = talentRoster.filter((talent) => talent.eventBooking?.available).length
    const totalMerchLinkCount = talentRoster.filter((talent) => Boolean(talent.shopLink)).length
    const activeCategories = new Set(
      talentRoster.map((talent) => talent.category).filter(Boolean),
    ).size

    return [
      { value: talentRosterLoaded ? talentRoster.length : 'Loading', label: 'Talents currently available in the live roster' },
      { value: totalExperienceCount, label: 'Bookable experiences currently attached to the roster' },
      { value: totalEventBookingCount, label: 'Talent profiles currently open for event booking' },
      { value: totalMerchLinkCount, label: 'Talent profiles currently wired to an Amazon merch link' },
      { value: activeCategories, label: 'Talent categories currently represented in the roster' },
    ]
  }, [talentRoster, talentRosterLoaded])

  const settingsMetrics = useMemo(() => {
    const settingsCurrency = supportedCurrencies[settingsCurrencyCode] ?? supportedCurrencies.USD

    return [
      { value: settingsCurrency.code, label: 'Currency currently selected in the payment settings desk' },
      { value: 'Live', label: 'Published edits update payment and membership instructions right away' },
      { value: 'Bank / Gift / Crypto', label: 'Instruction groups available for each configured currency' },
      { value: 'No code edits', label: 'Finance changes can now be handled directly from admin' },
    ]
  }, [settingsCurrencyCode])

  const handlePaymentDecision = async (id, status, message) => {
    try {
      await reviewPaymentOrder(id, status)
      setQueue(getPaymentQueue())
      showToast(message, status === ORDER_STATUS.FAILED ? 'warning' : 'success')
    } catch (error) {
      showToast(error.message || 'We could not update that order right now.', 'warning')
    }
  }

  const handleMembershipDecision = async (id, status, message) => {
    try {
      await reviewMembershipRequest(id, status)
      setMembershipQueue(getMembershipQueue())
      showToast(message, status === MEMBERSHIP_STATUS.REJECTED ? 'warning' : 'success')
    } catch (error) {
      showToast(error.message || 'We could not update that membership request right now.', 'warning')
    }
  }

  const metrics =
    activeTab === 'payments'
      ? paymentMetrics
      : activeTab === 'memberships'
        ? membershipMetrics
        : activeTab === 'inboxes'
          ? inboxMetrics
          : activeTab === 'talents'
            ? talentMetrics
            : settingsMetrics
  const isPaymentFinal = (status) => [ORDER_STATUS.PAID, ORDER_STATUS.FAILED].includes(status)
  const isMembershipApproved = (status) => status === MEMBERSHIP_STATUS.APPROVED
  const pendingPaymentCount = queue.filter((item) => item.status === ORDER_STATUS.UNDER_REVIEW).length
  const pendingMembershipCount = membershipQueue.filter(
    (item) => item.status === MEMBERSHIP_STATUS.UNDER_REVIEW,
  ).length
  const pendingInboxReplies = getInboxReplyCount(inboxMailboxes)
  const eventBookingEnabledCount = talentRoster.filter((talent) => talent.eventBooking?.available).length
  const totalTalentAssets = talentRoster.reduce(
    (sum, talent) =>
      sum + talent.services.length + (talent.eventBooking?.available ? 1 : 0) + (talent.shopLink ? 1 : 0),
    0,
  )
  const settingsCurrency = supportedCurrencies[settingsCurrencyCode] ?? supportedCurrencies.USD
  const inboxThreadCount = getInboxThreadCount(inboxMailboxes)
  const activeInboxTalentCount = inboxMailboxes.filter((mailbox) => mailbox.threadCount > 0).length
  const riskSignals = useMemo(
    () =>
      buildRiskSignals({
        inboxMailboxes,
        membershipQueue,
        paymentQueue: queue,
      }),
    [inboxMailboxes, membershipQueue, queue],
  )

  return (
    <PageWrapper className="cp-page--admin">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Admin desk</span>
            <h1 className="cp-page-title">
              Review payments, memberships, talent inboxes, talent management, and payment settings in one calmer, more <em>auditable console.</em>
            </h1>
            <p className="cp-page-intro">
              The admin desk now keeps finance approvals, talent management, and talent messaging together so operations can respond without losing context.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          <div className="cp-inline-trust" style={{ marginBottom: 16 }}>
            <span className="cp-chip">Booking proof approvals live under Payments</span>
            <span className="cp-chip">Membership proof approvals unlock messaging access</span>
            <span className="cp-chip">Talent Inboxes let admin reply as the talent</span>
            <span className="cp-chip">Talent Management keeps roster, experiences, event booking, and merch links in clear lanes</span>
            <span className="cp-chip">Payment Settings update what users see by currency</span>
          </div>

          <div className="cp-payment-tabs" style={{ marginBottom: 20 }}>
            {DESK_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`cp-tab-button${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
                {' '}
                <span style={{ opacity: 0.74 }}>
                  (
                  {tab.id === 'payments'
                    ? pendingPaymentCount
                    : tab.id === 'memberships'
                      ? pendingMembershipCount
                      : tab.id === 'inboxes'
                        ? pendingInboxReplies
                        : tab.id === 'talents'
                          ? talentRosterLoaded ? totalTalentAssets : '...'
                          : settingsCurrencyCode}
                  )
                </span>
              </button>
            ))}
          </div>

          <div className="cp-metric-grid">
            {metrics.map((metric) => (
              <motion.div key={metric.label} className="cp-metric-card cp-surface" {...revealUp}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 12 }}>
        <div className="cp-container cp-admin-grid">
          <div className="cp-queue-list">
            {activeTab === 'payments'
              ? (queue.length ? queue.map((item) => (
                  <motion.article key={item.id} className="cp-queue-card cp-surface" {...revealUp}>
                    <div className="cp-queue-card-header">
                      <div>
                        <span className="cp-eyebrow">REF #{item.refCode}</span>
                        <h3>{item.fanName}</h3>
                        <p className="cp-text-muted">
                          {item.talentName} / {paymentLabels[item.paymentMethod]} / {timeAgo(item.submittedAt)}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
                        <StatusBadge status={item.status} />
                        <span className={`cp-risk-badge cp-risk-badge--${item.risk}`}>{item.risk} risk</span>
                      </div>
                    </div>

                    <div className="cp-message-preview">
                      <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                        Review proof
                      </strong>
                      {item.proofSummary}
                    </div>

                    {item.shippingAddress?.addressLine1 ? (
                      <div className="cp-message-preview">
                        <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                          Shipping details
                        </strong>
                        {[getShippingAddressSummary(item.shippingAddress), item.shippingAddress.addressLine1, item.shippingAddress.addressLine2, [item.shippingAddress.city, item.shippingAddress.stateOrRegion, item.shippingAddress.postalCode].filter(Boolean).join(', ')].filter(Boolean).join(' / ')}
                      </div>
                    ) : null}

                    <div className="cp-meta-row">
                      <span>{formatCurrency(item.totalPrice)}</span>
                      <span>{item.region}</span>
                      <span>{item.talentName}</span>
                    </div>

                    <div className="cp-queue-card-footer">
                      <div className="cp-action-row">
                        <button
                          className="cp-btn cp-btn--primary"
                          disabled={isPaymentFinal(item.status)}
                          onClick={() =>
                            handlePaymentDecision(item.id, ORDER_STATUS.PAID, `Approved REF #${item.refCode}.`)
                          }
                          type="button"
                        >
                          <BadgeCheck size={14} />
                          {item.status === ORDER_STATUS.PAID ? 'Approved' : 'Approve'}
                        </button>
                        <button
                          className="cp-btn cp-btn--ghost"
                          disabled={isPaymentFinal(item.status)}
                          onClick={() =>
                            handlePaymentDecision(item.id, ORDER_STATUS.FAILED, `Rejected REF #${item.refCode}.`)
                          }
                          type="button"
                        >
                          <XCircle size={14} />
                          {item.status === ORDER_STATUS.FAILED ? 'Rejected' : 'Reject'}
                        </button>
                        <button
                          className="cp-btn cp-btn--quiet"
                          disabled={isPaymentFinal(item.status) || item.status === ORDER_STATUS.FLAGGED}
                          onClick={() =>
                            handlePaymentDecision(
                              item.id,
                              ORDER_STATUS.FLAGGED,
                              `Flagged REF #${item.refCode} for escalation.`,
                            )
                          }
                          type="button"
                        >
                          <Flag size={14} />
                          {item.status === ORDER_STATUS.FLAGGED ? 'Flagged' : 'Flag'}
                        </button>
                      </div>
                    </div>
                  </motion.article>
                )) : (
                  <motion.article className="cp-info-card cp-surface" {...revealUp}>
                    <span className="cp-eyebrow">Payments queue</span>
                    <h3>No payment proofs are waiting right now.</h3>
                    <p className="cp-text-muted">
                      Submitted order payments will appear here for approval, rejection, or flagging.
                    </p>
                  </motion.article>
                ))
              : activeTab === 'memberships'
                ? (membershipQueue.length ? membershipQueue.map((item) => (
                    <motion.article key={item.id} className="cp-queue-card cp-surface" {...revealUp}>
                      <div className="cp-queue-card-header">
                        <div>
                          <span className="cp-eyebrow">{getMembershipSelectionLabel(item.plan, item.billingCycle)}</span>
                          <h3>{item.fanName}</h3>
                          <p className="cp-text-muted">
                            {item.talentName} / {paymentLabels[item.paymentMethod]} / {timeAgo(item.submittedAt)}
                          </p>
                        </div>
                        <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
                          <StatusBadge status={item.status} />
                          <span className={`cp-risk-badge cp-risk-badge--${item.risk}`}>{item.risk} risk</span>
                        </div>
                      </div>

                      <div className="cp-message-preview">
                        <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                          Review proof
                        </strong>
                        {item.proofSummary}
                      </div>

                      <div className="cp-meta-row">
                        <span>{formatCurrency(item.amountUsd, item.currencyCode)}</span>
                        <span>{getBillingCycleLabel(item.billingCycle) || 'Monthly'} billing</span>
                        <span>{item.region}</span>
                        <span>{item.talentName}</span>
                      </div>

                      <div className="cp-queue-card-footer">
                        <div className="cp-action-row">
                          <button
                            className="cp-btn cp-btn--primary"
                            disabled={isMembershipApproved(item.status)}
                            onClick={() =>
                              handleMembershipDecision(
                                item.id,
                                MEMBERSHIP_STATUS.APPROVED,
                                `Approved ${getMembershipSelectionLabel(item.plan, item.billingCycle)} for ${item.fanName}.`,
                              )
                            }
                            type="button"
                          >
                            <BadgeCheck size={14} />
                            {item.status === MEMBERSHIP_STATUS.APPROVED ? 'Approved' : 'Approve'}
                          </button>
                          <button
                            className="cp-btn cp-btn--ghost"
                            disabled={item.status === MEMBERSHIP_STATUS.REJECTED}
                            onClick={() =>
                              handleMembershipDecision(
                                item.id,
                                MEMBERSHIP_STATUS.REJECTED,
                                `Rejected ${getMembershipSelectionLabel(item.plan, item.billingCycle)} for ${item.fanName}.`,
                              )
                            }
                            type="button"
                          >
                            <XCircle size={14} />
                            {item.status === MEMBERSHIP_STATUS.REJECTED ? 'Rejected' : 'Reject'}
                          </button>
                          <button
                            className="cp-btn cp-btn--quiet"
                            disabled={item.status === MEMBERSHIP_STATUS.FLAGGED}
                            onClick={() =>
                              handleMembershipDecision(
                                item.id,
                                MEMBERSHIP_STATUS.FLAGGED,
                                `Flagged ${getMembershipSelectionLabel(item.plan, item.billingCycle)} for extra review.`,
                              )
                            }
                            type="button"
                          >
                            <Flag size={14} />
                            {item.status === MEMBERSHIP_STATUS.FLAGGED ? 'Flagged' : 'Flag'}
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  )) : (
                    <motion.article className="cp-info-card cp-surface" {...revealUp}>
                      <span className="cp-eyebrow">Membership queue</span>
                      <h3>No membership proofs are waiting right now.</h3>
                      <p className="cp-text-muted">
                        New membership submissions will appear here and can be approved to unlock fan messaging access.
                      </p>
                    </motion.article>
                  ))
                : activeTab === 'inboxes'
                  ? (
                    <TalentInboxDesk />
                  )
                  : activeTab === 'talents'
                    ? (
                      <TalentManagementDesk onRosterChange={handleTalentRosterChange} />
                    )
                  : (
                    <PaymentSettingsDesk
                      currencyCode={settingsCurrencyCode}
                      onCurrencyChange={setSettingsCurrencyCode}
                    />
                  )}
          </div>

          <aside className="cp-sticky-stack">
            <motion.div className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
              <span className="cp-eyebrow">Desk behavior</span>
              <h3>
                {activeTab === 'payments'
                  ? 'Payment decisions should be obvious.'
                  : activeTab === 'memberships'
                    ? 'Membership approvals should stay distinct from orders.'
                    : activeTab === 'inboxes'
                      ? 'Talent replies should be easy to route.'
                      : activeTab === 'talents'
                        ? 'Talent operations should stay structured and easy to scan.'
                      : `${settingsCurrency.code} instructions should stay easy to maintain.`}
              </h3>
              <p className="cp-text-muted">
                {activeTab === 'payments'
                  ? 'Queue cards expose amount, method, risk, and proof clearly enough that the right action is immediate.'
                  : activeTab === 'memberships'
                    ? 'Membership cards expose plan, chosen talent, region, method, and proof so approvals update the correct user record with confidence.'
                    : activeTab === 'inboxes'
                      ? 'Inbox threads are normalized by fan and talent so admin can reply from one place now and a backend API can replace the local layer cleanly later.'
                      : activeTab === 'talents'
                        ? 'This desk now splits profiles, event booking, merch routing, and services into clearer management views while still writing into the same live roster store.'
                      : `This desk now controls what users see for ${settingsCurrency.regionLabel}. Save and publish after each change so payment and membership screens stay aligned.`}
              </p>
              <ul className="cp-checklist">
                {activeTab === 'payments' ? (
                  <>
                    <li>Approve when proof aligns with order, method, and amount.</li>
                    <li>Reject when funds or value cannot be verified.</li>
                    <li>Flag suspicious proofs for deeper investigation.</li>
                  </>
                ) : activeTab === 'memberships' ? (
                  <>
                    <li>Approve when plan, talent scope, and proof all line up cleanly.</li>
                    <li>Reject when the proof is missing or the plan request is unclear.</li>
                    <li>Flag anything suspicious instead of mixing it into the order desk.</li>
                  </>
                ) : activeTab === 'inboxes' ? (
                  <>
                    <li>Each talent keeps a dedicated inbox that grows automatically as fan conversations appear.</li>
                    <li>Replying from admin writes back into the exact same thread the fan sees on their side.</li>
                    <li>The thread shape is normalized so backend work can swap storage without rewriting the UI contract.</li>
                  </>
                ) : activeTab === 'talents' ? (
                  <>
                    <li>Roster, experiences, event booking, and merch routing now live in separate admin views so each workflow stays focused.</li>
                    <li>Talent booking profiles and incoming event enquiries can now be managed without leaving admin.</li>
                    <li>Everything still updates the same roster data the public directory, profile, merch redirect, and booking flows already read.</li>
                  </>
                ) : (
                  <>
                    <li>Bank rows render exactly as payment instructions for this currency.</li>
                    <li>Gift card labels drive the accepted card dropdown users see.</li>
                    <li>Crypto assets and wallet rows power the asset and network selectors.</li>
                  </>
                )}
              </ul>
            </motion.div>

            {activeTab === 'settings' ? (
              <motion.div className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Current currency</span>
                <h3>{settingsCurrency.code} / {settingsCurrency.label}</h3>
                <ul className="cp-list">
                  <li>{settingsCurrency.regionLabel} is the market currently open in Payment Settings.</li>
                  <li>Save and publish changes there to refresh the payment desk and membership payment instructions.</li>
                  <li>The selected currency code also shows on the admin tab so you always know what you are editing.</li>
                </ul>
                <span className="cp-chip">
                  <ShieldAlert size={14} />
                  Admin-managed payment setup
                </span>
              </motion.div>
            ) : activeTab === 'inboxes' ? (
              <motion.div className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Inbox coverage</span>
                <h3>{activeInboxTalentCount} talent inboxes are active</h3>
                <ul className="cp-list">
                  <li>{pendingInboxReplies} conversation{pendingInboxReplies === 1 ? '' : 's'} are waiting on a talent reply.</li>
                  <li>{inboxThreadCount} total thread{inboxThreadCount === 1 ? '' : 's'} are stored in the current inbox layer.</li>
                  <li>Every talent on the roster gets a mailbox automatically, even if it has no fan messages yet.</li>
                </ul>
                <span className="cp-chip">
                  <MessageSquareText size={14} />
                  Admin-operated talent messaging
                </span>
              </motion.div>
            ) : activeTab === 'talents' ? (
              <motion.div className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Talent coverage</span>
                <h3>
                  {talentRosterLoaded
                    ? `${talentRoster.length} talent profile${talentRoster.length === 1 ? '' : 's'} are live`
                    : 'Loading live talent coverage'}
                </h3>
                <ul className="cp-list">
                  <li>{totalTalentAssets} total roster asset{totalTalentAssets === 1 ? '' : 's'} are currently published across services, event booking, and merch links.</li>
                  <li>{eventBookingEnabledCount} talent profile{eventBookingEnabledCount === 1 ? '' : 's'} currently accept event booking enquiries.</li>
                  <li>The directory, profile, booking, event booking, and merch redirect pages all still read from this same roster layer.</li>
                </ul>
                <span className="cp-chip">
                  <ShieldAlert size={14} />
                  Admin-managed talent lineup
                </span>
              </motion.div>
            ) : (
              <motion.div className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Risk watchlist</span>
                <h3>
                  {riskSignals.length ? 'Current signals worth attention' : 'No elevated signals right now'}
                </h3>
                <ul className="cp-list">
                  {(riskSignals.length ? riskSignals : [{
                    title: 'Queue is calm',
                    detail: 'New payment proofs, membership requests, and inbox backlogs will appear here when they need attention.',
                  }]).map((flag) => (
                    <li key={flag.title}>
                      <strong style={{ color: 'var(--white)' }}>{flag.title}:</strong> {flag.detail}
                    </li>
                  ))}
                </ul>
                <span className="cp-chip">
                  <ShieldAlert size={14} />
                  Escalation-friendly workflow
                </span>
              </motion.div>
            )}
          </aside>
        </div>
      </section>
    </PageWrapper>
  )
}
