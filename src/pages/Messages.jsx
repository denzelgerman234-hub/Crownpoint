import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TalentSearchFilters from '../components/ui/TalentSearchFilters'
import TalentAvatar from '../components/ui/TalentAvatar'
import { useAuth } from '../hooks/useAuth'
import { useTalentFilters } from '../hooks/useTalentFilters'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import {
  getUserThreads,
  refreshMessageThreads,
  subscribeToMessageUpdates,
} from '../services/messageService'
import { MEMBERSHIP_PLANS } from '../utils/constants'
import { timeAgo } from '../utils/formatters'
import { revealUp } from '../utils/motion'

const buildThreadLink = (threadId) =>
  `/messages/${threadId}?${new URLSearchParams({
    back: '/messages',
    backLabel: 'Back to message inbox',
  }).toString()}`

const buildTalentThreadLink = (talentId) =>
  `/messages/talent/${talentId}?${new URLSearchParams({
    back: '/messages',
    backLabel: 'Back to message inbox',
  }).toString()}`

const buildStarterHelperText = ({
  currentPlan,
  hasSearchIntent,
  isQueryTooShort,
  resultCount,
  unlockedCount,
}) => {
  if (currentPlan !== MEMBERSHIP_PLANS.CROWN_ACCESS) {
    return unlockedCount
      ? 'Your unlocked talent is ready whenever you want to start the conversation.'
      : 'Upgrade your membership to unlock direct talent messaging.'
  }

  if (!hasSearchIntent) {
    return 'Search by talent name, category, or location to start or resume a conversation. Unused inboxes stay hidden until you send the first message.'
  }

  if (isQueryTooShort) {
    return 'Type at least 2 characters or choose a category to narrow the roster.'
  }

  if (!resultCount) {
    return 'No unlocked talent matches that search right now.'
  }

  return `Showing ${resultCount} unlocked talent${resultCount === 1 ? '' : 's'} that match the current search.`
}

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
  const threadByTalentId = new Map(
    visibleThreads.map((thread) => [Number(thread.talentId), thread]),
  )
  const singleUnlockedTalent = unlockedTalents[0] ?? null
  const {
    activeCategory,
    clearFilters,
    filteredTalents,
    hasSearchIntent,
    isQueryTooShort,
    resultCount,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
  } = useTalentFilters(unlockedTalents, {
    requireSearch: currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS && unlockedTalents.length > 1,
    visibleResults: 8,
    visibleIncrement: 8,
  })
  const starterHelperText = useMemo(
    () =>
      buildStarterHelperText({
        currentPlan,
        hasSearchIntent,
        isQueryTooShort,
        resultCount,
        unlockedCount: unlockedTalents.length,
      }),
    [currentPlan, hasSearchIntent, isQueryTooShort, resultCount, unlockedTalents.length],
  )

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
                ? 'Crown Access lets you start a private conversation with any talent, while only the conversations you actually start appear here.'
                : 'Inner Circle unlocks a dedicated talent inbox, and the conversation appears here once you send the first message.'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          {hasMessagingAccess ? (
            <>
              <motion.section className="cp-info-card cp-surface" {...revealUp}>
                <div className="cp-thread-list-head">
                  <div>
                    <span className="cp-eyebrow">Start or resume</span>
                    <h2>
                      {currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS
                        ? 'Search for the talent you want to message.'
                        : 'Your unlocked talent is ready when you want to reach out.'}
                    </h2>
                    <p className="cp-text-muted">
                      {currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS
                        ? 'Choose a talent and open the conversation whenever you are ready.'
                        : 'Open the chat thread to start the conversation or continue an active one.'}
                    </p>
                  </div>

                  <div className="cp-inline-trust">
                    <span className="cp-chip">
                      <Sparkles size={14} />
                      {unlockedTalents.length} unlocked talent{unlockedTalents.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS ? (
                  <>
                    <TalentSearchFilters
                      activeCategory={activeCategory}
                      helperText={starterHelperText}
                      onCategoryChange={setActiveCategory}
                      onClear={clearFilters}
                      onSearchChange={setSearchQuery}
                      panelClassName="cp-filter-panel cp-surface cp-surface--soft"
                      placeholder="Search unlocked talents by name, category, or location"
                      searchQuery={searchQuery}
                    />

                    {!isQueryTooShort && filteredTalents.length ? (
                      <div className="cp-thread-stack" style={{ marginTop: 18 }}>
                        {filteredTalents.map((talent) => {
                          const activeThread = threadByTalentId.get(Number(talent.id)) ?? null
                          const target = activeThread
                            ? buildThreadLink(activeThread.id)
                            : buildTalentThreadLink(talent.id)

                          return (
                            <Link key={talent.id} className="cp-thread-item" to={target}>
                              <TalentAvatar sizes="48px" talent={talent} />
                              <div className="cp-thread-copy">
                                <strong>{talent.name}</strong>
                                <span>
                                  {activeThread
                                    ? activeThread.preview || 'Resume your active conversation.'
                                    : 'Open the chat thread to send the first message and start the conversation.'}
                                </span>
                              </div>
                              <div className="cp-admin-thread-meta">
                                <span className="cp-thread-time">
                                  {activeThread
                                    ? `Active ${timeAgo(activeThread.lastActiveAt)}`
                                    : 'Start conversation'}
                                </span>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    ) : null}
                  </>
                ) : singleUnlockedTalent ? (
                  <div className="cp-thread-stack" style={{ marginTop: 18 }}>
                    <Link
                      className="cp-thread-item"
                      to={
                        threadByTalentId.get(Number(singleUnlockedTalent.id))
                          ? buildThreadLink(threadByTalentId.get(Number(singleUnlockedTalent.id)).id)
                          : buildTalentThreadLink(singleUnlockedTalent.id)
                      }
                    >
                      <TalentAvatar sizes="48px" talent={singleUnlockedTalent} />
                      <div className="cp-thread-copy">
                        <strong>{singleUnlockedTalent.name}</strong>
                        <span>
                          {threadByTalentId.get(Number(singleUnlockedTalent.id))
                            ? 'Resume your active conversation from the chat thread or your inbox.'
                            : 'Open the chat thread to send the first message and start the conversation.'}
                        </span>
                      </div>
                      <span className="cp-thread-time">
                        {threadByTalentId.get(Number(singleUnlockedTalent.id))
                          ? 'Conversation active'
                          : 'Start conversation'}
                      </span>
                    </Link>
                  </div>
                ) : null}
              </motion.section>

              <motion.section className="cp-thread-list cp-thread-list--page cp-surface" {...revealUp}>
                <div className="cp-thread-list-head">
                  <div>
                    <span className="cp-eyebrow">Active conversations</span>
                    <h2>Your current messages.</h2>
                    <p className="cp-text-muted">
                      Open any conversation below to continue where you left off.
                    </p>
                  </div>

                  <span className="cp-chip">
                    <MessageSquareText size={14} />
                    {visibleThreads.length} active conversation{visibleThreads.length === 1 ? '' : 's'}
                  </span>
                </div>

                {visibleThreads.length ? (
                  <div className="cp-thread-stack">
                    {visibleThreads.map((thread) => (
                      <Link
                        key={thread.id}
                        className="cp-thread-item"
                        to={buildThreadLink(thread.id)}
                      >
                        <TalentAvatar
                          sizes="48px"
                          talent={{ name: thread.talentName, initials: thread.talentName.charAt(0) }}
                        />
                        <div className="cp-thread-copy">
                          <strong>{thread.talentName}</strong>
                          <span>{thread.preview || 'Open the latest conversation.'}</span>
                        </div>
                        <span className="cp-thread-time">
                          {thread.lastActiveAt ? timeAgo(thread.lastActiveAt) : 'now'}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="cp-message-preview">
                    No active conversations yet. When you send your first message, it will appear
                    here automatically.
                  </div>
                )}
              </motion.section>
            </>
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
              <h3>Upgrade to Crown Access to search and message any unlocked talent on demand.</h3>
              <p>
                Crown Access now keeps the inbox clean by letting you search first, then start the
                specific conversation you want.
              </p>
              <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                <span className="cp-chip">
                  <Sparkles size={14} />
                  Upgrade when you want broader access
                </span>
              </div>
            </motion.div>
          ) : null}
        </div>
      </section>
    </PageWrapper>
  )
}
