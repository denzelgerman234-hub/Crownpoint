import { useEffect, useState } from 'react'
import { Download, Paperclip } from 'lucide-react'
import { getMessageAttachmentBlob } from '../../services/messageAttachmentService'
import { formatFileSize } from '../../utils/formatters'

const buildAttachmentMeta = (attachment) => {
  const metaParts = []

  if (attachment?.kind) {
    metaParts.push(String(attachment.kind).toUpperCase())
  }

  if (attachment?.size) {
    metaParts.push(formatFileSize(attachment.size))
  }

  return metaParts.join(' | ')
}

function MessageAttachmentCard({ attachment }) {
  const [attachmentState, setAttachmentState] = useState({
    status: 'loading',
    url: '',
  })

  useEffect(() => {
    let isMounted = true
    let objectUrl = ''

    const loadAttachment = async () => {
      try {
        const blob = await getMessageAttachmentBlob(attachment)

        if (!isMounted) {
          return
        }

        if (!(blob instanceof Blob)) {
          setAttachmentState({
            status: 'missing',
            url: '',
          })
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setAttachmentState({
          status: 'ready',
          url: objectUrl,
        })
      } catch {
        if (isMounted) {
          setAttachmentState({
            status: 'missing',
            url: '',
          })
        }
      }
    }

    loadAttachment()

    return () => {
      isMounted = false

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [attachment])

  const attachmentMeta = buildAttachmentMeta(attachment)

  if (attachment.kind === 'image' && attachmentState.status === 'ready') {
    return (
      <a
        className="cp-message-attachment cp-message-attachment--image"
        href={attachmentState.url}
        rel="noreferrer"
        target="_blank"
      >
        <img alt={attachment.name} src={attachmentState.url} />
        <div className="cp-message-attachment-copy">
          <strong>{attachment.name}</strong>
          <span>{attachmentMeta}</span>
        </div>
      </a>
    )
  }

  if (attachment.kind === 'audio' && attachmentState.status === 'ready') {
    return (
      <div className="cp-message-attachment cp-message-attachment--audio">
        <div className="cp-message-attachment-copy">
          <strong>{attachment.name}</strong>
          <span>{attachmentMeta}</span>
        </div>
        <audio controls preload="metadata" src={attachmentState.url}>
          Your browser does not support audio playback.
        </audio>
      </div>
    )
  }

  if (attachmentState.status === 'ready') {
    return (
      <a
        className="cp-message-attachment cp-message-attachment--file"
        download={attachment.kind === 'docx' ? attachment.name : undefined}
        href={attachmentState.url}
        rel="noreferrer"
        target="_blank"
      >
        <span className="cp-message-attachment-icon">
          <Paperclip size={16} />
        </span>
        <div className="cp-message-attachment-copy">
          <strong>{attachment.name}</strong>
          <span>{attachmentMeta}</span>
        </div>
        <span className="cp-message-attachment-action">
          <Download size={16} />
        </span>
      </a>
    )
  }

  return (
    <div className="cp-message-attachment cp-message-attachment--file is-loading">
      <span className="cp-message-attachment-icon">
        <Paperclip size={16} />
      </span>
      <div className="cp-message-attachment-copy">
        <strong>{attachment.name}</strong>
        <span>
          {attachmentState.status === 'missing'
            ? 'This attachment is no longer available in this browser.'
            : 'Loading attachment...'}
        </span>
      </div>
    </div>
  )
}

export default function MessageAttachmentList({ attachments = [] }) {
  if (!attachments.length) {
    return null
  }

  return (
    <div className="cp-message-attachment-list">
      {attachments.map((attachment) => (
        <MessageAttachmentCard attachment={attachment} key={attachment.id} />
      ))}
    </div>
  )
}
