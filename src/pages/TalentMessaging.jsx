import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import PageWrapper from '../components/layout/PageWrapper'
import Loader from '../components/ui/Loader'
import MembershipGate from '../components/membership/MembershipGate'
import MessageAttachmentList from '../components/ui/MessageAttachmentList'
import MessageComposer from '../components/ui/MessageComposer'
import TalentAvatar from '../components/ui/TalentAvatar'
import { useAuth } from '../hooks/useAuth'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { useToast } from '../hooks/useToast'
import {
  getUserThreadByTalent,
  refreshMessageThreads,
  sendFanMessage,
  startFanConversation,
  subscribeToMessageUpdates,
} from '../services/messageService'
import { timeAgo } from '../utils/formatters'
import { revealUp } from '../utils/motion'

export default function TalentMessaging() {
  const { id } = useParams()
  const { canMessage, currentPlanLabel, user } = useAuth()
  const { showToast } = useToast()
  const { isLoading, talent } = useResolvedTalent(id)
  const messageIdRef = useRef(0)
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

  const getNextMessageId = () => {
    messageIdRef.current += 1
    return `${activeThread?.id ?? `thread-${user?.id ?? 'fan'}-${talent?.id ?? 'talent'}`}-${messageIdRef.current}`
  }

  const handleSend = async ({ attachments, text }) => {
    if (!user || !talent) {
      throw new Error('Sign in and choose a valid talent before sending a message.')
    }

    if (activeThread) {
      await sendFanMessage({
        threadId: activeThread.id,
        text,
        attachments,
        fanName: user.name,
        messageId: getNextMessageId(),
      })
      showToast(`Message sent to ${talent.name}.`, 'success')
      return
    }

    await startFanConversation({
      attachments,
      currentPlanLabel,
      fanName: user.name,
      messageId: getNextMessageId(),
      talent,
      text,
      user,
    })
    showToast(`Conversation started with ${talent.name}.`, 'success')
  }

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
                  ? 'You already have a live conversation here. New messages will keep this thread in your inbox and the admin desk.'
                  : 'Search-first messaging is active now. Your inbox stays clean until you send the first message.'}
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
              </div>

              <div className="cp-card-actions" style={{ marginTop: 18 }}>
                <Link className="cp-btn cp-btn--ghost" to="/messages">
                  Open message inbox
                  <ArrowRight size={14} />
                </Link>
              </div>
            </motion.article>

            <motion.article className="cp-info-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">How it works</span>
              <h3>Unlocked access no longer creates background chats.</h3>
              <ul className="cp-list">
                <li>Your inbox only shows conversations you actually start.</li>
                <li>The admin desk only sees this talent thread after your first message lands.</li>
                <li>Once the chat is active, new replies keep updating here and in your inbox.</li>
              </ul>
            </motion.article>
          </div>

          <motion.section className="cp-chat-card cp-surface cp-surface--accent" {...revealUp}>
            <div className="cp-chat-header">
              <div className="cp-chat-title">
                <TalentAvatar sizes="48px" talent={talent} />
                <div>
                  <strong>{talent.name}</strong>
                  <span>
                    {activeThread
                      ? activeThread.topic
                      : `${currentPlanLabel} access is live for this talent.`}
                  </span>
                </div>
              </div>

              <div className="cp-inline-trust">
                <span className="cp-chip">
                  <MessageSquareText size={14} />
                  {activeThread ? 'Conversation live' : 'No thread yet'}
                </span>
                {lastMessage ? (
                  <span className="cp-chip">
                    Updated {timeAgo(lastMessage.createdAt || activeThread?.lastActiveAt)}
                  </span>
                ) : (
                  <span className="cp-chip">Appears after first message</span>
                )}
              </div>
            </div>

            {activeThread?.messages.length ? (
              <div className="cp-chat-feed">
                {activeThread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`cp-chat-bubble cp-chat-bubble--${message.senderRole}`}
                  >
                    {message.text ? <p>{message.text}</p> : null}
                    <MessageAttachmentList attachments={message.attachments} />
                    <span>{message.createdAt ? timeAgo(message.createdAt) : 'now'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cp-message-preview">
                Send the first message here. This conversation will only appear in your main inbox
                and the admin desk after you start it.
              </div>
            )}

            <MessageComposer
              emptyErrorText="Write a message or attach a file before sending it to this talent."
              key={activeThread?.id ?? `draft-${talent.id}`}
              onSubmit={handleSend}
              placeholder={
                activeThread
                  ? `Write to ${talent.name}`
                  : `Send the first message to ${talent.name}`
              }
              submitLabel={activeThread ? 'Send message' : 'Start conversation'}
            />
          </motion.section>
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
              <h3>Everything for direct talent messaging now lives in one place.</h3>
              <ul className="cp-list">
                <li>Open the live conversation here when your membership already includes this talent.</li>
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
