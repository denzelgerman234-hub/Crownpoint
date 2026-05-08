import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageSquareText, Sparkles } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import Loader from '../components/ui/Loader'
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

const getSafeBackTarget = (value) => (value && value.startsWith('/') ? value : '/messages')

const getDefaultBackLabel = (backTarget) => {
  if (backTarget === '/talents') {
    return 'Back to talents'
  }

  if (backTarget === '/messages') {
    return 'Back to message inbox'
  }

  return 'Back'
}

export default function TalentMessageThread() {
  const { talentId } = useParams()
  const [searchParams] = useSearchParams()
  const { canMessage, currentPlanLabel, user } = useAuth()
  const { showToast } = useToast()
  const { isLoading, talent } = useResolvedTalent(talentId)
  const messageIdRef = useRef(0)
  const [, setMessagesVersion] = useState(0)

  const hasMessagingAccess = Boolean(user && talent && canMessage(talent.id))
  const activeThread =
    user && talent && hasMessagingAccess
      ? getUserThreadByTalent(user, talent, currentPlanLabel)
      : null
  const lastMessage = activeThread?.messages[activeThread.messages.length - 1] ?? null
  const backTarget = getSafeBackTarget(searchParams.get('back'))
  const backLabel = searchParams.get('backLabel') || getDefaultBackLabel(backTarget)

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
    if (!user || !talent || !hasMessagingAccess) {
      throw new Error('This private inbox is not available for your account right now.')
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

  return (
    <PageWrapper className="cp-page--messages-thread">
      <section className="cp-section cp-thread-page-shell">
        <div className="cp-container cp-thread-page-stack">
          <Link className="cp-payment-backlink" to={backTarget}>
            <ArrowLeft size={14} />
            {backLabel}
          </Link>

          {isLoading ? (
            <section className="cp-empty-state">
              <div className="cp-container">
                <Loader label="Loading direct message thread..." />
              </div>
            </section>
          ) : !talent ? (
            <section className="cp-empty-state">
              <div className="cp-container">
                <span className="cp-eyebrow">Thread unavailable</span>
                <h2 className="section-title">
                  We could not find that direct message thread <em>right now.</em>
                </h2>
                <p>
                  The talent may be unavailable, or the link may no longer point to a valid inbox.
                </p>
                <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                  <Link className="cp-btn cp-btn--primary" to={backTarget}>
                    Return
                  </Link>
                </div>
              </div>
            </section>
          ) : hasMessagingAccess ? (
            <motion.section className="cp-chat-card cp-chat-card--thread cp-surface cp-surface--accent" {...revealUp}>
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
                    {activeThread ? 'Conversation live' : 'Thread ready'}
                  </span>
                  <span className="cp-chip">
                    <Sparkles size={14} />
                    {activeThread
                      ? `Updated ${timeAgo(lastMessage?.createdAt || activeThread.lastActiveAt)}`
                      : 'Ready for your first message'}
                  </span>
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
                  Send the first message here to begin the conversation.
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
          ) : (
            <section className="cp-empty-state">
              <div className="cp-container">
                <span className="cp-eyebrow">Inbox locked</span>
                <h2 className="section-title">
                  This direct message thread is not available for your current <em>membership.</em>
                </h2>
                <p>
                  Return to your inbox, or open the talent page if you want to review access for
                  this profile.
                </p>
                <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                  <Link className="cp-btn cp-btn--primary" to={backTarget}>
                    Return
                  </Link>
                  <Link className="cp-btn cp-btn--ghost" to={`/talent/${talent.id}/messages`}>
                    Open talent page
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      </section>
    </PageWrapper>
  )
}
