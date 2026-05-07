import { membershipBillingOptions } from '../../data/membershipPlans'

export default function BillingCycleToggle({ billingCycle, onChange }) {
  return (
    <div className="cp-plan-cycle-corner">
      <span className="cp-plan-cycle-save">20% off</span>
      <div className="cp-plan-cycle-toggle" aria-label="Membership billing cycle" role="tablist">
        {membershipBillingOptions.map((option) => (
          <button
            key={option.id}
            aria-selected={billingCycle === option.id}
            className={billingCycle === option.id ? 'is-active' : ''}
            onClick={() => onChange(option.id)}
            role="tab"
            title={option.note}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
