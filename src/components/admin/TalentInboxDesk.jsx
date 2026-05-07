import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useTalentFilters } from '../../hooks/useTalentFilters'
import { useToast } from '../../hooks/useToast'
import {
  buildFanThreadAvatar,
  getTalentInboxSummaries,
  getTalentThreads,
  refreshMessageThreads,
  sendTalentMessage,
  subscribeToMessageUpdates,
} from '../../services/messageService'
import { getTalentSnapshotById } from '../../services/talentService'
import MessageAttachmentList from '../ui/MessageAttachmentList'
import MessageComposer from '../ui/MessageComposer'
import TalentAvatar from '../ui/TalentAvatar'
import TalentSearchFilters from '../ui/TalentSearchFilters'
import { timeAgo } from '../../utils/formatters'

const ACTIVE_INBOX_GRID_STYLE = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  marginTop: 18,
}

const getInitialTalentId = (mailboxes) => mailboxes[0]?.talentId ?? null

const sortActiveMailboxes = (mailboxes = []) =>
  [...mailboxes].sort((left, right) => {
    if (right.needsReplyCount !== left.needsReplyCount) {
      return right.needsReplyCount - left.needsReplyCount
    }

    const rightLastActiveAt = new Date(right.lastActiveAt ?? 0).getTime()
    const leftLastActiveAt = new Date(left.lastActiveAt ?? 0).getTime()

    if (rightLastActiveAt !== leftLastActiveAt) {
      return rightLastActiveAt - leftLastActiveAt
    }

    if (right.threadCount !== left.threadCount) {
      return right.threadCount - left.threadCount
    }

    return left.talentName.localeCompare(right.talentName)
  })

const buildInboxHelperText = ({ activeInboxCount, hasSearchIntent, resultCount }) => {
  if (!activeInboxCount) {
    return 'Only talents with real fan conversations appear here. New inboxes will show up automatically after the first message arrives.'
  }

  if (!hasSearchIntent) {
    return `Showing ${activeInboxCount} active talent inbox${activeInboxCount === 1 ? '' : 'es'}. Zero-message talents stay hidden here by default.`
  }

  if (!resultCount) {
    return 'No active talent inbox matches that search yet. Try a broader name, category, or location.'
  }

  return `Showing ${resultCount} active inbox${resultCount === 1 ? '' : 'es'} that match the current search.`
}

export default function TalentInboxDesk() {
  const { showToast } = useToast()
  const [, setMessagesVersion] = useState(0)
  const [selectedTalentId, setSelectedTalentId] = useState(() =>
    getInitialTalentId(getTalentInboxSummaries()),
  )
  const [activeThreadId, setActiveThreadId] = useState(null)

  useEffect(() => {
    refreshMessageThreads().catch((error) => {
      showToast(error.message || 'We could not refresh talent inboxes right now.', 'warning')
    })

    return subscribeToMessageUpdates(() => {
      setMessagesVersion((current) => current + 1)
    })
  }, [showToast])

  const activeMailboxes = sortActiveMailboxes(
    getTalentInboxSummaries()
      .filter((mailbox) => mailbox.threadCount > 0)
      .map((mailbox) => {
        const talent = getTalentSnapshotById(mailbox.talentId)

        return {
          ...mailbox,
          name: mailbox.talentName,
          category: talent?.category ?? '',
          subcategory: talent?.subcategory ?? '',
          location: talent?.location ?? '',
          tags: talent?.tags ?? [],
        }
      }),
  )
  const replyNeededCount = activeMailboxes.reduce(
    (sum, mailbox) => sum + mailbox.needsReplyCount,
    0,
  )
  const {
    activeCategory,
    allMatchingTalents: filteredMailboxes,
    clearFilters,
    hasSearchIntent,
    resultCount,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
  } = useTalentFilters(activeMailboxes, {
    visibleResults: Math.max(activeMailboxes.length, 1),
    visibleIncrement: Math.max(activeMailboxes.length, 1),
  })
  const inboxHelperText = useMemo(
    () =>
      buildInboxHelperText({
        activeInboxCount: activeMailboxes.length,
        hasSearchIntent,
        resultCount,
      }),
    [activeMailboxes.length, hasSearchIntent, resultCount],
  )

  const resolvedTalentId = filteredMailboxes.some((mailbox) => mailbox.talentId === selectedTalentId)
    ? selectedTalentId
    : getInitialTalentId(filteredMailboxes)

  const selectedThreads = resolvedTalentId ? getTalentThreads(resolvedTalentId) : []

  const resolvedThreadId = selectedThreads.some((thread) => thread.id === activeThreadId)
    ? activeThreadId
    : selectedThreads[0]?.id ?? null
  const selectedMailbox =
    activeMailboxes.find((mailbox) => mailbox.talentId === resolvedTalentId) ?? null
  const activeThread = selectedThreads.find((thread) => thread.id === resolvedThreadId) ?? null
  const selectedTalent = getTalentSnapshotById(resolvedTalentId)
  const lastMessage = activeThread?.messages[activeThread.messages.length - 1] ?? null

  const handleReply = async ({ attachments, text }) => {
    if (!activeThread) {
      throw new Error('Choose a fan conversation before sending a reply.')
    }

    await sendTalentMessage({
      threadId: activeThread.id,
      text,
      attachments,
      senderLabel: activeThread.talentName,
    })
    showToast(`Reply sent as ${activeThread.talentName}.`, 'success')
  }

  return (
    <div className="cp-admin-inbox-desk">
      <article className="cp-info-card cp-surface">
        <div className="cp-thread-list-head">
          <div>
            <span className="cp-eyebrow">Active talent inboxes</span>
            <h3>Only inboxes with fan messages show up here now.</h3>
            <p className="cp-text-muted">
              Search by talent name, category, or location to jump straight to the right inbox
              instead of scanning the full roster.
            </p>
          </div>

          <div className="cp-inline-trust">
            <span className="cp-chip">
              {activeMailboxes.length} active inbox{activeMailboxes.length === 1 ? '' : 'es'}
            </span>
            <span className="cp-chip">
              {replyNeededCount} waiting on reply
            </span>
            <span className="cp-chip">Zero-message talents hidden</span>
          </div>
        </div>

        <TalentSearchFilters
          activeCategory={activeCategory}
          helperText={inboxHelperText}
          onCategoryChange={setActiveCategory}
          onClear={clearFilters}
          onSearchChange={setSearchQuery}
          panelClassName="cp-filter-panel cp-surface cp-surface--soft"
          placeholder="Search active inboxes by talent name, category, or location"
          searchQuery={searchQuery}
        />

        {filteredMailboxes.length ? (
          <div style={ACTIVE_INBOX_GRID_STYLE}>
            {filteredMailboxes.map((mailbox) => {
              const talent = getTalentSnapshotById(mailbox.talentId)

              return (
                <button
                  key={mailbox.talentId}
                  className={`cp-thread-item${resolvedTalentId === mailbox.talentId ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedTalentId(mailbox.talentId)
                    setActiveThreadId(null)
                  }}
                  style={{ alignItems: 'start', height: '100%' }}
                  type="button"
                >
                  <TalentAvatar
                    sizes="48px"
                    talent={talent ?? { name: mailbox.talentName, initials: mailbox.talentName.charAt(0) }}
                  />
                  <div className="cp-thread-copy">
                    <strong>{mailbox.talentName}</strong>
                    <span>{mailbox.latestPreview || `${mailbox.threadCount} active fan threads.`}</span>
                  </div>
                  <div className="cp-admin-thread-meta">
                    {mailbox.needsReplyCount > 0 ? (
                      <span className="cp-admin-thread-status">
                        {mailbox.needsReplyCount} need{mailbox.needsReplyCount === 1 ? 's' : ''} reply
                      </span>
                    ) : (
                      <span className="cp-thread-time">
                        {mailbox.threadCount} thread{mailbox.threadCount === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className="cp-thread-time">
                      {mailbox.lastActiveAt ? timeAgo(mailbox.lastActiveAt) : 'now'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ marginTop: 18 }} className="cp-message-preview">
            No active talent inbox matches the current search yet.
          </div>
        )}
      </article>

      {selectedThreads.length > 0 ? (
        <div className="cp-messages-layout cp-admin-inbox-layout">
          <aside className="cp-thread-list cp-surface">
            <div className="cp-thread-list-head">
              <div>
                <span className="cp-eyebrow">Fan conversations</span>
                <h3>{selectedMailbox?.talentName ?? 'Selected talent'} inbox</h3>
                <p className="cp-text-muted">
                  Open a live fan thread, review the full history, and reply as the selected talent.
                </p>
              </div>

              <span className="cp-chip">
                <MessageSquareText size={14} />
                {selectedThreads.length} fan thread{selectedThreads.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="cp-thread-stack">
              {selectedThreads.map((thread) => {
                const threadLastMessage = thread.messages[thread.messages.length - 1] ?? null
                const needsReply = threadLastMessage?.senderRole === 'fan'

                return (
                  <button
                    key={thread.id}
                    className={`cp-thread-item${resolvedThreadId === thread.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setActiveThreadId(thread.id)
                    }}
                    type="button"
                  >
                    <TalentAvatar sizes="48px" talent={buildFanThreadAvatar(thread)} />
                    <div className="cp-thread-copy">
                      <strong>{thread.fanName}</strong>
                      <span>{thread.preview || 'No message preview yet.'}</span>
                    </div>
                    <div className="cp-admin-thread-meta">
                      {needsReply ? <span className="cp-admin-thread-status">Needs reply</span> : null}
                      <span className="cp-thread-time">{thread.lastActiveAt ? timeAgo(thread.lastActiveAt) : 'now'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="cp-chat-card cp-surface cp-surface--accent">
            {activeThread ? (
              <>
                <div className="cp-chat-header">
                  <div className="cp-chat-title">
                    <TalentAvatar
                      sizes="48px"
                      talent={selectedTalent ?? { name: activeThread.talentName, initials: activeThread.talentName.charAt(0) }}
                    />
                    <div>
                      <strong>{activeThread.fanName}</strong>
                      <span>{activeThread.fanEmail || `${activeThread.talentName} inbox`}</span>
                    </div>
                  </div>

                  <div className="cp-inline-trust">
                    <span className="cp-chip">
                      <MessageSquareText size={14} />
                      Replying as {activeThread.talentName}
                    </span>
                    {lastMessage?.senderRole === 'fan' ? (
                      <span className="cp-chip">Waiting on talent reply</span>
                    ) : (
                      <span className="cp-chip">Waiting on fan reply</span>
                    )}
                  </div>
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
                  emptyErrorText="Write a reply or attach a file before sending it to the fan."
                  key={activeThread.id}
                  onSubmit={handleReply}
                  placeholder={`Reply to ${activeThread.fanName} as ${activeThread.talentName}`}
                  submitLabel="Send reply"
                  textareaClassName="cp-chat-compose-textarea--tall"
                />
              </>
            ) : (
              <div className="cp-message-preview">
                Select an active fan thread to review the full conversation and reply as the talent.
              </div>
            )}
          </section>
        </div>
      ) : (
        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">Talent inbox</span>
          <h3>
            {activeMailboxes.length
              ? 'Choose an active inbox to start reviewing fan conversations.'
              : 'No talents have fan messages yet.'}
          </h3>
          <p className="cp-text-muted">
            {activeMailboxes.length
              ? 'The inbox view now hides zero-message talents, so only active conversations appear once there is something to review.'
              : 'This desk now hides zero-message talents entirely. Once a fan starts a conversation, that talent will appear here automatically.'}
          </p>
        </article>
      )}
    </div>
  )
}
