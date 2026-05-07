import { motion } from 'framer-motion'
import { MessageSquareText, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import PageWrapper from '../components/layout/PageWrapper'
import Loader from '../components/ui/Loader'
import MembershipGate from '../components/membership/MembershipGate'
import { useAuth } from '../hooks/useAuth'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { revealUp } from '../utils/motion'

export default function TalentMessaging() {
  const { id } = useParams()
  const { canMessage, currentPlanLabel, user } = useAuth()
  const { isLoading, talent } = useResolvedTalent(id)

  if (isLoading) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <Loader label="Loading messaging access..." />
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
              This messaging page is currently <em>unavailable.</em>
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

  const hasMessagingAccess = Boolean(user && canMessage(talent.id))

  return (
    <TalentDetailLayout
      activeTab="messages"
      eyebrow="Direct messaging"
      intro={`Open or unlock ${talent.name}'s private inbox from the same profile flow.`}
      talent={talent}
      title={(
        <>
          Direct messaging with {talent.name}. <em>Keep the connection personal.</em>
        </>
      )}
      aside={null}
    >
      <motion.div {...revealUp}>
        <MembershipGate talent={talent} />
      </motion.div>

      <div className="cp-support-grid">
        <motion.article className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
          <span className="cp-eyebrow">Inbox status</span>
          <h3>
            {hasMessagingAccess
              ? `${talent.name}'s inbox is ready.`
              : 'Membership unlocks this inbox.'}
          </h3>
          <p className="cp-text-muted">
            {hasMessagingAccess
              ? 'Use the button on this page to jump straight into the conversation.'
              : 'Inner Circle and Crown Access unlock private talent messaging right from this tab.'}
          </p>

          <div className="cp-inline-trust" style={{ marginTop: 18 }}>
            <span className="cp-chip">
              <MessageSquareText size={14} />
              {hasMessagingAccess ? currentPlanLabel : 'Private messages'}
            </span>
            <span className="cp-chip">
              <Sparkles size={14} />
              Talent-specific inbox
            </span>
          </div>
        </motion.article>

        <motion.article className="cp-info-card cp-surface" {...revealUp}>
          <span className="cp-eyebrow">What this tab does</span>
          <h3>Everything for direct talent messaging now lives in one place.</h3>
          <ul className="cp-list">
            <li>Open the inbox immediately when your membership already includes this talent.</li>
            <li>Upgrade from here if you still need access.</li>
            <li>Keep messaging tied to the same talent profile you are exploring.</li>
          </ul>
        </motion.article>
      </div>
    </TalentDetailLayout>
  )
}
