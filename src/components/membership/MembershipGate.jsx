import { ArrowRight, LockKeyhole, MessageSquareText, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getUserThreadByTalent } from '../../services/messageService'
import { MEMBERSHIP_PLANS } from '../../utils/constants'

const buildMembershipLink = (plan, talentId) => {
  const params = new URLSearchParams({ plan })

  if (talentId) {
    params.set('talent', String(talentId))
  }

  return `/membership?${params.toString()}`
}

export default function MembershipGate({ talent }) {
  const { canMessage, currentPlan, currentPlanLabel, user } = useAuth()

  if (!talent) {
    return null
  }

  const signInRedirect = encodeURIComponent(buildMembershipLink(MEMBERSHIP_PLANS.INNER_CIRCLE, talent.id))
  const canOpenThread = user && canMessage(talent.id)
  const isInnerCircleMember = currentPlan === MEMBERSHIP_PLANS.INNER_CIRCLE
  const unlockedThread = canOpenThread
    ? getUserThreadByTalent(user, talent, currentPlanLabel)
    : null
  const openInboxLink = unlockedThread
    ? `/messages/${unlockedThread.id}?${new URLSearchParams({
      back: `/talent/${talent.id}/messages`,
      backLabel: 'Back to direct message',
    }).toString()}`
    : '/messages'

  return (
    <div className="cp-membership-gate cp-surface">
      <div className="cp-membership-gate-copy">
        <span className="cp-eyebrow">Direct messaging</span>
        <h3>
          {canOpenThread
            ? `Your ${currentPlanLabel} access is live for ${talent.name}.`
            : `Direct access to ${talent.name} runs through membership.`}
        </h3>
        <p className="cp-text-muted">
          {canOpenThread
            ? 'Open the inbox and keep the conversation moving without leaving the profile.'
            : 'Private messaging is reserved for Inner Circle and Crown Access, giving you a more personal and dedicated way to connect.'}
        </p>

        <div className="cp-inline-trust" style={{ marginTop: 18 }}>
          <span className="cp-chip">
            {canOpenThread ? <MessageSquareText size={14} /> : <LockKeyhole size={14} />}
            {canOpenThread ? currentPlanLabel : 'Membership required'}
          </span>
          {user && !canOpenThread ? (
            <span className="cp-chip">
              <Sparkles size={14} />
              Current plan: {currentPlanLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="cp-card-actions">
        {canOpenThread ? (
          <>
            <Link className="cp-btn cp-btn--primary" to={openInboxLink}>
              Message {talent.name.split(' ')[0]}
              <ArrowRight size={14} />
            </Link>
            <Link className="cp-btn cp-btn--ghost" to="/membership">
              Manage membership
            </Link>
          </>
        ) : !user ? (
          <>
            <Link className="cp-btn cp-btn--primary" to={`/auth?mode=signin&redirect=${signInRedirect}`}>
              Sign in to unlock
            </Link>
            <Link className="cp-btn cp-btn--ghost" to="/pricing">
              Compare pricing
            </Link>
          </>
        ) : isInnerCircleMember ? (
          <>
            <Link
              className="cp-btn cp-btn--primary"
              to={buildMembershipLink(MEMBERSHIP_PLANS.INNER_CIRCLE, talent.id)}
            >
              Switch Inner Circle pick
            </Link>
            <Link
              className="cp-btn cp-btn--ghost"
              to={buildMembershipLink(MEMBERSHIP_PLANS.CROWN_ACCESS, talent.id)}
            >
              Upgrade to Crown Access
            </Link>
          </>
        ) : (
          <>
            <Link
              className="cp-btn cp-btn--primary"
              to={buildMembershipLink(MEMBERSHIP_PLANS.INNER_CIRCLE, talent.id)}
            >
              Upgrade to Inner Circle
            </Link>
            <Link className="cp-btn cp-btn--ghost" to="/pricing">
              View pricing
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
