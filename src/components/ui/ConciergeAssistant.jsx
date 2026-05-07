import { useMemo, useState } from 'react'
import { Bot, Menu, MessageCircleMore, Send, Sparkles, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useOrder } from '../../context/OrderContext'

const createMessageId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const buildActionResponse = ({ currentOrder, currentPlanLabel, hasPlan, location, user }, intent) => {
  switch (intent) {
    case 'auth':
      return {
        reply: user
          ? 'You are already signed in. I can take you back to your account.'
          : 'You can sign in or create an account from here.',
        cta: user
          ? { label: 'Open my account', to: '/dashboard' }
          : { label: 'Open account access', to: '/auth?mode=signin' },
      }
    case 'payment':
      return {
        reply: currentOrder?.refCode
          ? `Your current brief is already set up. The payment desk is ready for REF #${currentOrder.refCode}.`
          : 'I can help you start an experience request first, then guide you to payment.',
        cta: { label: currentOrder?.refCode ? 'Open payment desk' : 'Start experience', to: currentOrder?.refCode ? '/payment' : '/experiences' },
      }
    case 'membership':
      return {
        reply: user
          ? `Your current membership is ${currentPlanLabel}. I can take you to pricing or straight into membership.`
          : 'Membership gives you direct talent messaging and exclusive access. I can show you the pricing now.',
        cta: { label: user ? 'Open membership desk' : 'View pricing', to: user ? '/membership' : '/pricing' },
      }
    case 'messages':
      return {
        reply: !user
          ? 'Private messages are tied to your account, so sign in first. After that, Inner Circle or Crown Access unlocks the inbox.'
          : !hasPlan
            ? 'Your account is active, but messaging is still locked behind membership. I can take you to the pricing page.'
            : 'Your membership inbox is live and ready whenever you want direct access to a talent.',
        cta: !user
          ? { label: 'Sign in first', to: '/auth?mode=signin' }
          : !hasPlan
            ? { label: 'View pricing', to: '/pricing' }
            : { label: 'Open private messages', to: '/messages' },
      }
    case 'talents':
      return {
        reply: 'I can take you straight to the roster so you can explore the talent list.',
        cta: { label: 'Browse talents', to: '/talents' },
      }
    case 'support':
      return {
        reply: location.pathname === '/payment'
          ? 'If you are mid-payment, start by checking your reference and proof notes.'
          : 'I can point you to experiences, payment, membership, account help, or private messages depending on what you need.',
        cta: { label: user ? 'Open my account' : 'Create account', to: user ? '/dashboard' : '/auth?mode=signup' },
      }
    default:
      return {
        reply: 'I can help with experiences, payments, memberships, account access, or private messages.',
        cta: { label: 'Show me the roster', to: '/talents' },
      }
  }
}

const buildReplyFromText = (context, text) => {
  const normalized = text.toLowerCase()

  if (normalized.includes('membership') || normalized.includes('plan') || normalized.includes('pricing') || normalized.includes('subscription')) {
    return buildActionResponse(context, 'membership')
  }

  if (normalized.includes('pay') || normalized.includes('payment')) {
    return buildActionResponse(context, 'payment')
  }

  if (normalized.includes('login') || normalized.includes('sign in') || normalized.includes('account')) {
    return buildActionResponse(context, 'auth')
  }

  if (normalized.includes('message') || normalized.includes('dm') || normalized.includes('chat')) {
    return buildActionResponse(context, 'messages')
  }

  if (normalized.includes('talent') || normalized.includes('browse') || normalized.includes('roster')) {
    return buildActionResponse(context, 'talents')
  }

  return buildActionResponse(context, 'support')
}

export default function ConciergeAssistant() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentPlanLabel, hasPlan, user } = useAuth()
  const { currentOrder } = useOrder()
  const [isOpen, setIsOpen] = useState(false)
  const [hasInteractedThisOpen, setHasInteractedThisOpen] = useState(false)
  const [areQuickActionsVisible, setAreQuickActionsVisible] = useState(true)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Need a hand? I can help with experiences, payment, memberships, account access, or private messages.',
    },
  ])

  const context = { currentOrder, currentPlanLabel, hasPlan, location, user }
  const shouldShowQuickActions = !hasInteractedThisOpen || areQuickActionsVisible

  const quickActions = useMemo(() => {
    const base = [
      { id: 'talents', label: 'Browse talents' },
      { id: 'membership', label: 'Pricing' },
      { id: 'payment', label: currentOrder?.refCode ? 'Continue payment' : 'Payment help' },
      { id: 'messages', label: 'Private messages' },
    ]

    if (location.pathname === '/payment') {
      return [
        { id: 'payment', label: 'Proof help' },
        { id: 'membership', label: 'Messaging access' },
        { id: 'messages', label: 'Open inbox' },
      ]
    }

    return base
  }, [currentOrder?.refCode, location.pathname])

  const pushAssistantMessage = ({ reply, cta }) => {
    setMessages((current) => [
      ...current,
      {
        id: createMessageId('assistant'),
        sender: 'assistant',
        text: reply,
        cta,
      },
    ])
  }

  const handleQuickAction = (intent) => {
    setHasInteractedThisOpen(true)
    setAreQuickActionsVisible(false)
    setMessages((current) => [
      ...current,
      {
        id: createMessageId('user'),
        sender: 'user',
        text: quickActions.find((action) => action.id === intent)?.label ?? intent,
      },
    ])
    pushAssistantMessage(buildActionResponse(context, intent))
  }

  const handleSend = () => {
    if (!draft.trim()) {
      return
    }

    setHasInteractedThisOpen(true)
    setAreQuickActionsVisible(false)
    const nextDraft = draft.trim()
    setMessages((current) => [
      ...current,
      {
        id: createMessageId('user'),
        sender: 'user',
        text: nextDraft,
      },
    ])
    setDraft('')
    pushAssistantMessage(buildReplyFromText(context, nextDraft))
  }

  const handleNavigate = (to) => {
    navigate(to)
    setIsOpen(false)
  }

  const handleToggleAssistant = () => {
    setIsOpen((open) => {
      const nextOpen = !open

      if (nextOpen) {
        setHasInteractedThisOpen(false)
        setAreQuickActionsVisible(true)
      }

      return nextOpen
    })
  }

  return (
    <>
      <button
        aria-label={isOpen ? 'Close concierge assistant' : 'Open concierge assistant'}
        className="cp-assistant-launcher"
        onClick={handleToggleAssistant}
        type="button"
      >
        {isOpen ? <X size={20} /> : <MessageCircleMore size={20} />}
      </button>

      {isOpen && (
        <div className="cp-assistant-panel cp-surface cp-surface--accent">
          <div className="cp-assistant-header">
            <div>
              <span className="cp-eyebrow">Concierge</span>
              <strong>{user ? `Hi, ${user.name.split(' ')[0]}` : 'Need a hand?'}</strong>
            </div>
            <span className="cp-chip">
              <Bot size={14} />
              Quick help
            </span>
          </div>

          <div className="cp-assistant-feed">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`cp-assistant-bubble cp-assistant-bubble--${message.sender}`}
              >
                <p>{message.text}</p>
                {message.cta ? (
                  <button
                    className="cp-assistant-cta"
                    onClick={() => handleNavigate(message.cta.to)}
                    type="button"
                  >
                    <Sparkles size={14} />
                    {message.cta.label}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {hasInteractedThisOpen ? (
            <div className="cp-assistant-actions-bar">
              <span className="cp-eyebrow">Quick options</span>
              <button
                aria-label={areQuickActionsVisible ? 'Hide quick options' : 'Show quick options'}
                aria-expanded={areQuickActionsVisible}
                className="cp-assistant-actions-toggle"
                onClick={() => setAreQuickActionsVisible((visible) => !visible)}
                title={areQuickActionsVisible ? 'Hide quick options' : 'Show quick options'}
                type="button"
              >
                {areQuickActionsVisible ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          ) : null}

          {shouldShowQuickActions ? (
            <div className="cp-assistant-actions" id="cp-assistant-actions">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="cp-filter-chip"
                  onClick={() => handleQuickAction(action.id)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="cp-assistant-compose">
            <input
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') handleSend()
      }}
      placeholder="Ask about experiences, membership, payments, or messages"
      value={draft}
    />
            <button className="cp-btn cp-btn--primary" onClick={handleSend} type="button">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
