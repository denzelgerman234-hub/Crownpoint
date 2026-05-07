import { useRef, useState } from 'react'
import { CheckCircle, ScrollText, X } from 'lucide-react'
import styles from './LegalModal.module.css'

function LegalModalContent({
  onAccept,
  onClose,
  requireScroll = true,
  sections = [],
  summary,
  title,
}) {
  const [scrolled, setScrolled] = useState(!requireScroll)
  const [checked, setChecked] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const contentRef = useRef(null)

  const handleScroll = () => {
    const element = contentRef.current
    if (!element) return

    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 40
    if (atBottom) setScrolled(true)
  }

  const handleAccept = () => {
    if (!checked || !scrolled) return

    setAccepted(true)
    setTimeout(() => {
      onAccept()
      onClose()
    }, 600)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <ScrollText color="var(--gold)" size={18} />
            <span className={styles.title}>{title}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className={styles.meta}>
          <span>
            Effective:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <span className={styles.version}>v1.0.0</span>
        </div>

        <div className={styles.content} onScroll={handleScroll} ref={contentRef}>
          {sections.map((section) => (
            <div key={section.id} className={styles.section}>
              <h3 className={styles.sectionHeading}>{section.heading}</h3>
              <p className={styles.sectionBody}>{section.body}</p>
            </div>
          ))}
          <div className={styles.endMarker}>- End of Document -</div>
        </div>

        {requireScroll && !scrolled && (
          <div className={styles.scrollPrompt}>
            <span>Please scroll to the bottom to continue</span>
          </div>
        )}

        <div className={styles.footer}>
          {summary && (
            <label className={`${styles.checkboxRow} ${!scrolled ? styles.disabled : ''}`}>
              <div
                className={`${styles.checkbox} ${checked ? styles.checked : ''}`}
                onClick={() => scrolled && setChecked((value) => !value)}
              >
                {checked && <CheckCircle color="var(--green-deep)" size={14} />}
              </div>
              <span className={styles.checkboxLabel}>{summary}</span>
            </label>
          )}

          <div className={styles.actions}>
            <button className={styles.declineBtn} onClick={onClose} type="button">
              Decline
            </button>
            <button
              className={`${styles.acceptBtn} ${(!checked || !scrolled) ? styles.acceptDisabled : ''} ${accepted ? styles.acceptSuccess : ''}`}
              disabled={!checked || !scrolled}
              onClick={handleAccept}
              type="button"
            >
              {accepted ? (
                <>
                  <CheckCircle size={15} />
                  Agreed
                </>
              ) : (
                'I Agree & Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LegalModal({ isOpen, ...props }) {
  if (!isOpen) return null

  return (
    <LegalModalContent
      key={`${props.title}-${props.requireScroll ? 'scroll' : 'free'}`}
      {...props}
    />
  )
}
