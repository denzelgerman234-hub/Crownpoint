import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import PageWrapper from '../components/layout/PageWrapper'
import Loader from '../components/ui/Loader'
import MembershipGate from '../components/membership/MembershipGate'
import { useAuth } from '../hooks/useAuth'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { useToast } from '../hooks/useToast'
import {
  getUserThreadByTalent,
  refreshMessageThreads,
  subscribeToMessageUpdates,
} from '../services/messageService'
import { timeAgo } from '../utils/formatters'
import { revealUp } from '../utils/motion'

const buildTalentInboxLink = (talentId) =>
  `/messages/talent/${talentId}?${new URLSearchParams({
    back: `/talent/${talentId}/messages`,
    backLabel: 'Back to talent profile',
  }).toString()}`

export default function TalentMessaging() {
  const { id } = useParams()
  const { canMessage, currentPlanLabel, user } = useAuth()
  const { showToast } = useToast()
  const { isLoading, talent } = useResolvedTalent(id)
  const [, setMessagesVersion] = useState(0)

  const hasMessagingAccess = Boolean(user && talent && canMessage(talent.id))
  const activeThread =
    user && talent && hasMessagingAccess
      ? getUserThreadByTalent(user, talent, currentPlanLabel)
      : null
  const lastMessage = activeThread?.messages[activeThread.messages.length - 1] ?? null

  useEffect(() => {
    if (!user || !talent || !hasMessagingAccess) {
      return undefined
    }

    refreshMessageThreads({ talentId: talent.id }).catch((error) => {
      showToast(error.message || 'We could not refresh this conversation right now.', 'warning')
    })

    return subscribeToMessageUpdates(() => {
      setMessagesVersion((current) => current + 1)
    })
  }, [hasMessagingAccess, showToast, talent, user])

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
      {hasMessagingAccess ? (
        <>
          <div className="cp-support-grid">
            <motion.article className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
              <span className="cp-eyebrow">Inbox status</span>
              <h3>
                {activeThread
                  ? `${talent.name} conversation is active.`
                  : `${talent.name} is unlocked and ready when you are.`}
              </h3>
              <p className="cp-text-muted">
                {activeThread
                  ? 'Your live conversation is ready, and the full chat box opens on its own thread page.'
                  : 'Open the dedicated chat thread whenever you are ready to send the first message.'}
              </p>

              <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                <span className="cp-chip">
                  <MessageSquareText size={14} />
                  {currentPlanLabel}
                </span>
                <span className="cp-chip">
                  <Sparkles size={14} />
                  {activeThread ? 'Active conversation' : 'Start on first send'}
                </span>
                {lastMessage ? (
                  <span className="cp-chip">
                    Updated {timeAgo(lastMessage.createdAt || activeThread?.lastActiveAt)}
                  </span>
                ) : null}
              </div>

              <div className="cp-card-actions" style={{ marginTop: 18 }}>
                <Link className="cp-btn cp-btn--ghost" to={buildTalentInboxLink(talent.id)}>
                  Open message inbox
                  <ArrowRight size={14} />
                </Link>
              </div>
            </motion.article>

            <motion.article className="cp-info-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">Private messaging</span>
              <h3>The chat box now opens on its own page.</h3>
              <ul className="cp-list">
                <li>Your messages stay together in one dedicated conversation thread.</li>
                <li>Use the inbox button above to jump straight into the chat box itself.</li>
                <li>Come back to this tab any time if you want the profile context first.</li>
              </ul>
            </motion.article>
          </div>
        </>
      ) : (
        <>
          <motion.div {...revealUp}>
            <MembershipGate talent={talent} />
          </motion.div>

          <div className="cp-support-grid">
            <motion.article className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
              <span className="cp-eyebrow">Inbox status</span>
              <h3>Membership unlocks this inbox.</h3>
              <p className="cp-text-muted">
                Inner Circle and Crown Access unlock private talent messaging right from this tab.
              </p>

              <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                <span className="cp-chip">
                  <MessageSquareText size={14} />
                  Private messages
                </span>
                <span className="cp-chip">
                  <Sparkles size={14} />
                  Talent-specific inbox
                </span>
              </div>
            </motion.article>

            <motion.article className="cp-info-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">What this tab does</span>
              <h3>This tab now sends you into the dedicated inbox when access is live.</h3>
              <ul className="cp-list">
                <li>Open the live conversation from here when your membership already includes this talent.</li>
                <li>Upgrade from here if you still need access.</li>
                <li>Keep messaging tied to the same talent profile you are exploring.</li>
              </ul>
            </motion.article>
          </div>
        </>
      )}
    </TalentDetailLayout>
  )
}
