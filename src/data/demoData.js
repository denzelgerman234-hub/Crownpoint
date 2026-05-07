import { ORDER_STATUS, PAYMENT_METHODS } from '../utils/constants'

export const heroStats = [
  { value: '24+', label: 'distinguished names on the CrownPoint roster' },
  { value: '72h', label: 'typical concierge response window for signature requests' },
  { value: '08+', label: 'private experience formats offered through the house' },
  { value: '1.4k+', label: 'requests already entrusted to CrownPoint' },
]

export const experienceModes = [
  {
    iconKey: 'Video',
    title: 'Signature video messages',
    description: 'Thoughtfully briefed recordings shaped around the occasion, the tone, and the person receiving them.',
  },
  {
    iconKey: 'PhoneCall',
    title: 'Private live calls',
    description: 'One-to-one conversations arranged with discretion, precise timing, and a concierge hand throughout.',
  },
  {
    iconKey: 'Gift',
    title: 'Signed collector pieces',
    description: 'Authenticated memorabilia prepared with presentation standards worthy of the moment.',
  },
  {
    iconKey: 'Sparkles',
    title: 'Private event booking',
    description: 'Appearance enquiries handled with clear logistics, budget guidance, and polished follow-through from first outreach.',
  },
]

export const bookingJourney = [
  {
    step: '01',
    title: 'Find the right talent',
    description: 'Browse by category, service, response time, and style until the fit feels right for the occasion.',
  },
  {
    step: '02',
    title: 'Share the occasion',
    description: 'Tell us who the request is for, the tone you want, and the details that will make it truly personal.',
  },
  {
    step: '03',
    title: 'Complete payment',
    description: 'Choose the payment method that suits you, keep your reference close, and send your request for confirmation.',
  },
  {
    step: '04',
    title: 'Stay connected',
    description: 'Add membership whenever you want private messaging, priority access, and a closer relationship with your chosen talent.',
  },
]

export const conciergePromises = [
  {
    title: 'One elegant account',
    description: 'Orders, membership access, and private messages stay together in one secure place.',
  },
  {
    title: 'Thoughtful concierge support',
    description: 'From first enquiry to final delivery, every step is handled with clarity, care, and discretion.',
  },
  {
    title: 'Private access that feels personal',
    description: 'Membership keeps direct talent messaging and exclusive access distinct from one-off bookings, events, and purchases.',
  },
]

export const fanOrders = [
  {
    id: 1,
    refCode: 'A92KX',
    talentName: 'Taylor Swift',
    service: 'Signature Video Message',
    status: ORDER_STATUS.UNDER_REVIEW,
    totalPrice: 499,
    requestedFor: 'Arielle - birthday surprise',
    eta: 'Awaiting payment confirmation',
    submittedAt: 'Apr 6, 2026',
    paymentMethod: PAYMENT_METHODS.BANK,
  },
  {
    id: 2,
    refCode: 'Q7M3P',
    talentName: 'LeBron James',
    service: 'Signed Collector Piece',
    status: ORDER_STATUS.IN_PROGRESS,
    totalPrice: 899,
    requestedFor: 'Collector edition display',
    eta: 'Presentation and authentication underway',
    submittedAt: 'Apr 2, 2026',
    paymentMethod: PAYMENT_METHODS.GIFT_CARD,
  },
  {
    id: 3,
    refCode: 'N4Z8R',
    talentName: 'Keanu Reeves',
    service: 'Private Live Call',
    status: ORDER_STATUS.COMPLETED,
    totalPrice: 999,
    requestedFor: 'Film club donor thank-you',
    eta: 'Delivered Mar 28, 2026',
    submittedAt: 'Mar 20, 2026',
    paymentMethod: PAYMENT_METHODS.CRYPTO,
  },
]

export const dashboardActivity = [
  {
    title: 'Your brief was refined',
    body: 'The Taylor Swift request now includes pronunciation notes and camera direction for a more personal finish.',
  },
  {
    title: 'Membership review underway',
    body: 'As soon as your plan is approved, private messaging and member access will be available in your account.',
  },
  {
    title: 'Collector order nearly ready',
    body: 'The signed LeBron piece is being paired with its authentication papers before dispatch.',
  },
]

export const conciergePlaybook = [
  'Keep your profile photo and display name current so every request arrives beautifully presented.',
  'Choose Inner Circle or Crown Access when you want private correspondence with a talent.',
  'Use the concierge assistant anytime you want quick help with booking, payment, membership, or support.',
]

export const privateThreads = [
  {
    id: 'thread-7',
    talentId: 7,
    talentName: 'LeBron James',
    topic: 'Private lounge',
    lastActive: '2m ago',
    preview: 'The next locker-room Q&A opens later this week.',
    messages: [
      {
        id: 'q1',
        sender: 'talent',
        text: 'Glad to have you here. The next locker-room Q&A opens later this week.',
        time: '11:10 AM',
      },
      {
        id: 'q2',
        sender: 'fan',
        text: 'Perfect. I would love first notice when the next signed drop is ready.',
        time: '11:12 AM',
      },
      {
        id: 'q3',
        sender: 'talent',
        text: 'You will receive it here before the public release goes out.',
        time: '11:16 AM',
      },
    ],
  },
  {
    id: 'thread-3',
    talentId: 3,
    talentName: 'Keanu Reeves',
    topic: 'Inner Circle',
    lastActive: 'Yesterday',
    preview: 'Thank you again for joining the private call.',
    messages: [
      {
        id: 'n1',
        sender: 'fan',
        text: 'Thank you again for the private call. It meant a great deal to the whole group.',
        time: '7:04 PM',
      },
      {
        id: 'n2',
        sender: 'talent',
        text: 'It was a special evening. I am glad we could make it feel close and personal.',
        time: '7:20 PM',
      },
    ],
  },
]

export const adminQueue = [
  {
    id: 11,
    refCode: 'A92KX',
    fanName: 'Amara Okafor',
    talentName: 'Taylor Swift',
    amount: 499,
    method: PAYMENT_METHODS.BANK,
    submittedAgo: '8 min ago',
    region: 'United States',
    risk: 'low',
    proof: 'Transfer receipt received with matching beneficiary details.',
    status: ORDER_STATUS.UNDER_REVIEW,
  },
  {
    id: 12,
    refCode: 'L8T2V',
    fanName: 'Marcus Williams',
    talentName: 'Kai Cenat',
    amount: 299,
    method: PAYMENT_METHODS.GIFT_CARD,
    submittedAgo: '14 min ago',
    region: 'United Kingdom',
    risk: 'medium',
    proof: 'Apple gift card code received and awaiting denomination confirmation.',
    status: ORDER_STATUS.UNDER_REVIEW,
  },
  {
    id: 13,
    refCode: 'J5W1N',
    fanName: 'Sofia Reyes',
    talentName: 'Bruno Mars',
    amount: 799,
    method: PAYMENT_METHODS.CRYPTO,
    submittedAgo: '21 min ago',
    region: 'Mexico',
    risk: 'high',
    proof: 'Transaction hash supplied; wallet variance requires specialist review.',
    status: ORDER_STATUS.UNDER_REVIEW,
  },
]

export const adminRiskFlags = [
  {
    title: 'Wallet discrepancy',
    detail: 'REF #J5W1N arrived from a wallet not previously associated with the brief.',
  },
  {
    title: 'Gift card shortfall',
    detail: 'One submission appears to carry less value than the amount required and needs a follow-up.',
  },
  {
    title: 'Regional overlap',
    detail: 'Two submissions trace back to a recently flagged IP cluster and should be reviewed together.',
  },
]
