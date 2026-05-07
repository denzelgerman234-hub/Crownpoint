import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock3, MessageSquareText, Trash2, Upload, UserRound, Wallet } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import StatusBadge from '../components/ui/StatusBadge'
import { useCart } from '../context/CartContext'
import { useOrder } from '../context/OrderContext'
import { useAuth } from '../hooks/useAuth'
import { useTalentRoster } from '../hooks/useTalentRoster'
import { useToast } from '../hooks/useToast'
import {
  getUserMembershipRequests,
  refreshMembershipQueue,
  subscribeToMembershipUpdates,
} from '../services/membershipService'
import {
  getMessageThreads,
  refreshMessageThreads,
  subscribeToMessageUpdates,
} from '../services/messageService'
import { getUserOrders, refreshOrders, subscribeToOrderUpdates } from '../services/orderService'
import {
  removeManagedUpload,
  uploadProfileAvatarFile,
} from '../services/storageService'
import {
  deleteUserAccount as deleteUserAccountService,
  updateUserAccount as updateUserAccountService,
} from '../services/userService'
import { CONTACT_METHODS, MEMBERSHIP_PLANS, ORDER_STATUS } from '../utils/constants'
import {
  buildInternationalPhoneNumber,
  countryPhoneOptions,
  getCountryPhoneOption,
  getCountryPhoneOptionByName,
  normalizeLocalPhoneNumber,
} from '../utils/countries'
import { formatCurrency, formatDate } from '../utils/formatters'
import {
  getBillingCycleLabel,
  getMembershipScopeCopy,
  getMembershipSelectionLabel,
} from '../utils/memberships'
import {
  getAgeFromDateOfBirth,
  getIdentityVerificationLabel,
  getUserDisplayLocation,
} from '../utils/profile'
import {
  getOrderContextLabel,
  getOrderEta,
  getOrderTalentName,
  getOrderTitle,
} from '../utils/orders'
import { revealUp } from '../utils/motion'

const contactMethodLabels = {
  [CONTACT_METHODS.EMAIL]: 'Email',
  [CONTACT_METHODS.PHONE]: 'Phone Call',
  [CONTACT_METHODS.WHATSAPP]: 'WhatsApp',
}

const editableContactMethodOptions = [
  { value: CONTACT_METHODS.EMAIL, label: 'Email' },
  { value: CONTACT_METHODS.PHONE, label: 'Phone Call' },
  { value: CONTACT_METHODS.WHATSAPP, label: 'WhatsApp' },
]

const DASHBOARD_TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'account', label: 'Account Settings' },
  { id: 'activity', label: 'Recent Activity' },
]

const activityTitlesByOrderStatus = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'Payment details saved',
  [ORDER_STATUS.UNDER_REVIEW]: 'Order submitted for review',
  [ORDER_STATUS.FLAGGED]: 'Order flagged for review',
  [ORDER_STATUS.PAID]: 'Payment approved',
  [ORDER_STATUS.IN_PROGRESS]: 'Order in progress',
  [ORDER_STATUS.COMPLETED]: 'Order completed',
  [ORDER_STATUS.FAILED]: 'Payment rejected',
}

const membershipActivityTitles = {
  UNDER_REVIEW: 'Membership request submitted',
  APPROVED: 'Membership activated',
  REJECTED: 'Membership request declined',
  FLAGGED: 'Membership request flagged',
}

const buildAttachmentActivityLabel = (attachments = []) => {
  const count = Array.isArray(attachments) ? attachments.length : 0
  return count ? `${count} attachment${count === 1 ? '' : 's'} shared in your inbox.` : ''
}

const buildMessageActivitySummary = (message) => {
  const text = String(message?.text ?? '').trim()

  if (text) {
    return text
  }

  return buildAttachmentActivityLabel(message?.attachments) || 'A message was added to your private inbox.'
}

const buildDashboardActivity = ({ membershipRequests, messageThreads, orders, user }) => {
  const activityItems = [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      timestamp: order.reviewedAt ?? order.submittedAt ?? order.createdAt ?? null,
      title: activityTitlesByOrderStatus[order.status] ?? 'Order updated',
      body: `${getOrderTitle(order)} with ${getOrderTalentName(order)}. ${getOrderEta(order)}.`,
    })),
    ...membershipRequests.map((request) => ({
      id: `membership-${request.id}`,
      timestamp: request.reviewedAt ?? request.submittedAt ?? null,
      title: membershipActivityTitles[request.status] ?? 'Membership request updated',
      body: `${getMembershipSelectionLabel(request.plan, request.billingCycle)} for ${request.talentName}.`,
    })),
    ...messageThreads.flatMap((thread) => {
      const nonSystemMessages = thread.messages.filter((message) => message.senderRole !== 'system')
      const lastMessage = nonSystemMessages[nonSystemMessages.length - 1] ?? null

      if (!lastMessage?.createdAt) {
        return []
      }

      return [{
        id: `message-${thread.id}-${lastMessage.id}`,
        timestamp: lastMessage.createdAt,
        title:
          lastMessage.senderRole === 'fan'
            ? `You messaged ${thread.talentName}`
            : `New message from ${thread.talentName}`,
        body: buildMessageActivitySummary(lastMessage),
      }]
    }),
  ]

  if (user?.profileUpdatedAt) {
    activityItems.push({
      id: 'profile-update',
      timestamp: user.profileUpdatedAt,
      title: 'Profile updated',
      body: 'Your account details were saved successfully.',
    })
  }

  return activityItems
    .filter((item) => item.timestamp)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 5)
}

const createProfileForm = (user) => {
  const countryOption =
    getCountryPhoneOption(user?.profile?.countryCode) ??
    getCountryPhoneOptionByName(user?.profile?.country)
  const resolvedDialCode = countryOption?.dialCode ?? String(user?.profile?.phoneDialCode ?? '').trim()

  return {
    name: String(user?.name ?? '').trim(),
    email: String(user?.email ?? '').trim(),
    country: countryOption?.name ?? String(user?.profile?.country ?? '').trim(),
    countryCode: countryOption?.code ?? '',
    phoneDialCode: resolvedDialCode,
    phone: normalizeLocalPhoneNumber(user?.profile?.phone ?? '', resolvedDialCode),
    city: String(user?.profile?.city ?? '').trim(),
    occupation: String(user?.profile?.occupation ?? '').trim(),
    preferredContactMethod: user?.profile?.preferredContactMethod ?? CONTACT_METHODS.EMAIL,
    favoriteTalent: String(user?.profile?.favoriteTalent ?? '').trim(),
    hobbies: String(user?.profile?.hobbies ?? '').trim(),
    interests: String(user?.profile?.interests ?? '').trim(),
    admirationReason: String(user?.profile?.admirationReason ?? '').trim(),
    bio: String(user?.profile?.bio ?? '').trim(),
    avatarUrl: String(user?.avatarUrl ?? '').trim(),
    avatarName: '',
    avatarStorage: user?.avatarStorage ?? null,
  }
}

export default function FanDashboard() {
  const {
    currentPlan,
    currentPlanBillingCycleLabel,
    currentPlanLabel,
    hasPlan,
    logout,
    unlockedTalentIds,
    user,
  } = useAuth()
  const { clearCart } = useCart()
  const { resetOrder } = useOrder()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const talentRoster = useTalentRoster()
  const avatarInputRef = useRef(null)
  const pendingAvatarUploadRef = useRef(null)
  const [orders, setOrders] = useState(() => (user ? getUserOrders(user.id) : []))
  const [membershipRequests, setMembershipRequests] = useState(() =>
    user ? getUserMembershipRequests(user.id) : [],
  )
  const [messageThreads, setMessageThreads] = useState(() =>
    user ? getMessageThreads().filter((thread) => thread.fanUserId === Number(user.id)) : [],
  )
  const [profileForm, setProfileForm] = useState(() => createProfileForm(user))
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [profileUploading, setProfileUploading] = useState(false)
  const [deleteAccountSubmitting, setDeleteAccountSubmitting] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [activeContentTab, setActiveContentTab] = useState('orders')
  const hasMessagingAccess = unlockedTalentIds.length > 0

  useEffect(() => {
    if (!user) {
      setOrders([])
      return undefined
    }

    const syncOrders = () => setOrders(getUserOrders(user.id))
    syncOrders()
    refreshOrders()
      .then(syncOrders)
      .catch((error) => {
        showToast(error.message || 'We could not refresh your orders right now.', 'warning')
      })
    return subscribeToOrderUpdates(syncOrders)
  }, [showToast, user])

  useEffect(() => {
    if (!user) {
      setMembershipRequests([])
      return undefined
    }

    const syncMembershipRequests = () => setMembershipRequests(getUserMembershipRequests(user.id))
    syncMembershipRequests()
    refreshMembershipQueue()
      .then(syncMembershipRequests)
      .catch((error) => {
        showToast(error.message || 'We could not refresh your membership activity right now.', 'warning')
      })
    return subscribeToMembershipUpdates(syncMembershipRequests)
  }, [showToast, user])

  useEffect(() => {
    if (!user || !hasMessagingAccess) {
      setMessageThreads([])
      return undefined
    }

    const syncThreads = () =>
      setMessageThreads(
        getMessageThreads().filter((thread) => thread.fanUserId === Number(user.id)),
      )
    syncThreads()
    refreshMessageThreads()
      .then(syncThreads)
      .catch((error) => {
        showToast(error.message || 'We could not refresh your message inbox right now.', 'warning')
      })
    return subscribeToMessageUpdates(syncThreads)
  }, [hasMessagingAccess, showToast, user])

  useEffect(() => {
    setProfileForm(createProfileForm(user))
    setProfileError('')
  }, [user])

  useEffect(
    () => () => {
      const pendingUpload = pendingAvatarUploadRef.current

      if (!pendingUpload?.uploadId) {
        return
      }

      if (
        pendingUpload.storagePath &&
        pendingUpload.storagePath === user?.avatarStorage?.storagePath
      ) {
        return
      }

      removeManagedUpload(pendingUpload).catch(() => {})
    },
    [user?.avatarStorage?.storagePath],
  )

  const activeOrders = orders.filter((order) =>
    [
      ORDER_STATUS.PENDING_PAYMENT,
      ORDER_STATUS.UNDER_REVIEW,
      ORDER_STATUS.FLAGGED,
      ORDER_STATUS.PAID,
      ORDER_STATUS.IN_PROGRESS,
    ].includes(order.status),
  ).length
  const totalSpend = orders.reduce((sum, order) => sum + order.totalPrice, 0)
  const unlockedCount =
    currentPlan === MEMBERSHIP_PLANS.CROWN_ACCESS ? talentRoster.length : unlockedTalentIds.length
  const latestMembershipRequest = membershipRequests[0] ?? null
  const userLocation = getUserDisplayLocation(user)
  const age = getAgeFromDateOfBirth(user?.profile?.dateOfBirth)
  const verificationLabel = getIdentityVerificationLabel(user?.verification?.status)
  const preferredContactMethodLabel =
    contactMethodLabels[user?.profile?.preferredContactMethod] ?? 'Email'
  const verificationDocumentCount = Object.values(user?.verification?.documents ?? {}).filter(
    (document) => document?.uploadId,
  ).length
  const selectedProfileCountry = getCountryPhoneOption(profileForm.countryCode)
  const selectedProfileDialCode =
    selectedProfileCountry?.dialCode || String(profileForm.phoneDialCode ?? '').trim()
  const recentActivity = useMemo(
    () =>
      buildDashboardActivity({
        membershipRequests,
        messageThreads,
        orders,
        user,
      }),
    [membershipRequests, messageThreads, orders, user],
  )

  const updateProfileField = (field) => (event) => {
    setProfileForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
    setProfileError('')
  }

  const handleProfileCountryChange = (event) => {
    const nextCountry = getCountryPhoneOption(event.target.value)

    setProfileForm((current) => ({
      ...current,
      countryCode: nextCountry?.code ?? '',
      country: nextCountry?.name ?? '',
      phoneDialCode: nextCountry?.dialCode ?? '',
      phone: normalizeLocalPhoneNumber(current.phone, nextCountry?.dialCode ?? ''),
    }))
    setProfileError('')
  }

  const handleProfilePhoneChange = (event) => {
    setProfileForm((current) => ({
      ...current,
      phone: normalizeLocalPhoneNumber(event.target.value, current.phoneDialCode || selectedProfileDialCode),
    }))
    setProfileError('')
  }

  const handleProfileAvatarUpload = async (event) => {
    const input = event.target
    const file = input.files?.[0]

    if (!file || !user) {
      return
    }

    try {
      setProfileUploading(true)
      if (
        pendingAvatarUploadRef.current?.uploadId &&
        pendingAvatarUploadRef.current.storagePath !== user?.avatarStorage?.storagePath
      ) {
        await removeManagedUpload(pendingAvatarUploadRef.current)
      }

      const uploadedAvatar = await uploadProfileAvatarFile({
        file,
        ownerKey: user.authUserId || user.email || user.name || 'dashboard-profile',
      })
      pendingAvatarUploadRef.current = uploadedAvatar

      setProfileForm((current) => ({
        ...current,
        avatarUrl: uploadedAvatar.previewUrl || uploadedAvatar.publicUrl,
        avatarName: uploadedAvatar.fileName,
        avatarStorage: uploadedAvatar,
      }))
      setProfileError('')
    } catch (err) {
      setProfileError(err.message)
    } finally {
      setProfileUploading(false)
      input.value = ''
    }
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()

    if (!user) {
      return
    }

    if (!profileForm.name.trim()) {
      setProfileError('Please enter your full name before saving changes.')
      return
    }

    if (!profileForm.email.trim()) {
      setProfileError('Please enter your email address before saving changes.')
      return
    }

    if (!profileForm.countryCode || !selectedProfileCountry) {
      setProfileError('Please select your country so your phone number keeps the right calling code.')
      return
    }

    const formattedPhoneNumber = buildInternationalPhoneNumber({
      countryCode: selectedProfileCountry.code,
      dialCode: selectedProfileDialCode,
      localNumber: profileForm.phone,
    })

    if (!formattedPhoneNumber) {
      setProfileError('Please enter a phone number before saving your profile.')
      return
    }

    try {
      setProfileSubmitting(true)
      setProfileError('')
      const previousAvatarStorage = user.avatarStorage

      const updatedUser = await updateUserAccountService(user.id, {
        name: profileForm.name,
        email: profileForm.email,
        avatarUrl: profileForm.avatarUrl,
        avatarStorage: profileForm.avatarStorage,
        profile: {
          phone: formattedPhoneNumber,
          phoneDialCode: selectedProfileDialCode,
          country: selectedProfileCountry.name,
          countryCode: selectedProfileCountry.code,
          city: profileForm.city,
          occupation: profileForm.occupation,
          preferredContactMethod: profileForm.preferredContactMethod,
          favoriteTalent: profileForm.favoriteTalent,
          hobbies: profileForm.hobbies,
          interests: profileForm.interests,
          admirationReason: profileForm.admirationReason,
          bio: profileForm.bio,
        },
      })

      if (
        previousAvatarStorage?.uploadId &&
        profileForm.avatarStorage?.uploadId &&
        previousAvatarStorage.storagePath !== profileForm.avatarStorage.storagePath
      ) {
        await removeManagedUpload(previousAvatarStorage).catch(() => {})
      }

      pendingAvatarUploadRef.current = null
      setProfileForm(createProfileForm(updatedUser))
      showToast('Your account details have been updated.', 'success')
    } catch (err) {
      setProfileError(err.message)
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteAccountSubmitting) {
      return
    }

    const shouldDelete = window.confirm(
      'Delete your CrownPoint account? This removes your saved profile, event booking requests, orders, membership requests, and message history on this browser.',
    )

    if (!shouldDelete) {
      return
    }

    try {
      setDeleteAccountSubmitting(true)
      await deleteUserAccountService(user.id, { clearSession: false })
      clearCart()
      resetOrder()
      navigate('/', { replace: true })
      logout()
      showToast('Your account has been deleted.', 'success')
    } catch (error) {
      showToast(error.message || 'We could not delete your account right now.', 'warning')
    } finally {
      setDeleteAccountSubmitting(false)
    }
  }

  return (
    <PageWrapper className="cp-page--dashboard">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">My account</span>
            <h1 className="cp-page-title">
              Welcome back, <em>{user?.name ?? 'your account'}.</em>
            </h1>
            <p className="cp-page-intro">
              Track your requests, payments, memberships, and private access from one place.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container">
          <div className="cp-metric-grid">
            <motion.div className="cp-metric-card cp-surface" {...revealUp}>
              <strong>{orders.length}</strong>
              <span>Total orders</span>
            </motion.div>
            <motion.div className="cp-metric-card cp-surface" {...revealUp}>
              <strong>{activeOrders}</strong>
              <span>Orders in progress</span>
            </motion.div>
            <motion.div className="cp-metric-card cp-surface" {...revealUp}>
              <strong>{formatCurrency(totalSpend)}</strong>
              <span>Total spend across your account</span>
            </motion.div>
            <motion.div className="cp-metric-card cp-surface" {...revealUp}>
              <strong>{currentPlanLabel}</strong>
              <span>{getMembershipScopeCopy(user, unlockedCount)}</span>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 12 }}>
        <div className="cp-container">
          <div className="cp-dashboard-grid">
            <div className="cp-step-stack">
            <div className="cp-payment-tabs cp-payment-tabs--wrap">
              {DASHBOARD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`cp-tab-button${activeContentTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => setActiveContentTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeContentTab === 'orders' ? (
              <motion.article className="cp-order-table cp-surface" {...revealUp}>
                <div style={{ padding: '24px 24px 0' }}>
                  <span className="cp-eyebrow">Orders</span>
                  <h3 className="section-title" style={{ marginBottom: 8 }}>
                    Everything you need, <em>easy to follow.</em>
                  </h3>
                </div>

                <table className="cp-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Talent</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length ? orders.map((order) => (
                      <tr key={`${order.refCode}-${order.id}`}>
                        <td>
                          <strong>REF #{order.refCode}</strong>
                          <div>{getOrderTitle(order)}</div>
                        </td>
                        <td>
                          <strong>{getOrderTalentName(order)}</strong>
                          <div>{getOrderContextLabel(order)}</div>
                        </td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td>{formatCurrency(order.totalPrice)}</td>
                        <td>{getOrderEta(order)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5">
                          No orders have been submitted for this account yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </motion.article>
            ) : null}

            {activeContentTab === 'account' ? (
              <motion.article className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Account settings</span>
                <h3>Edit your profile whenever you need.</h3>
                <p className="cp-text-muted">
                  Update your profile photo, email, phone number, and personal details whenever something changes.
                </p>

                <form className="cp-form-grid cp-dashboard-editor" onSubmit={handleProfileSave}>
                  <div className="cp-field">
                    <label>Profile photo</label>
                    <div
                      className={`cp-upload-zone${profileForm.avatarUrl ? ' has-file' : ''}`}
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
                      {profileForm.avatarUrl ? (
                        <div className="cp-auth-upload-preview">
                          <img
                            alt="Selected profile preview"
                            className="cp-auth-upload-image"
                            src={profileForm.avatarUrl}
                          />
                          <div>
                            <p className="cp-upload-text">{profileForm.avatarName || 'Current profile photo'}</p>
                            <p className="cp-upload-subtext">
                              {profileUploading ? 'Preparing preview...' : 'Tap to choose a different photo'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="cp-upload-icon" size={22} />
                          <p className="cp-upload-text">
                            {profileUploading ? 'Preparing profile photo...' : 'Upload a profile photo from your device'}
                          </p>
                          <p className="cp-upload-subtext">PNG, JPG, or WEBP up to 2MB</p>
                        </div>
                      )}
                      <input
                        accept=".png,.jpg,.jpeg,.webp"
                        hidden
                        onChange={handleProfileAvatarUpload}
                        ref={avatarInputRef}
                        type="file"
                      />
                    </div>
                  </div>

                  <div className="cp-form-grid cp-form-grid--two">
                    <div className="cp-field">
                      <label htmlFor="dashboard-name">Full name</label>
                      <input
                        autoComplete="name"
                        id="dashboard-name"
                        onChange={updateProfileField('name')}
                        placeholder="Your full name"
                        required
                        value={profileForm.name}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-email">Email</label>
                      <input
                        autoComplete="email"
                        id="dashboard-email"
                        onChange={updateProfileField('email')}
                        placeholder="you@example.com"
                        required
                        type="email"
                        value={profileForm.email}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-country">Country</label>
                      <select
                        id="dashboard-country"
                        onChange={handleProfileCountryChange}
                        required
                        value={profileForm.countryCode}
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
                      <label htmlFor="dashboard-phone">Phone number</label>
                      <div className="cp-phone-field">
                        <span className={`cp-phone-prefix${selectedProfileDialCode ? ' is-active' : ''}`}>
                          {selectedProfileDialCode || 'Code'}
                        </span>
                        <input
                          autoComplete="tel-national"
                          id="dashboard-phone"
                          inputMode="numeric"
                          onChange={handleProfilePhoneChange}
                          placeholder={selectedProfileCountry ? '8012345678' : 'Select your country first'}
                          required
                          type="tel"
                          value={profileForm.phone}
                        />
                      </div>
                      <p className="cp-field-note">Your country code is added automatically when you save.</p>
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-contact-method">Preferred contact method</label>
                      <select
                        id="dashboard-contact-method"
                        onChange={updateProfileField('preferredContactMethod')}
                        value={profileForm.preferredContactMethod}
                      >
                        {editableContactMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-city">City</label>
                      <input
                        autoComplete="address-level2"
                        id="dashboard-city"
                        onChange={updateProfileField('city')}
                        placeholder="Your city"
                        value={profileForm.city}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-occupation">Occupation</label>
                      <input
                        id="dashboard-occupation"
                        onChange={updateProfileField('occupation')}
                        placeholder="Your occupation"
                        value={profileForm.occupation}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-favorite-talent">Favorite celebrity / talent</label>
                      <input
                        id="dashboard-favorite-talent"
                        onChange={updateProfileField('favoriteTalent')}
                        placeholder="Favorite celebrity or talent"
                        value={profileForm.favoriteTalent}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-hobbies">Hobbies</label>
                      <input
                        id="dashboard-hobbies"
                        onChange={updateProfileField('hobbies')}
                        placeholder="Travel, sports, movies..."
                        value={profileForm.hobbies}
                      />
                    </div>
                    <div className="cp-field">
                      <label htmlFor="dashboard-interests">Interests</label>
                      <input
                        id="dashboard-interests"
                        onChange={updateProfileField('interests')}
                        placeholder="Music, fashion, live shows..."
                        value={profileForm.interests}
                      />
                    </div>
                  </div>

                  <div className="cp-field">
                    <label htmlFor="dashboard-admiration-reason">What do you like about the celebrity?</label>
                    <textarea
                      id="dashboard-admiration-reason"
                      onChange={updateProfileField('admirationReason')}
                      placeholder="Share what draws you to them."
                      value={profileForm.admirationReason}
                    />
                  </div>

                  <div className="cp-field">
                    <label htmlFor="dashboard-bio">Short bio</label>
                    <textarea
                      id="dashboard-bio"
                      onChange={updateProfileField('bio')}
                      placeholder="Write a concise profile bio."
                      value={profileForm.bio}
                    />
                  </div>

                  {profileError ? <p className="cp-form-error">{profileError}</p> : null}

                  <div className="cp-dashboard-form-actions">
                    <button
                      className="cp-btn cp-btn--primary"
                      disabled={profileSubmitting || profileUploading}
                      type="submit"
                    >
                      {profileSubmitting
                        ? 'Saving changes...'
                        : profileUploading
                          ? 'Preparing photo...'
                          : 'Save profile changes'}
                    </button>
                    <button
                      className="cp-btn cp-btn--danger"
                      disabled={deleteAccountSubmitting || profileSubmitting || profileUploading}
                      onClick={handleDeleteAccount}
                      type="button"
                    >
                      <Trash2 size={14} />
                      {deleteAccountSubmitting ? 'Deleting account...' : 'Delete account'}
                    </button>
                  </div>
                </form>
              </motion.article>
            ) : null}

            {activeContentTab === 'activity' ? (
              <motion.article className="cp-info-card cp-surface" {...revealUp}>
                <span className="cp-eyebrow">Recent activity</span>
                <h3>Latest updates from your account.</h3>
                <div className="cp-step-stack" style={{ marginTop: 18 }}>
                  {recentActivity.length ? recentActivity.map((item) => (
                    <div key={item.id} className="cp-message-preview">
                      <div className="cp-message-preview-head">
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.timestamp)}</span>
                      </div>
                      {item.body}
                    </div>
                  )) : (
                    <div className="cp-message-preview">
                      No recent activity has been recorded on this account yet. As you place orders,
                      request membership, or start conversations, updates will appear here.
                    </div>
                  )}
                </div>
              </motion.article>
            ) : null}
            </div>

            <aside className="cp-sticky-stack">
              <motion.div className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
                <span className="cp-eyebrow">Account snapshot</span>
                {user ? (
                  <div className="cp-mobile-profile cp-mobile-profile--card">
                    <img
                      alt={`${user.name} profile`}
                      className="cp-profile-photo"
                      src={user.avatarUrl}
                    />
                    <div className="cp-profile-copy">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                ) : null}
                <h3>{currentPlanLabel}</h3>
                <p className="cp-text-muted">
                  See your membership, current orders, verification standing, and profile presence in one clear view.
                </p>

                <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                  <span className="cp-chip">
                    <Wallet size={14} />
                    {orders.length} tracked orders
                  </span>
                  <span className="cp-chip">
                    <Clock3 size={14} />
                    {getMembershipScopeCopy(user, unlockedCount)}
                  </span>
                  {userLocation ? <span className="cp-chip">{userLocation}</span> : null}
                  <span className="cp-chip">{verificationLabel}</span>
                </div>

                <div className="cp-card-actions">
                  <Link className="cp-btn cp-btn--ghost" to="/messages">
                    Open messages
                    <ArrowRight size={14} />
                  </Link>
                  <Link className="cp-btn cp-btn--primary" to="/membership">
                    Manage membership
                  </Link>
                </div>
              </motion.div>
            </aside>
          </div>

          <div className="cp-support-grid">
            <motion.div className="cp-info-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">Membership status</span>
              <h3>{currentPlanLabel}</h3>
              <ul className="cp-list">
                <li>{getMembershipScopeCopy(user, unlockedCount)}</li>
                <li>
                  {hasPlan && user?.planExpiry
                    ? `Active until ${formatDate(user.planExpiry)}${currentPlanBillingCycleLabel ? ` / ${currentPlanBillingCycleLabel} billing` : ''}`
                    : 'Upgrade to Inner Circle or Crown Access to unlock talent messages.'}
                </li>
                <li>
                  {latestMembershipRequest
                    ? `Latest request: ${getMembershipSelectionLabel(latestMembershipRequest.plan, latestMembershipRequest.billingCycle)} / ${latestMembershipRequest.status.toLowerCase().replaceAll('_', ' ')}`
                    : 'No membership request has been submitted yet.'}
                </li>
                {latestMembershipRequest ? (
                  <li>
                    {formatCurrency(latestMembershipRequest.amountUsd, latestMembershipRequest.currencyCode)} / {getBillingCycleLabel(latestMembershipRequest.billingCycle) || 'Monthly'} billing
                  </li>
                ) : null}
              </ul>
              <span className="cp-chip">
                <MessageSquareText size={14} />
                Private messaging access
              </span>
            </motion.div>

            <motion.div className="cp-info-card cp-surface" {...revealUp}>
              <span className="cp-eyebrow">Profile dossier</span>
              <h3>{user?.profile?.bio ? 'A stronger fan profile is now on file.' : 'Finish shaping your profile voice.'}</h3>
              {user?.profile?.bio ? (
                <p className="cp-text-muted">{user.profile.bio}</p>
              ) : (
                <p className="cp-text-muted">
                  Your account now supports bios, interests, hobbies, and identity verification details.
                </p>
              )}
              <ul className="cp-list">
                <li>{user?.profile?.phone ? `Phone: ${user.profile.phone}` : 'Phone number not added yet.'}</li>
                <li>
                  Preferred contact: {preferredContactMethodLabel}
                  {userLocation ? ` / ${userLocation}` : ''}
                </li>
                <li>
                  {age ? `Age verified at ${age}+ / ${verificationLabel}` : `Verification status: ${verificationLabel}`}
                </li>
                <li>
                  {user?.profile?.favoriteTalent
                    ? `Favorite talent: ${user.profile.favoriteTalent}`
                    : 'Favorite talent not added yet.'}
                </li>
                <li>
                  {user?.profile?.occupation
                    ? `Occupation: ${user.profile.occupation}`
                    : 'Occupation not added yet.'}
                </li>
                <li>
                  {user?.createdAt
                    ? `Joined CrownPoint on ${formatDate(user.createdAt)}`
                    : 'Join date will appear here once available.'}
                </li>
                <li>
                  {verificationDocumentCount
                    ? `${verificationDocumentCount} verification document${verificationDocumentCount === 1 ? '' : 's'} are on file.`
                    : 'Verification documents have not been uploaded yet.'}
                </li>
              </ul>
              {user?.profile?.admirationReason ? (
                <div className="cp-message-preview" style={{ marginTop: 18 }}>
                  <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                    What you like about the celebrity
                  </strong>
                  {user.profile.admirationReason}
                </div>
              ) : null}
              {(user?.profile?.hobbies || user?.profile?.interests) ? (
                <div className="cp-message-preview" style={{ marginTop: 18 }}>
                  <strong style={{ color: 'var(--white)', display: 'block', marginBottom: 8 }}>
                    Hobbies and interests
                  </strong>
                  {[user?.profile?.hobbies, user?.profile?.interests].filter(Boolean).join(' / ')}
                </div>
              ) : null}
              <span className="cp-chip">
                <UserRound size={14} />
                Verified profile and preferences
              </span>
            </motion.div>
          </div>
        </div>
      </section>
    </PageWrapper>
  )
}
