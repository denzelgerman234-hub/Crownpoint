import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, Smile, X } from 'lucide-react'
import {
  MESSAGE_ATTACHMENT_ACCEPT,
  resolveMessageAttachmentKind,
  validateMessageAttachmentFile,
} from '../../services/messageAttachmentService'
import { formatFileSize } from '../../utils/formatters'

const EMOJI_OPTIONS = ['😀', '😂', '😍', '🙏', '🔥', '🎉', '❤️', '👏', '🙌', '✨', '😎', '🥳']

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ')

const buildAttachmentLabel = (file) => {
  const kind = resolveMessageAttachmentKind(file)
  const metaParts = []

  if (kind) {
    metaParts.push(kind.toUpperCase())
  }

  if (file?.size) {
    metaParts.push(formatFileSize(file.size))
  }

  return metaParts.join(' | ')
}

export default function MessageComposer({
  emptyErrorText = 'Write a message or attach a file before sending.',
  onSubmit,
  placeholder,
  submitLabel = 'Send',
  textareaClassName = '',
}) {
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const emojiPickerRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (emojiPickerRef.current?.contains(event.target)) {
        return
      }

      setIsEmojiPickerOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsEmojiPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isEmojiPickerOpen])

  const handleSelectFiles = (event) => {
    const selectedFiles = Array.from(event.target.files ?? [])

    if (!selectedFiles.length) {
      return
    }

    try {
      selectedFiles.forEach((file) => validateMessageAttachmentFile(file))
      setAttachments((current) => [...current, ...selectedFiles])
      setError('')
    } catch (attachmentError) {
      setError(attachmentError.message)
    } finally {
      event.target.value = ''
    }
  }

  const handleEmojiInsert = (emoji) => {
    const textarea = textareaRef.current

    if (!textarea) {
      setDraft((current) => `${current}${emoji}`)
      setIsEmojiPickerOpen(false)
      return
    }

    const selectionStart = textarea.selectionStart ?? draft.length
    const selectionEnd = textarea.selectionEnd ?? draft.length
    const nextDraft = `${draft.slice(0, selectionStart)}${emoji}${draft.slice(selectionEnd)}`
    const nextCursorPosition = selectionStart + emoji.length

    setDraft(nextDraft)
    setError('')
    setIsEmojiPickerOpen(false)

    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition)
    })
  }

  const handleSend = async () => {
    const trimmedDraft = draft.trim()

    if (!trimmedDraft && attachments.length === 0) {
      setError(emptyErrorText)
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        text: trimmedDraft,
        attachments,
      })
      setDraft('')
      setAttachments([])
      setError('')
      setIsEmojiPickerOpen(false)
    } catch (submitError) {
      setError(submitError.message || 'We could not send that message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="cp-chat-compose">
      <div className="cp-chat-compose-field">
        {attachments.length > 0 ? (
          <div className="cp-chat-compose-attachments">
            {attachments.map((file, index) => (
              <div
                className="cp-chat-compose-attachment"
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              >
                <div className="cp-chat-compose-attachment-copy">
                  <strong>{file.name}</strong>
                  <span>{buildAttachmentLabel(file)}</span>
                </div>
                <button
                  aria-label={`Remove ${file.name}`}
                  className="cp-chat-compose-attachment-remove"
                  onClick={() =>
                    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          className={joinClassNames('cp-chat-compose-textarea', textareaClassName)}
          onChange={(event) => {
            setDraft(event.target.value)
            setError('')
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          ref={textareaRef}
          value={draft}
        />

        <div className="cp-chat-compose-toolbar">
          <div className="cp-chat-compose-actions">
            <input
              accept={MESSAGE_ATTACHMENT_ACCEPT}
              hidden
              multiple
              onChange={handleSelectFiles}
              ref={fileInputRef}
              type="file"
            />

            <button
              className="cp-chat-compose-tool"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Paperclip size={16} />
              Attach
            </button>

            <div className="cp-chat-compose-emoji-wrap" ref={emojiPickerRef}>
              <button
                aria-expanded={isEmojiPickerOpen}
                className="cp-chat-compose-tool"
                onClick={() => setIsEmojiPickerOpen((open) => !open)}
                type="button"
              >
                <Smile size={16} />
                Emoji
              </button>

              {isEmojiPickerOpen ? (
                <div className="cp-chat-compose-emoji-picker">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      className="cp-chat-compose-emoji-option"
                      key={emoji}
                      onClick={() => handleEmojiInsert(emoji)}
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <span className="cp-chat-compose-hint">Images, audio, PDF, and DOCX only</span>
        </div>

        {error ? <p className="cp-form-error">{error}</p> : null}
      </div>

      <button
        className="cp-btn cp-btn--primary"
        disabled={isSubmitting}
        onClick={handleSend}
        type="button"
      >
        {submitLabel}
        <Send size={14} />
      </button>
    </div>
  )
}
