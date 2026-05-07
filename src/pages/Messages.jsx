import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TalentAvatar from '../components/ui/TalentAvatar'
import { useAuth } from '../hooks/useAuth'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import {
  getUserThreads,
  refreshMessageThreads,
  subscribeToMessageUpdates,
} from '../services/messageService'
import { getTalentSnapshotById } from '../services/talentService'
import { MEMBERSHIP_PLANS } from '../utils/constants'
import { timeAgo } from '../utils/formatters'
import { revealUp } from '../utils/motion'

export default function Messages() {
  const { canMessage, currentPlan, currentPlanLabel, user } = useAuth()
  const talentRoster = useTalentRoster()
  const { showToast } = useToast()
  const [, setMessagesVersion] = useState(0)

  const unlockedTalents = useMemo(
    () => talentRoster.filter((talent) => canMessage(talent.id)),
    [canMessage, talentRoster],
  )
  const hasMessagingAccess = unlockedTalents.length > 0

  useEffect(() => {
    if (!user || !hasMessagingAccess) {
      return undefined
    }

    refreshMessageThreads().catch((error) => {
      showToast(error.message || 'We could not refresh your inbox right now.', 'warning')
    })

    return subscribeToMessageUpdates(() => {
      setMessagesVersion((current) => current + 1)
    })
  }, [hasMessagingAccess, showToast, user])

  const visibleThreads = user ? getUserThreads(user, unlockedTalents, currentPlanLabel) : []

  return (
    <PageWrapper className="cp-page--messages">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Private messages</span>
            <h1 className="cp-page-title">
              Stay in touch through your private <em>membership inbox.</em>
            </h1>
            <p className="cp-page-intro">
              {currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS
                ? 'Crown Access gives you a private inbox for every talent on the roster.'
                : 'Inner Circle keeps you connected to one chosen talent through a dedicated private inbox.'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          {visibleThreads.length > 0 ? (
            <motion.section className="cp-thread-list cp-thread-list--page cp-surface" {...revealUp}>
              <div className="cp-thread-list-head">
                <div>
                  <span className="cp-eyebrow">Unlocked threads</span>
                  <h2>Choose the inbox you want to open.</h2>
                  <p className="cp-text-muted">
                    Each conversation opens on its own page now, so you can jump into the message
                    box directly and come right back here when you are done.
                  </p>
                </div>

                <span className="cp-chip">
                  <MessageSquareText size={14} />
                  {visibleThreads.length} unlocked thread{visibleThreads.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="cp-thread-stack">
                {visibleThreads.map((thread) => {
                  const talent = getTalentSnapshotById(thread.talentId)

                  return (
                    <Link key={thread.id} className="cp-thread-item" to={`/messages/${thread.id}`}>
                      <TalentAvatar
                        sizes="48px"
                        talent={talent ?? { name: thread.talentName, initials: thread.talentName.charAt(0) }}
                      />
                      <div className="cp-thread-copy">
                        <strong>{thread.talentName}</strong>
                        <span>{thread.preview}</span>
                      </div>
                      <span className="cp-thread-time">
                        {thread.lastActiveAt ? timeAgo(thread.lastActiveAt) : 'now'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </motion.section>
          ) : (
            <div className="cp-empty-state">
              <div className="cp-container">
                <span className="cp-eyebrow">Messages locked</span>
                <h2 className="section-title">
                  Direct talent messaging opens once you join <em>Inner Circle or Crown Access.</em>
                </h2>
                <p>
                  Your account is active, but the membership inbox is still locked. Compare pricing
                  or submit a membership request to open it.
                </p>
                <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                  <Link className="cp-btn cp-btn--primary" to="/pricing">
                    View pricing
                  </Link>
                  <Link className="cp-btn cp-btn--ghost" to="/membership">
                    Open membership desk
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {currentPlan === MEMBERSHIP_PLANS.INNER_CIRCLE ? (
            <motion.div className="cp-locked-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">Upgrade option</span>
              <h3>Upgrade to Crown Access to open every talent inbox.</h3>
              <p>
                If you want to go beyond one artist, Crown Access expands your access while keeping
                everything in one private place.
              </p>
              <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                <span className="cp-chip">
                  <Sparkles size={14} />
                  Upgrade when you want more access
                </span>
              </div>
            </motion.div>
          ) : null}
        </div>
      </section>
    </PageWrapper>
  )
}
