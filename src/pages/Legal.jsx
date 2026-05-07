import { AlertTriangle, FileText, LockKeyhole, RotateCcw, Shield } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  fraudPolicy,
  interactionConfidentialityPolicy,
  privacyPolicy,
  refundPolicy,
  termsOfService,
} from '../data/legalContent'
import styles from './Legal.module.css'

const tabs = [
  { id: 'terms', label: 'Terms of Service', icon: FileText, data: termsOfService },
  {
    id: 'confidentiality',
    label: 'Confidentiality NDA',
    icon: LockKeyhole,
    data: interactionConfidentialityPolicy,
  },
  { id: 'privacy', label: 'Privacy Policy', icon: Shield, data: privacyPolicy },
  { id: 'refund', label: 'Refund Policy', icon: RotateCcw, data: refundPolicy },
  { id: 'fraud', label: 'Fraud Policy', icon: AlertTriangle, data: fraudPolicy },
]

const resolveTab = (candidate) => tabs.find((tab) => tab.id === candidate)?.id ?? 'terms'
const cleanSectionBody = (body = '') => body.replace(/\[LEGAL REVIEW\]\s*/g, '')

export default function Legal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = resolveTab(requestedTab)
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  const handleTabChange = (tabId) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tabId)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="section-eyebrow">Legal and Policies</span>
          <h1 className={styles.heroTitle}>
            Policies and <em>terms</em>
          </h1>
          <p className={styles.heroSub}>
            Review CrownPoint&apos;s terms, privacy practices, refunds, and platform policies in
            one place.
          </p>
          <p className={styles.effectiveDate}>Policies effective: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.tabNav}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`${styles.tabBtn} ${activeTab === id ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(id)}
              type="button"
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={styles.content}>
          <div className={styles.docHeader}>
            <h2 className={styles.docTitle}>{current.data.title}</h2>
            <span className={styles.docDate}>Last updated: {current.data.lastUpdated}</span>
          </div>

          <div className={styles.disclaimer}>
            These policies are currently undergoing final legal review and may be refined before
            full publication.
          </div>

          {current.data.sections.map((section) => (
            <div key={section.id} className={styles.section}>
              <h3 className={styles.sectionHeading}>{section.heading}</h3>
              <p className={styles.sectionBody}>{cleanSectionBody(section.body)}</p>
            </div>
          ))}

          <div className={styles.contactBox}>
            <p className={styles.contactText}>Questions about policy or compliance?</p>
            <a className={styles.contactLink} href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
