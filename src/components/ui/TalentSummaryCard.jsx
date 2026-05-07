import { memo } from 'react'
import { ArrowRight, MapPin, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import TalentAvatar from './TalentAvatar'

const cleanCopy = (value = '') =>
  value.replace(/\u00C2/g, '').replace(/\s*[\u00B7\u2022]\s*/g, ' / ')

function TalentSummaryCard({
  talent,
  className = '',
  ctaLabel = 'Open profile',
  badgeLabel = '',
  linkTo,
}) {
  if (!talent) {
    return null
  }

  const cardClassName = ['cp-talent-card', 'cp-talent-card--lean', 'cp-surface', className]
    .filter(Boolean)
    .join(' ')
  const resolvedLink = linkTo ?? `/talent/${talent.id}`

  return (
    <article className={cardClassName}>
      <div className="cp-card-top cp-card-top--compact">
        <div className="cp-card-heading cp-card-heading--inline">
          <TalentAvatar talent={talent} />
          <div className="cp-card-heading-copy">
            <span className="cp-card-kicker">{talent.category || 'Talent'}</span>
            <h3>{talent.name}</h3>
            <p>{cleanCopy(talent.subcategory)}</p>
          </div>
        </div>

        {badgeLabel ? (
          <span className="cp-chip cp-chip--featured">
            <Star size={14} />
            {badgeLabel}
          </span>
        ) : null}
      </div>

      <div className="cp-inline-meta cp-inline-meta--talent">
        <span>
          <MapPin size={12} />
          {talent.location || 'Location pending'}
        </span>
      </div>

      <div className="cp-card-actions cp-card-actions--compact">
        <Link className="cp-link-inline" to={resolvedLink}>
          {ctaLabel}
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}

export default memo(TalentSummaryCard)
