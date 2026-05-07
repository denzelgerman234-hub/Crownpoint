import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Camera, Eye, EyeOff, LogIn, Upload, UserPlus } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { agreementSummaries } from '../data/legalContent'
import {
  completePasswordReset as completePasswordResetService,
  loginPublicUser as loginService,
  register as registerService,
  requestPasswordReset as requestPasswordResetService,
} from '../services/authService'
import {
  removeManagedUpload,
  uploadProfileAvatarFile,
  uploadVerificationDocumentFile,
} from '../services/storageService'
import { CONTACT_METHODS } from '../utils/constants'
import {
  buildInternationalPhoneNumber,
  countryPhoneOptions,
  getCountryPhoneOption,
  getDetectedCountryCode,
  normalizeLocalPhoneNumber,
} from '../utils/countries'
import { MINIMUM_SIGNUP_AGE, isAdultDateOfBirth } from '../utils/profile'
import { revealUp } from '../utils/motion'

const defaultSignIn = {
  email: '',
  password: '',
}

const defaultPasswordReset = {
  password: '',
  confirmPassword: '',
}

const createEmptyVerificationDocuments = () => ({
  idFront: null,
  idBack: null,
  ssn: null,
})

const defaultSignUp = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  phoneDialCode: '',
  dateOfBirth: '',
  city: '',
  country: '',
  countryCode: '',
  favoriteTalent: '',
  occupation: '',
  admirationReason: '',
  interests: '',
  hobbies: '',
  bio: '',
  preferredContactMethod: CONTACT_METHODS.EMAIL,
  avatarUrl: '',
  avatarName: '',
  avatarUploadId: '',
  avatarUpload: null,
  verificationDocuments: createEmptyVerificationDocuments(),
  ndaAccepted: false,
}

const contactMethodOptions = [
  { value: CONTACT_METHODS.EMAIL, label: 'Email' },
  { value: CONTACT_METHODS.PHONE, label: 'Phone Call' },
  { value: CONTACT_METHODS.WHATSAPP, label: 'WhatsApp' },
]

const verificationUploadFields = [
  {
    key: 'idFront',
    title: 'Government ID front',
    helper: 'Upload the front of your government ID for manual review.',
  },
  {
    key: 'idBack',
    title: 'Government ID back',
    helper: 'Upload the back of your government ID for manual review.',
  },
  {
    key: 'ssn',
    title: 'SSN / tax ID photo',
    helper: 'Upload your SSN or tax ID image for manual review.',
  },
]

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, login } = useAuth()
  const { showToast } = useToast()
  const avatarInputRef = useRef(null)
  const idFrontInputRef = useRef(null)
  const idBackInputRef = useRef(null)
  const ssnInputRef = useRef(null)
  const pendingUploadsRef = useRef([])
  const shouldCleanupPendingUploadsRef = useRef(true)
  const requestedMode = searchParams.get('mode')
  const recoveryFlowActive = searchParams.get('flow') === 'recovery'
  const [mode, setMode] = useState(() => (requestedMode === 'signup' ? 'signup' : 'signin'))
  const [signInData, setSignInData] = useState(defaultSignIn)
  const [signUpData, setSignUpData] = useState(defaultSignUp)
  const [passwordResetData, setPasswordResetData] = useState(defaultPasswordReset)
  const [submitting, setSubmitting] = useState(false)
  const [supportAction, setSupportAction] = useState('')
  const [uploadingField, setUploadingField] = useState('')
  const [error, setError] = useState('')
  const [passwordVisibility, setPasswordVisibility] = useState({
    signIn: false,
    signUp: false,
    signUpConfirm: false,
  })

  const redirectTarget = searchParams.get('redirect') || '/dashboard'
  const selectedCountry = getCountryPhoneOption(signUpData.countryCode)
  const selectedDialCode = selectedCountry?.dialCode || signUpData.phoneDialCode || ''

  useEffect(() => {
    if (user && !recoveryFlowActive) {
      navigate(redirectTarget, { replace: true })
    }
  }, [navigate, recoveryFlowActive, redirectTarget, user])

  useEffect(() => {
    if (requestedMode === 'signin' || requestedMode === 'signup') {
      setMode(requestedMode)
    }
  }, [requestedMode])

  useEffect(() => {
    if (recoveryFlowActive) {
      setMode('signin')
    }
  }, [recoveryFlowActive])

  useEffect(() => {
    setSignUpData((current) => {
      if (current.countryCode) {
        return current
      }

      const detectedCountryCode = getDetectedCountryCode()
      const detectedCountry = getCountryPhoneOption(detectedCountryCode)

      if (!detectedCountry) {
        return current
      }

      return {
        ...current,
        countryCode: detectedCountry.code,
        country: detectedCountry.name,
        phoneDialCode: detectedCountry.dialCode,
      }
    })
  }, [])

  useEffect(() => {
    pendingUploadsRef.current = [
      signUpData.avatarUpload,
      ...Object.values(signUpData.verificationDocuments),
    ].filter((upload) => upload?.uploadId)
  }, [signUpData.avatarUpload, signUpData.verificationDocuments])

  useEffect(
    () => () => {
      if (shouldCleanupPendingUploadsRef.current) {
        pendingUploadsRef.current.forEach((upload) => {
          removeManagedUpload(upload).catch(() => {})
        })
      }
    },
    [],
  )

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('mode', nextMode)
    nextSearchParams.delete('flow')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const updateSignInField = (field) => (event) => {
    setSignInData((current) => ({ ...current, [field]: event.target.value }))
    setError('')
  }

  const updateSignUpField = (field) => (event) => {
    setSignUpData((current) => ({ ...current, [field]: event.target.value }))
    setError('')
  }

  const updatePasswordResetField = (field) => (event) => {
    setPasswordResetData((current) => ({ ...current, [field]: event.target.value }))
    setError('')
  }

  const handleCountryChange = (event) => {
    const nextCountry = getCountryPhoneOption(event.target.value)

    setSignUpData((current) => ({
      ...current,
      countryCode: nextCountry?.code ?? '',
      country: nextCountry?.name ?? '',
      phoneDialCode: nextCountry?.dialCode ?? '',
      phone: normalizeLocalPhoneNumber(current.phone, nextCountry?.dialCode ?? ''),
    }))
    setError('')
  }

  const handlePhoneChange = (event) => {
    setSignUpData((current) => ({
      ...current,
      phone: normalizeLocalPhoneNumber(event.target.value, current.phoneDialCode || selectedDialCode),
    }))
    setError('')
  }

  const updateVerificationDocument = (field, nextValue) => {
    setSignUpData((current) => ({
      ...current,
      verificationDocuments: {
        ...current.verificationDocuments,
        [field]: nextValue,
      },
    }))
    setError('')
  }

  const toggleSignUpAgreement = (event) => {
    setSignUpData((current) => ({ ...current, ndaAccepted: event.target.checked }))
    setError('')
  }

  const togglePasswordVisibility = (field) => () => {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }))
  }

  const resolveUploadOwnerKey = () =>
    signUpData.email.trim().toLowerCase() ||
    signUpData.name.trim().toLowerCase().replace(/\s+/g, '-') ||
    'signup-draft'

  const handleAvatarUpload = async (event) => {
    const input = event.target
    const file = input.files?.[0]

    if (!file) {
      return
    }

    try {
      setUploadingField('avatar')
      const uploadedAvatar = await uploadProfileAvatarFile({
        file,
        ownerKey: resolveUploadOwnerKey(),
        isSignupDraft: true,
      })

      if (signUpData.avatarUpload?.uploadId) {
        await removeManagedUpload(signUpData.avatarUpload)
      }

      setSignUpData((current) => ({
        ...current,
        avatarUrl: uploadedAvatar.previewUrl || uploadedAvatar.publicUrl,
        avatarName: uploadedAvatar.fileName,
        avatarUploadId: uploadedAvatar.uploadId,
        avatarUpload: uploadedAvatar,
      }))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingField('')
      input.value = ''
    }
  }

  const handleVerificationUpload = (field) => async (event) => {
    const input = event.target
    const file = input.files?.[0]

    if (!file) {
      return
    }

    try {
      setUploadingField(field)
      const uploadedFile = await uploadVerificationDocumentFile({
        file,
        ownerKey: resolveUploadOwnerKey(),
        documentType: field,
        isSignupDraft: true,
      })
      const existingUpload = signUpData.verificationDocuments[field]

      if (existingUpload?.uploadId) {
        await removeManagedUpload(existingUpload)
      }

      updateVerificationDocument(field, uploadedFile)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingField('')
      input.value = ''
    }
  }

  const handleSignIn = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await loginService(signInData.email, signInData.password)
      login(response.user, response.token)
      showToast(`Welcome back, ${response.user.name}.`, 'success')
      navigate(redirectTarget, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordResetRequest = async () => {
    setError('')

    try {
      setSupportAction('request-password-reset')
      await requestPasswordResetService(signInData.email)
      showToast('Password reset email sent. Open the newest email to continue.', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSupportAction('')
    }
  }

  const handlePasswordResetComplete = async (event) => {
    event.preventDefault()

    if (passwordResetData.password !== passwordResetData.confirmPassword) {
      setError('Passwords do not match yet. Please confirm the same password twice.')
      return
    }

    setError('')

    try {
      setSupportAction('complete-password-reset')
      const nextUser = await completePasswordResetService(passwordResetData.password)

      if (nextUser) {
        login(nextUser)
      }

      showToast('Password updated successfully. You can continue using your account.', 'success')
      navigate(redirectTarget, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSupportAction('')
    }
  }

  const handleSignUp = async (event) => {
    event.preventDefault()

    if (signUpData.password !== signUpData.confirmPassword) {
      setError('Passwords do not match yet. Please confirm the same password twice.')
      return
    }

    if (!signUpData.countryCode || !selectedCountry) {
      setError('Please select your country so we can add the correct calling code to your phone number.')
      return
    }

    const formattedPhoneNumber = buildInternationalPhoneNumber({
      countryCode: signUpData.countryCode,
      dialCode: selectedDialCode,
      localNumber: signUpData.phone,
    })

    if (!formattedPhoneNumber) {
      setError('Please add a phone number so the team has a contact record for your account.')
      return
    }

    if (!isAdultDateOfBirth(signUpData.dateOfBirth)) {
      setError(`CrownPoint sign-up is available only to users who are ${MINIMUM_SIGNUP_AGE} or older.`)
      return
    }

    if (!signUpData.ndaAccepted) {
      setError('You must accept the confidentiality agreement before creating an account.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const { confirmPassword: _confirmPassword, ...registrationData } = signUpData
      const response = await registerService({
        ...registrationData,
        avatarUpload: signUpData.avatarUpload,
        country: selectedCountry.name,
        phone: formattedPhoneNumber,
        phoneDialCode: selectedDialCode,
        ndaAcceptedAt: new Date().toISOString(),
      })

      if (response.requiresConfirmation) {
        shouldCleanupPendingUploadsRef.current = false
        throw new Error(
          'Account creation reached Supabase, but email confirmation is still enabled there. This project expects new users to sign in immediately.',
        )
      }

      shouldCleanupPendingUploadsRef.current = false
      login(response.user, response.token)
      showToast(`Account created for ${response.user.name}.`, 'success')
      navigate(redirectTarget, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const verificationInputRefs = {
    idFront: idFrontInputRef,
    idBack: idBackInputRef,
    ssn: ssnInputRef,
  }
  const isUploading = Boolean(uploadingField)

  return (
    <PageWrapper className="cp-page--auth">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Account access</span>
            <h1 className="cp-page-title">
              Sign in for your account, orders, and <em>private messages.</em>
            </h1>
            <p className="cp-page-intro">
              Create an account or sign back in to keep your bookings, message access, and profile in one place.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container cp-auth-grid">
          <motion.div className="cp-auth-lead cp-surface cp-surface--accent" {...revealUp}>
            <span className="cp-eyebrow">What unlocks here</span>
            <h2 className="section-title">
              Everything you need, kept in <em>one place.</em>
            </h2>
            <ul className="cp-list">
              <li>Track orders from payment through delivery.</li>
              <li>Unlock private messages when your membership becomes active.</li>
              <li>Build a verified fan profile with contact, identity, and preference details.</li>
            </ul>
            <div className="cp-inline-trust" style={{ marginTop: 22 }}>
              <span className="cp-chip">
                <LogIn size={14} />
                Sign in for returning fans
              </span>
              <span className="cp-chip">
                <UserPlus size={14} />
                Structured account setup
              </span>
              <span className="cp-chip">
                <Camera size={14} />
                Verified profile onboarding
              </span>
            </div>
          </motion.div>

          <motion.div className="cp-auth-card cp-surface" {...revealUp}>
            <div className="cp-auth-toggle">
              <button
                className={`cp-tab-button${mode === 'signin' ? ' is-active' : ''}`}
                onClick={() => switchMode('signin')}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`cp-tab-button${mode === 'signup' ? ' is-active' : ''}`}
                onClick={() => switchMode('signup')}
                type="button"
              >
                Create account
              </button>
            </div>

            {mode === 'signin' ? (
              recoveryFlowActive ? (
                <form className="cp-form-grid" onSubmit={handlePasswordResetComplete}>
                  <div className="cp-form-section-head">
                    <span className="cp-eyebrow">Password recovery</span>
                    <h3>Choose a new password for your account.</h3>
                    <p className="cp-text-muted">
                      You opened a valid password recovery link. Set a new password below, then we
                      will sign you back in.
                    </p>
                  </div>

                  <div className="cp-field">
                    <label htmlFor="recovery-password">New password</label>
                    <div className="cp-password-field">
                      <input
                        autoComplete="new-password"
                        id="recovery-password"
                        onChange={updatePasswordResetField('password')}
                        placeholder="Choose a new password"
                        required
                        type={passwordVisibility.signUp ? 'text' : 'password'}
                        value={passwordResetData.password}
                      />
                      <button
                        aria-label={passwordVisibility.signUp ? 'Hide password' : 'Show password'}
                        aria-pressed={passwordVisibility.signUp}
                        className="cp-password-toggle"
                        onClick={togglePasswordVisibility('signUp')}
                        title={passwordVisibility.signUp ? 'Hide password' : 'Show password'}
                        type="button"
                      >
                        {passwordVisibility.signUp ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="cp-field">
                    <label htmlFor="recovery-confirm-password">Confirm new password</label>
                    <div className="cp-password-field">
                      <input
                        autoComplete="new-password"
                        id="recovery-confirm-password"
                        onChange={updatePasswordResetField('confirmPassword')}
                        placeholder="Repeat the new password"
                        required
                        type={passwordVisibility.signUpConfirm ? 'text' : 'password'}
                        value={passwordResetData.confirmPassword}
                      />
                      <button
                        aria-label={
                          passwordVisibility.signUpConfirm ? 'Hide password' : 'Show password'
                        }
                        aria-pressed={passwordVisibility.signUpConfirm}
                        className="cp-password-toggle"
                        onClick={togglePasswordVisibility('signUpConfirm')}
                        title={
                          passwordVisibility.signUpConfirm ? 'Hide password' : 'Show password'
                        }
                        type="button"
                      >
                        {passwordVisibility.signUpConfirm ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && <p className="cp-form-error">{error}</p>}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <button
                      className="cp-btn cp-btn--primary"
                      disabled={supportAction === 'complete-password-reset'}
                      type="submit"
                    >
                      {supportAction === 'complete-password-reset'
                        ? 'Saving password...'
                        : 'Save new password'}
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="cp-btn cp-btn--ghost"
                      onClick={() => switchMode('signin')}
                      type="button"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              ) : (
                <form className="cp-form-grid" onSubmit={handleSignIn}>
                  <div className="cp-field">
                    <label htmlFor="signin-email">Email</label>
                    <input
                      id="signin-email"
                      onChange={updateSignInField('email')}
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={signInData.email}
                    />
                  </div>
                  <div className="cp-field">
                    <label htmlFor="signin-password">Password</label>
                    <div className="cp-password-field">
                      <input
                        autoComplete="current-password"
                        id="signin-password"
                        onChange={updateSignInField('password')}
                        placeholder="Your password"
                        required
                        type={passwordVisibility.signIn ? 'text' : 'password'}
                        value={signInData.password}
                      />
                      <button
                        aria-label={passwordVisibility.signIn ? 'Hide password' : 'Show password'}
                        aria-pressed={passwordVisibility.signIn}
                        className="cp-password-toggle"
                        onClick={togglePasswordVisibility('signIn')}
                        title={passwordVisibility.signIn ? 'Hide password' : 'Show password'}
                        type="button"
                      >
                        {passwordVisibility.signIn ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="cp-form-error">{error}</p>}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <button
                      className="cp-btn cp-btn--quiet"
                      disabled={Boolean(supportAction)}
                      onClick={handlePasswordResetRequest}
                      type="button"
                    >
                      {supportAction === 'request-password-reset'
                        ? 'Sending reset...'
                        : 'Forgot password?'}
                    </button>
                  </div>

                  <button className="cp-btn cp-btn--primary" disabled={submitting} type="submit">
                    {submitting ? 'Signing in...' : 'Sign in'}
                    <ArrowRight size={14} />
                  </button>
                </form>
              )
            ) : (
              <form className="cp-form-grid" onSubmit={handleSignUp}>
                <div className="cp-form-section">
                  <div className="cp-form-section-head">
                    <span className="cp-eyebrow">Account basics</span>
                    <h3>Set up the essentials for a verified fan profile.</h3>
                    <p className="cp-text-muted">
                      These details shape your account record, contact reachability, and age gate.
                    </p>
                  </div>

                  <div className="cp-form-grid cp-form-grid--two">
                    <div className="cp-field">
                      <label htmlFor="signup-name">Full name</label>
                      <input
                        id="signup-name"
                        onChange={updateSignUpField('name')}
                        placeholder="Your full legal name"
                        required
                        value={signUpData.name}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-email">Email</label>
                      <input
                        id="signup-email"
                        onChange={updateSignUpField('email')}
                        placeholder="you@example.com"
                        required
                        type="email"
                        value={signUpData.email}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-contact-method">Preferred contact method</label>
                      <select
                        id="signup-contact-method"
                        onChange={updateSignUpField('preferredContactMethod')}
                        value={signUpData.preferredContactMethod}
                      >
                        {contactMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-dob">Date of birth</label>
                      <input
                        id="signup-dob"
                        max={new Date().toISOString().split('T')[0]}
                        onChange={updateSignUpField('dateOfBirth')}
                        required
                        type="date"
                        value={signUpData.dateOfBirth}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-occupation">Occupation</label>
                      <input
                        id="signup-occupation"
                        onChange={updateSignUpField('occupation')}
                        placeholder="Creative director, entrepreneur, student..."
                        value={signUpData.occupation}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-city">City</label>
                      <input
                        id="signup-city"
                        onChange={updateSignUpField('city')}
                        placeholder="Atlanta"
                        value={signUpData.city}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-country">Country</label>
                      <select
                        id="signup-country"
                        onChange={handleCountryChange}
                        required
                        value={signUpData.countryCode}
                      >
                        <option value="">Select your country</option>
                        {countryPhoneOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.name} ({option.dialCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-phone">Phone number</label>
                      <div className="cp-phone-field">
                        <span className={`cp-phone-prefix${selectedDialCode ? ' is-active' : ''}`}>
                          {selectedDialCode || 'Code'}
                        </span>
                        <input
                          autoComplete="tel-national"
                          id="signup-phone"
                          inputMode="numeric"
                          onChange={handlePhoneChange}
                          placeholder={selectedCountry ? '8012345678' : 'Select your country first'}
                          required
                          type="tel"
                          value={signUpData.phone}
                        />
                      </div>
                      <p className="cp-field-note">Your country code is added automatically when you sign up.</p>
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-password">Password</label>
                      <div className="cp-password-field">
                        <input
                          autoComplete="new-password"
                          id="signup-password"
                          onChange={updateSignUpField('password')}
                          placeholder="Create a password"
                          required
                          type={passwordVisibility.signUp ? 'text' : 'password'}
                          value={signUpData.password}
                        />
                        <button
                          aria-label={passwordVisibility.signUp ? 'Hide password' : 'Show password'}
                          aria-pressed={passwordVisibility.signUp}
                          className="cp-password-toggle"
                          onClick={togglePasswordVisibility('signUp')}
                          title={passwordVisibility.signUp ? 'Hide password' : 'Show password'}
                          type="button"
                        >
                          {passwordVisibility.signUp ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-confirm-password">Confirm password</label>
                      <div className="cp-password-field">
                        <input
                          autoComplete="new-password"
                          id="signup-confirm-password"
                          onChange={updateSignUpField('confirmPassword')}
                          placeholder="Enter the same password again"
                          required
                          type={passwordVisibility.signUpConfirm ? 'text' : 'password'}
                          value={signUpData.confirmPassword}
                        />
                        <button
                          aria-label={passwordVisibility.signUpConfirm ? 'Hide password' : 'Show password'}
                          aria-pressed={passwordVisibility.signUpConfirm}
                          className="cp-password-toggle"
                          onClick={togglePasswordVisibility('signUpConfirm')}
                          title={passwordVisibility.signUpConfirm ? 'Hide password' : 'Show password'}
                          type="button"
                        >
                          {passwordVisibility.signUpConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cp-form-section">
                  <div className="cp-form-section-head">
                    <span className="cp-eyebrow">Profile story</span>
                    <h3>Give your profile a polished personal layer.</h3>
                    <p className="cp-text-muted">
                      These details help your account feel curated instead of anonymous.
                    </p>
                  </div>

                  <div className="cp-form-grid cp-form-grid--two">
                    <div className="cp-field">
                      <label htmlFor="signup-favorite-talent">Favorite celebrity / talent</label>
                      <input
                        id="signup-favorite-talent"
                        onChange={updateSignUpField('favoriteTalent')}
                        placeholder="Who are you most excited to follow?"
                        value={signUpData.favoriteTalent}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-hobbies">Hobbies</label>
                      <input
                        id="signup-hobbies"
                        onChange={updateSignUpField('hobbies')}
                        placeholder="Travel, film nights, collectibles, sports..."
                        value={signUpData.hobbies}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-interests">Interests</label>
                      <input
                        id="signup-interests"
                        onChange={updateSignUpField('interests')}
                        placeholder="Music releases, fashion, live shows, entertainment news..."
                        value={signUpData.interests}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="signup-admiration-reason">What do you like about the celebrity?</label>
                      <textarea
                        id="signup-admiration-reason"
                        onChange={updateSignUpField('admirationReason')}
                        placeholder="Share what draws you to them: their craft, discipline, personality, or impact."
                        value={signUpData.admirationReason}
                      />
                    </div>
                  </div>

                  <div className="cp-field">
                    <label htmlFor="signup-bio">Short bio</label>
                    <textarea
                      id="signup-bio"
                      onChange={updateSignUpField('bio')}
                      placeholder="Write a concise profile bio that would look good on your account."
                      value={signUpData.bio}
                    />
                  </div>
                </div>

                <div className="cp-form-section">
                  <div className="cp-form-section-head">
                    <span className="cp-eyebrow">Profile media</span>
                    <h3>Add your public photo and any supporting review images.</h3>
                    <p className="cp-text-muted">
                      Your avatar is optional. Any screenshots or document images you add here stay in
                      manual review and are never auto-rejected by the form.
                    </p>
                  </div>

                  <div className="cp-field">
                    <label>Profile photo (optional)</label>
                    <div
                      className={`cp-upload-zone${signUpData.avatarUrl ? ' has-file' : ''}`}
                      onClick={() => avatarInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          avatarInputRef.current?.click()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {signUpData.avatarUrl ? (
                        <div className="cp-auth-upload-preview">
                          <img
                            alt="Selected profile preview"
                            className="cp-auth-upload-image"
                            src={signUpData.avatarUrl}
                          />
                          <div>
                            <p className="cp-upload-text">{signUpData.avatarName || 'Image selected'}</p>
                            <p className="cp-upload-subtext">
                              {uploadingField === 'avatar'
                                ? 'Preparing preview...'
                                : 'Tap to choose a different photo'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="cp-upload-icon" size={22} />
                          <p className="cp-upload-text">
                            {uploadingField === 'avatar'
                              ? 'Uploading profile photo...'
                              : 'Upload a profile photo from your device'}
                          </p>
                          <p className="cp-upload-subtext">PNG, JPG, or WEBP up to 2MB</p>
                        </div>
                      )}
                      <input
                        accept=".png,.jpg,.jpeg,.webp"
                        hidden
                        onChange={handleAvatarUpload}
                        ref={avatarInputRef}
                        type="file"
                      />
                    </div>
                  </div>

                  <div className="cp-auth-upload-grid">
                    {verificationUploadFields.map((field) => {
                      const uploadedDocument = signUpData.verificationDocuments[field.key]
                      const inputRef = verificationInputRefs[field.key]

                      return (
                        <div key={field.key} className="cp-field">
                          <label>{field.title}</label>
                          <div
                            className={`cp-upload-zone cp-upload-zone--document${uploadedDocument ? ' has-file' : ''}`}
                            onClick={() => inputRef.current?.click()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                inputRef.current?.click()
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            {uploadedDocument ? (
                              <div className="cp-auth-upload-file">
                                <img
                                  alt={`${field.title} preview`}
                                  className="cp-auth-upload-document-image"
                                  src={uploadedDocument.previewUrl}
                                />
                                <p className="cp-upload-text">{field.title}</p>
                                <p className="cp-upload-subtext">
                                  {uploadingField === field.key
                                    ? 'Refreshing preview...'
                                    : 'Preview ready. Tap to replace.'}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <Upload className="cp-upload-icon" size={22} />
                                <p className="cp-upload-text">
                                  {uploadingField === field.key ? 'Uploading document...' : field.title}
                                </p>
                                <p className="cp-upload-subtext">{field.helper} PNG, JPG, or WEBP up to 10MB.</p>
                              </div>
                            )}
                            <input
                              accept=".png,.jpg,.jpeg,.webp"
                              hidden
                              onChange={handleVerificationUpload(field.key)}
                              ref={inputRef}
                              type="file"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="cp-nda-card">
                  <span className="cp-eyebrow">Interaction NDA</span>
                  <p className="cp-nda-copy">
                    Messages, call details, booking notes, payment proofs, delivery files, and any
                    other non-public information shared through CrownPoint must stay private. You may
                    not record, screenshot, repost, forward, leak, or disclose those interactions
                    without written permission from CrownPoint and the relevant Talent.
                  </p>
                  <label className="cp-nda-check" htmlFor="signup-nda">
                    <input
                      checked={signUpData.ndaAccepted}
                      id="signup-nda"
                      onChange={toggleSignUpAgreement}
                      required
                      type="checkbox"
                    />
                    <span>
                      I agree to the CrownPoint Interaction Privacy & Non-Disclosure Agreement and
                      understand that any breach can lead to account termination, cancelled access,
                      and legal enforcement.
                    </span>
                  </label>
                  <p className="cp-nda-footnote">
                    {agreementSummaries.fanSignup}{' '}
                    <Link to="/legal?tab=confidentiality">Read the full confidentiality terms.</Link>
                  </p>
                </div>

                {error && <p className="cp-form-error">{error}</p>}

                <button className="cp-btn cp-btn--primary" disabled={submitting || isUploading} type="submit">
                  {submitting ? 'Creating account...' : isUploading ? 'Finishing uploads...' : 'Create account'}
                  <ArrowRight size={14} />
                </button>
              </form>
            )}

            <p className="cp-note">
              Looking around first? You can still <Link to="/talents">browse talents</Link> before
              creating an account.
            </p>
          </motion.div>
        </div>
      </section>
    </PageWrapper>
  )
}
