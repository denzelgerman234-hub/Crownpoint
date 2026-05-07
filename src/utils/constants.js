export const PAYMENT_METHODS = {
  BANK: 'BANK_TRANSFER',
  GIFT_CARD: 'GIFT_CARD',
  CRYPTO: 'CRYPTO',
}

export const ORDER_TYPES = {
  SERVICE: 'SERVICE',
  TICKET: 'TICKET',
  SHOP: 'SHOP',
}

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  FLAGGED: 'FLAGGED',
  PAID: 'PAID',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}

export const MEMBERSHIP_PLANS = {
  FREE: 'FREE',
  INNER_CIRCLE: 'INNER_CIRCLE',
  CROWN_ACCESS: 'CROWN_ACCESS',
}

export const MEMBERSHIP_BILLING_CYCLES = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
}

export const MEMBERSHIP_STATUS = {
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FLAGGED: 'FLAGGED',
}

export const MEMBERSHIP_DURATION_DAYS_BY_CYCLE = {
  [MEMBERSHIP_BILLING_CYCLES.MONTHLY]: 30,
  [MEMBERSHIP_BILLING_CYCLES.YEARLY]: 365,
}

export const MEMBERSHIP_DURATION_DAYS =
  MEMBERSHIP_DURATION_DAYS_BY_CYCLE[MEMBERSHIP_BILLING_CYCLES.MONTHLY]

export const ROLES = {
  FAN: 'FAN',
  TALENT: 'TALENT',
  ADMIN: 'ADMIN',
}

export const CONTACT_METHODS = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WHATSAPP: 'WHATSAPP',
}

export const IDENTITY_VERIFICATION_STATUS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  VERIFIED: 'VERIFIED',
  FLAGGED: 'FLAGGED',
}

export const EXPERIENCE_TYPE_ORDER = [
  'VIDEO_MESSAGE',
  'REACTION',
  'REVIEW',
  'VOICE_DROP',
  'COACHING',
  'LIVE_CALL',
  'SIGNED_NOTE',
  'SIGNED_MERCH',
]

export const EXPERIENCE_TYPES = {
  VIDEO_MESSAGE: {
    label: 'Personal Video Message',
    icon: 'Video',
    basePrice: 299,
    priceMultiplier: 1,
    description: 'Custom recorded message for any occasion.',
  },
  REACTION: {
    label: 'Reaction',
    icon: 'Video',
    basePrice: 399,
    priceMultiplier: 1.33,
    description: 'The talent reacts to one fan submission or big moment in a recorded video.',
  },
  REVIEW: {
    label: 'Review',
    icon: 'Sparkles',
    basePrice: 349,
    priceMultiplier: 1.17,
    description:
      'The talent reviews one submitted item: song, video, script, reel, highlight, outfit, artwork, or whatever fits their lane.',
  },
  VOICE_DROP: {
    label: 'Voice Drop',
    icon: 'Mic',
    basePrice: 149,
    priceMultiplier: 0.5,
    description:
      'Custom audio intro, shoutout, tag, or name drop for personal use, streams, podcasts, or content.',
  },
  COACHING: {
    label: 'Coaching',
    icon: 'Phone',
    basePrice: 699,
    priceMultiplier: 2.34,
    description:
      'A focused live session on one topic with a fixed time limit, not an open-ended call.',
  },
  LIVE_CALL: {
    label: 'Private Live Call',
    icon: 'Phone',
    basePrice: 799,
    priceMultiplier: 2.67,
    description: 'Scheduled one-to-one live access arranged around a clear brief and a fixed window.',
  },
  SIGNED_NOTE: {
    label: 'Signed Note',
    icon: 'PenLine',
    basePrice: 249,
    priceMultiplier: 0.83,
    description: 'A handwritten personalized note or card with signature, separate from merch.',
  },
  SIGNED_MERCH: {
    label: 'Signed Merch',
    icon: 'PenLine',
    basePrice: 499,
    priceMultiplier: 1.67,
    description: 'Personally autographed merchandise or collectible item, prepared for shipping.',
  },
}

export const GIFT_CARD_TYPES = [
  'Amazon Gift Card',
  'Apple Gift Card',
  'Steam Gift Card',
  'Google Play Gift Card',
  'iTunes Gift Card',
]

export const CRYPTO_NETWORKS = [
  'Ethereum (ERC-20)',
  'Bitcoin (BTC)',
  'Tron (TRC-20)',
  'BNB Smart Chain (BEP-20)',
]

export const TALENT_CATEGORIES = [
  'All',
  'Music',
  'Film & TV',
  'Sports',
  'Creators',
  'Comedy',
]

export const ORDER_EXPIRY_MINUTES = 30

export const CRYPTO_WALLET_PLACEHOLDER = '0x4B2a91C3e7f8D...A92K'
