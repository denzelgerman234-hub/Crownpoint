import { IDENTITY_VERIFICATION_STATUS } from './constants'

export const MINIMUM_SIGNUP_AGE = 18

export const getAgeFromDateOfBirth = (dateOfBirth) => {
  if (!dateOfBirth) {
    return null
  }

  const birthDate = new Date(dateOfBirth)

  if (Number.isNaN(birthDate.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hasBirthdayPassedThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())

  if (!hasBirthdayPassedThisYear) {
    age -= 1
  }

  return age
}

export const isAdultDateOfBirth = (dateOfBirth) => {
  const age = getAgeFromDateOfBirth(dateOfBirth)
  return age !== null && age >= MINIMUM_SIGNUP_AGE
}

export const getUserDisplayLocation = (user) =>
  [user?.profile?.city, user?.profile?.country].filter(Boolean).join(', ')

export const getIdentityVerificationLabel = (status) => {
  switch (status) {
    case IDENTITY_VERIFICATION_STATUS.VERIFIED:
      return 'Verified'
    case IDENTITY_VERIFICATION_STATUS.FLAGGED:
      return 'Needs Attention'
    case IDENTITY_VERIFICATION_STATUS.PENDING_REVIEW:
      return 'Pending Review'
    default:
      return 'Not Submitted'
  }
}
