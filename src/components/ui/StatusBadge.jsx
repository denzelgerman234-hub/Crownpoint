const statusMeta = {
  PENDING_PAYMENT: { label: 'Pending payment', tone: 'pending' },
  UNDER_REVIEW: { label: 'Under review', tone: 'review' },
  PAID: { label: 'Paid', tone: 'paid' },
  APPROVED: { label: 'Approved', tone: 'paid' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress' },
  COMPLETED: { label: 'Completed', tone: 'complete' },
  FAILED: { label: 'Failed', tone: 'failed' },
  REJECTED: { label: 'Rejected', tone: 'failed' },
  CANCELLED: { label: 'Cancelled', tone: 'failed' },
  FLAGGED: { label: 'Flagged', tone: 'flagged' },
}

const toTitleCase = (value) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export default function StatusBadge({ status }) {
  const meta = statusMeta[status] ?? { label: toTitleCase(status ?? 'unknown'), tone: 'review' }

  return <span className={`cp-status cp-status--${meta.tone}`}>{meta.label}</span>
}
