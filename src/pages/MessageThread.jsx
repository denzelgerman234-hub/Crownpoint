import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageSquareText } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import MessageAttachmentList from '../components/ui/MessageAttachmentList'
import MessageComposer from '../components/ui/MessageComposer'
import TalentAvatar from '../components/ui/TalentAvatar'
import { useAuth } from '../hooks/useAuth'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import {
  getUserThreads,
  refreshMessageThreads,
  sendFanMessage,
  subscribeToMessageUpdates,
} from '../services/messageService'
import { getTalentSnapshotById } from '../services/talentService'
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

export default function MessageThread() {
  const { threadId } = useParams()
  const [searchParams] = useSearchParams()
  const { canMessage, currentPlanLabel, user } = useAuth()
  const talentRoster = useTalentRoster()
  const { showToast } = useToast()
  const messageIdRef = useRef(0)
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
      showToast(error.message || 'We could not refresh that thread right now.', 'warning')
    })

    return subscribeToMessageUpdates(() => {
      setMessagesVersion((current) => current + 1)
    })
  }, [hasMessagingAccess, showToast, user])

  const visibleThreads = user ? getUserThreads(user, unlockedTalents, currentPlanLabel) : []
  const activeThread = visibleThreads.find((thread) => thread.id === threadId) ?? null
  const activeTalent = activeThread ? getTalentSnapshotById(activeThread.talentId) : null
  const backTarget = getSafeBackTarget(searchParams.get('back'))
  const backLabel = searchParams.get('backLabel') || getDefaultBackLabel(backTarget)

  const getNextMessageId = () => {
    messageIdRef.current += 1
    return `${activeThread?.id ?? 'thread'}-${messageIdRef.current}`
  }

  const handleSend = async ({ attachments, text }) => {
    if (!activeThread || !user) {
      throw new Error('Choose a conversation before sending a message.')
    }

    await sendFanMessage({
      threadId: activeThread.id,
      text,
      attachments,
      fanName: user.name,
      messageId: getNextMessageId(),
    })
  }

  return (
    <PageWrapper className="cp-page--messages-thread">
      <section className="cp-section cp-thread-page-shell">
        <div className="cp-container cp-thread-page-stack">
          <Link className="cp-payment-backlink" to={backTarget}>
            <ArrowLeft size={14} />
            {backLabel}
          </Link>

          {activeThread ? (
            <motion.section className="cp-chat-card cp-chat-card--thread cp-surface cp-surface--accent" {...revealUp}>
              <div className="cp-chat-header">
                <div className="cp-chat-title">
                  <TalentAvatar
                    sizes="48px"
                    talent={activeTalent ?? { name: activeThread.talentName, initials: activeThread.talentName.charAt(0) }}
                  />
                  <div>
                    <strong>{activeThread.talentName}</strong>
                    <span>{activeThread.topic}</span>
                  </div>
                </div>

                <span className="cp-chip">
                  <MessageSquareText size={14} />
                  {currentPlanLabel}
                </span>
              </div>

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

              <MessageComposer
                key={activeThread.id}
                onSubmit={handleSend}
                placeholder={`Write to ${activeThread.talentName}`}
              />
            </motion.section>
          ) : (
            <section className="cp-empty-state">
              <div className="cp-container">
                <span className="cp-eyebrow">Thread unavailable</span>
                <h2 className="section-title">
                  That private inbox is not available for your account right <em>now.</em>
                </h2>
                <p>
                  The thread may be locked, missing, or tied to a different membership access path.
                </p>
                <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                  <Link className="cp-btn cp-btn--primary" to={backTarget}>
                    Return
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
