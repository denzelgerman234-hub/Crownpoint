const COUNTRY_DIAL_CODES = {
  AE: '+971',
  AF: '+93',
  AL: '+355',
  AM: '+374',
  AO: '+244',
  AR: '+54',
  AT: '+43',
  AU: '+61',
  AZ: '+994',
  BA: '+387',
  BD: '+880',
  BE: '+32',
  BF: '+226',
  BG: '+359',
  BH: '+973',
  BI: '+257',
  BJ: '+229',
  BN: '+673',
  BO: '+591',
  BR: '+55',
  BS: '+1',
  BW: '+267',
  BY: '+375',
  BZ: '+501',
  CA: '+1',
  CD: '+243',
  CG: '+242',
  CH: '+41',
  CI: '+225',
  CL: '+56',
  CM: '+237',
  CN: '+86',
  CO: '+57',
  CR: '+506',
  CY: '+357',
  CZ: '+420',
  DE: '+49',
  DK: '+45',
  DO: '+1',
  DZ: '+213',
  EC: '+593',
  EE: '+372',
  EG: '+20',
  ES: '+34',
  ET: '+251',
  FI: '+358',
  FR: '+33',
  GB: '+44',
  GE: '+995',
  GH: '+233',
  GM: '+220',
  GN: '+224',
  GQ: '+240',
  GR: '+30',
  GT: '+502',
  HK: '+852',
  HN: '+504',
  HR: '+385',
  HU: '+36',
  ID: '+62',
  IE: '+353',
  IL: '+972',
  IN: '+91',
  IQ: '+964',
  IR: '+98',
  IS: '+354',
  IT: '+39',
  JM: '+1',
  JO: '+962',
  JP: '+81',
  KE: '+254',
  KG: '+996',
  KH: '+855',
  KR: '+82',
  KW: '+965',
  KZ: '+7',
  LA: '+856',
  LB: '+961',
  LK: '+94',
  LT: '+370',
  LU: '+352',
  LV: '+371',
  LY: '+218',
  MA: '+212',
  MD: '+373',
  ME: '+382',
  MG: '+261',
  MK: '+389',
  ML: '+223',
  MM: '+95',
  MN: '+976',
  MO: '+853',
  MT: '+356',
  MU: '+230',
  MW: '+265',
  MX: '+52',
  MY: '+60',
  MZ: '+258',
  NA: '+264',
  NE: '+227',
  NG: '+234',
  NI: '+505',
  NL: '+31',
  NO: '+47',
  NP: '+977',
  NZ: '+64',
  OM: '+968',
  PA: '+507',
  PE: '+51',
  PH: '+63',
  PK: '+92',
  PL: '+48',
  PT: '+351',
  PY: '+595',
  QA: '+974',
  RO: '+40',
  RS: '+381',
  RU: '+7',
  RW: '+250',
  SA: '+966',
  SD: '+249',
  SE: '+46',
  SG: '+65',
  SI: '+386',
  SK: '+421',
  SN: '+221',
  TH: '+66',
  TN: '+216',
  TR: '+90',
  TW: '+886',
  TZ: '+255',
  UA: '+380',
  UG: '+256',
  US: '+1',
  UY: '+598',
  UZ: '+998',
  VE: '+58',
  VN: '+84',
  ZA: '+27',
  ZM: '+260',
  ZW: '+263',
}

const createRegionNameFormatter = () => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
}

const regionNameFormatter = createRegionNameFormatter()

const getCountryName = (countryCode) => regionNameFormatter?.of(countryCode) ?? countryCode

export const countryPhoneOptions = Object.entries(COUNTRY_DIAL_CODES)
  .map(([code, dialCode]) => ({
    code,
    dialCode,
    name: getCountryName(code),
  }))
  .sort((left, right) => left.name.localeCompare(right.name))

export const getCountryPhoneOption = (countryCode) =>
  countryPhoneOptions.find((option) => option.code === countryCode) ?? null

export const getCountryPhoneOptionByName = (countryName) => {
  const normalizedCountryName = String(countryName ?? '').trim().toLowerCase()

  if (!normalizedCountryName) {
    return null
  }

  return (
    countryPhoneOptions.find((option) => option.name.trim().toLowerCase() === normalizedCountryName) ?? null
  )
}

export const getDetectedCountryCode = () => {
  if (typeof navigator === 'undefined') {
    return ''
  }

  const localeCandidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean)

  for (const locale of localeCandidates) {
    const match = String(locale).match(/[-_](?<region>[a-z]{2})$/i)
    const region = match?.groups?.region?.toUpperCase()

    if (region && COUNTRY_DIAL_CODES[region]) {
      return region
    }
  }

  return ''
}

export const normalizeLocalPhoneNumber = (value, dialCode = '') => {
  const rawValue = String(value ?? '').trim()
  const digitsOnly = rawValue.replace(/\D+/g, '')
  const dialDigits = String(dialCode ?? '').replace(/\D+/g, '')

  if (!digitsOnly) {
    return ''
  }

  const startsWithExplicitCountryCode =
    Boolean(dialDigits) &&
    (rawValue.startsWith('+') || rawValue.startsWith('00')) &&
    digitsOnly.startsWith(dialDigits)

  return startsWithExplicitCountryCode ? digitsOnly.slice(dialDigits.length) : digitsOnly
}

export const buildInternationalPhoneNumber = ({ countryCode = '', dialCode = '', localNumber = '' }) => {
  const resolvedDialCode = dialCode || getCountryPhoneOption(countryCode)?.dialCode || ''
  const dialDigits = String(resolvedDialCode).replace(/\D+/g, '')
  const normalizedLocalNumber = normalizeLocalPhoneNumber(localNumber, resolvedDialCode)

  if (!normalizedLocalNumber) {
    return ''
  }

  if (!dialDigits) {
    return normalizedLocalNumber
  }

  return `+${dialDigits} ${normalizedLocalNumber}`.trim()
}
