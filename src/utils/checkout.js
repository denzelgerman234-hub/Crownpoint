export const createEmptyCheckoutContact = () => ({
  fullName: '',
  email: '',
  phone: '',
})

export const createEmptyShippingAddress = () => ({
  recipient: '',
  country: '',
  countryCode: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateOrRegion: '',
  postalCode: '',
  deliveryNotes: '',
})

export const normalizeCheckoutContact = (contact = {}) => ({
  ...createEmptyCheckoutContact(),
  ...contact,
  fullName: String(contact?.fullName ?? '').trim(),
  email: String(contact?.email ?? '').trim(),
  phone: String(contact?.phone ?? '').trim(),
})

export const normalizeShippingAddress = (shippingAddress = {}) => ({
  ...createEmptyShippingAddress(),
  ...shippingAddress,
  recipient: String(shippingAddress?.recipient ?? '').trim(),
  country: String(shippingAddress?.country ?? '').trim(),
  countryCode: String(shippingAddress?.countryCode ?? '').trim().toUpperCase(),
  addressLine1: String(shippingAddress?.addressLine1 ?? '').trim(),
  addressLine2: String(shippingAddress?.addressLine2 ?? '').trim(),
  city: String(shippingAddress?.city ?? '').trim(),
  stateOrRegion: String(shippingAddress?.stateOrRegion ?? '').trim(),
  postalCode: String(shippingAddress?.postalCode ?? '').trim(),
  deliveryNotes: String(shippingAddress?.deliveryNotes ?? '').trim(),
})

export const buildCheckoutContactFromUser = (user) =>
  normalizeCheckoutContact({
    fullName: user?.name,
    email: user?.email,
    phone: user?.profile?.phone,
  })

export const buildShippingAddressFromUser = (user) =>
  normalizeShippingAddress({
    recipient: user?.name,
    country: user?.profile?.country,
    countryCode: user?.profile?.countryCode,
    city: user?.profile?.city,
  })

export const getShippingAddressSummary = (shippingAddress = {}) => {
  const normalizedShippingAddress = normalizeShippingAddress(shippingAddress)
  const locality = [
    normalizedShippingAddress.city,
    normalizedShippingAddress.stateOrRegion,
  ].filter(Boolean).join(', ')

  return [
    normalizedShippingAddress.recipient,
    locality,
    normalizedShippingAddress.country,
  ].filter(Boolean).join(' / ')
}
