import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const API_BASE_URL = process.env.CROWNPOINT_API_BASE_URL || 'http://127.0.0.1:3001/api'
const HEALTH_URL = `${API_BASE_URL}/health`
const PAYMENT_PROOFS_BUCKET = 'payment-proofs'
const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments'
const PROFILE_AVATARS_BUCKET = 'profile-avatars'
const VERIFICATION_DOCUMENTS_BUCKET = 'verification-documents'

const trimText = (value) => String(value ?? '').trim()

const requireEnv = (name, fallback = '') => {
  const value = trimText(process.env[name] ?? fallback)

  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local before running this workflow test.`)
  }

  return value
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL', process.env.SUPABASE_URL)
const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const adminEmail = requireEnv('SUPABASE_ADMIN_EMAIL').toLowerCase()
const adminPassword = requireEnv('SUPABASE_ADMIN_PASSWORD')

const createSupabaseClient = (key) =>
  createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

const serviceClient = createSupabaseClient(supabaseServiceRoleKey)
const adminClient = createSupabaseClient(supabaseAnonKey)
const fanClient = createSupabaseClient(supabaseAnonKey)

const fetchJson = async (url, { token = '', headers = {}, ...options } = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  let body = null

  try {
    body = await response.json()
  } catch {
    body = null
  }

  return { response, body }
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const assertStatus = (response, expectedStatus, label) => {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned ${response.status}, expected ${expectedStatus}.`)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (
  producer,
  predicate,
  label,
  { timeoutMs = 15_000, intervalMs = 400 } = {},
) => {
  const startedAt = Date.now()
  let lastValue = null

  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await producer()

    if (predicate(lastValue)) {
      return lastValue
    }

    await sleep(intervalMs)
  }

  throw new Error(`Timed out while waiting for ${label}.`)
}

const ensureApiReady = async () => {
  const { response, body } = await fetchJson(HEALTH_URL)
  assertStatus(response, 200, 'Backend health check')
  assert(body?.status === 'ok', 'Backend health check did not report ok.')
  return body
}

const makeTextBlob = (text, mimeType) => new Blob([text], { type: mimeType })

const uploadStorageObject = async ({
  client,
  bucket,
  fileName,
  mimeType,
  pathSegments,
  text,
}) => {
  const uploadId = randomUUID()
  const storagePath = [...pathSegments, `${uploadId}-${fileName}`].join('/')
  const blob = makeTextBlob(text, mimeType)
  const { error } = await client.storage.from(bucket).upload(storagePath, blob, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  })

  if (error) {
    throw new Error(`Storage upload failed for ${bucket}/${storagePath}: ${error.message}`)
  }

  return {
    uploadId,
    bucket,
    storagePath,
    fileName,
    mimeType,
    size: blob.size,
    uploadedAt: new Date().toISOString(),
  }
}

const buildMessageAttachmentMetadata = (upload, kind) => ({
  id: upload.uploadId,
  uploadId: upload.uploadId,
  name: upload.fileName,
  fileName: upload.fileName,
  mimeType: upload.mimeType,
  size: upload.size,
  kind,
  bucket: upload.bucket,
  storagePath: upload.storagePath,
  createdAt: upload.uploadedAt,
})

const downloadStorageObject = async (client, bucket, storagePath, label) => {
  const { data, error } = await client.storage.from(bucket).download(storagePath)

  if (error) {
    throw new Error(`${label} download failed: ${error.message}`)
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  assert(buffer.length > 0, `${label} download returned an empty file.`)
  return buffer.length
}

const getPublicStorageUrl = (client, bucket, storagePath) =>
  trimText(client.storage.from(bucket).getPublicUrl(storagePath).data?.publicUrl)

const expectStorageObjectMissing = async (bucket, storagePath, label) => {
  const { data, error } = await serviceClient.storage.from(bucket).download(storagePath)

  if (!error && data) {
    throw new Error(`${label} still exists after cleanup.`)
  }
}

const readExactCount = async (table, column, value) => {
  const { count, error } = await serviceClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value)

  if (error) {
    throw new Error(`Count query failed for ${table}: ${error.message}`)
  }

  return Number(count ?? 0) || 0
}

const getAuthUserById = async (userId) => {
  const { data, error } = await serviceClient.auth.admin.getUserById(userId)

  if (error) {
    return null
  }

  return data?.user ?? null
}

const cleanupResidualData = async (fanAuthUserId, uploads = []) => {
  if (fanAuthUserId) {
    await Promise.all([
      serviceClient.from('thread_messages').delete().in(
        'thread_id',
        (
          await serviceClient
            .from('message_threads')
            .select('id')
            .eq('fan_auth_user_id', fanAuthUserId)
        ).data?.map((row) => row.id) ?? [],
      ),
      serviceClient.from('message_threads').delete().eq('fan_auth_user_id', fanAuthUserId),
      serviceClient.from('event_booking_requests').delete().eq('auth_user_id', fanAuthUserId),
      serviceClient.from('orders').delete().eq('auth_user_id', fanAuthUserId),
      serviceClient.from('membership_requests').delete().eq('auth_user_id', fanAuthUserId),
      serviceClient.from('user_profiles').delete().eq('id', fanAuthUserId),
    ]).catch(() => {})

    await serviceClient.auth.admin.deleteUser(fanAuthUserId).catch(() => {})
  }

  const uploadsByBucket = new Map()

  uploads
    .filter((upload) => upload?.bucket && upload?.storagePath)
    .forEach((upload) => {
      const nextPaths = uploadsByBucket.get(upload.bucket) ?? new Set()
      nextPaths.add(upload.storagePath)
      uploadsByBucket.set(upload.bucket, nextPaths)
    })

  for (const [bucket, storagePaths] of uploadsByBucket.entries()) {
    await serviceClient.storage.from(bucket).remove([...storagePaths]).catch(() => {})
  }
}

const run = async () => {
  const health = await ensureApiReady()
  const uniqueSuffix = Date.now().toString(36)
  const fanEmail = `backend-smoke+${uniqueSuffix}@example.com`
  const fanPassword = `SmokeTest!${randomUUID().slice(0, 12)}`
  const fanName = 'Backend Workflow Smoke'
  const summary = {
    health,
    fanEmail,
    steps: [],
  }
  let fanAuthUserId = ''
  let fanToken = ''
  let adminToken = ''
  const createdUploads = []
  let originalUsdPaymentSettingsRecord = null

  const restorePaymentSettings = async () => {
    if (!adminToken || !originalUsdPaymentSettingsRecord?.settings) {
      return
    }

    await fetchJson(`${API_BASE_URL}/payment-settings/USD`, {
      method: 'PUT',
      token: adminToken,
      body: JSON.stringify({
        settings: originalUsdPaymentSettingsRecord.settings,
        updatedByName: originalUsdPaymentSettingsRecord.updatedBy || 'Backend workflow restore',
      }),
    }).catch(() => {})
  }

  try {
    const { data: adminSessionData, error: adminSessionError } =
      await adminClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      })

    if (adminSessionError || !adminSessionData?.session?.access_token) {
      throw new Error(
        `Admin sign-in failed for the workflow test: ${adminSessionError?.message || 'No session returned.'}`,
      )
    }

    adminToken = adminSessionData.session.access_token
    summary.steps.push('admin-sign-in')

    const { data: createdFanUser, error: createdFanUserError } =
      await serviceClient.auth.admin.createUser({
        email: fanEmail,
        password: fanPassword,
        email_confirm: true,
        user_metadata: {
          name: fanName,
        },
      })

    if (createdFanUserError || !createdFanUser?.user?.id) {
      throw new Error(
        `Fan user creation failed for the workflow test: ${createdFanUserError?.message || 'No user id returned.'}`,
      )
    }

    fanAuthUserId = createdFanUser.user.id
    summary.steps.push('fan-create')

    const fanProfile = await waitFor(
      async () => {
        const { data, error } = await serviceClient
          .from('user_profiles')
          .select('*')
          .eq('id', fanAuthUserId)
          .maybeSingle()

        if (error) {
          throw new Error(`Fan profile lookup failed: ${error.message}`)
        }

        return data
      },
      Boolean,
      'fan profile sync',
    )

    assert(
      trimText(fanProfile.email).toLowerCase() === fanEmail,
      'Fan profile email did not sync from auth.',
    )
    summary.steps.push('fan-profile-sync')

    const { data: fanSessionData, error: fanSessionError } =
      await fanClient.auth.signInWithPassword({
        email: fanEmail,
        password: fanPassword,
      })

    if (fanSessionError || !fanSessionData?.session?.access_token) {
      throw new Error(
        `Fan sign-in failed for the workflow test: ${fanSessionError?.message || 'No session returned.'}`,
      )
    }

    fanToken = fanSessionData.session.access_token
    summary.steps.push('fan-sign-in')

    const { response: paymentSettingsResponse, body: paymentSettingsBody } = await fetchJson(
      `${API_BASE_URL}/payment-settings`,
    )
    assertStatus(paymentSettingsResponse, 200, 'Payment settings list')
    assert(
      Array.isArray(paymentSettingsBody) &&
        paymentSettingsBody.some((record) => trimText(record?.currencyCode) === 'USD'),
      'Payment settings list did not include USD settings.',
    )
    originalUsdPaymentSettingsRecord =
      paymentSettingsBody.find((record) => trimText(record?.currencyCode) === 'USD') ?? null
    assert(originalUsdPaymentSettingsRecord?.settings, 'USD payment settings were not returned.')
    summary.steps.push('payment-settings-read')

    const updatedUsdPaymentSettings = {
      ...originalUsdPaymentSettingsRecord.settings,
      bank: {
        ...originalUsdPaymentSettingsRecord.settings.bank,
        instructions: `Workflow test instructions ${uniqueSuffix}`,
      },
    }
    const { response: paymentSettingsUpdateResponse, body: paymentSettingsUpdateBody } =
      await fetchJson(`${API_BASE_URL}/payment-settings/USD`, {
        method: 'PUT',
        token: adminToken,
        body: JSON.stringify({
          settings: updatedUsdPaymentSettings,
          updatedByName: 'Backend workflow test',
        }),
      })
    assertStatus(paymentSettingsUpdateResponse, 200, 'Payment settings update')
    assert(
      trimText(paymentSettingsUpdateBody?.settings?.bank?.instructions) ===
        updatedUsdPaymentSettings.bank.instructions,
      'Payment settings update did not persist the new bank instructions.',
    )
    await restorePaymentSettings()
    summary.steps.push('payment-settings-write')

    const avatarUpload = await uploadStorageObject({
      client: fanClient,
      bucket: PROFILE_AVATARS_BUCKET,
      fileName: 'profile-avatar.png',
      mimeType: 'image/png',
      pathSegments: [fanAuthUserId, 'avatars'],
      text: 'profile avatar backend workflow test',
    })
    const verificationUpload = await uploadStorageObject({
      client: fanClient,
      bucket: VERIFICATION_DOCUMENTS_BUCKET,
      fileName: 'verification-id-front.png',
      mimeType: 'image/png',
      pathSegments: [fanAuthUserId, 'verification', 'id-front'],
      text: 'verification document backend workflow test',
    })
    createdUploads.push(avatarUpload, verificationUpload)

    const avatarPublicUrl = getPublicStorageUrl(
      fanClient,
      PROFILE_AVATARS_BUCKET,
      avatarUpload.storagePath,
    )
    assert(avatarPublicUrl, 'Profile avatar upload did not return a public URL.')

    const { data: profileBeforeMediaUpdate, error: profileBeforeMediaUpdateError } =
      await fanClient
        .from('user_profiles')
        .select('verification')
        .eq('id', fanAuthUserId)
        .single()

    if (profileBeforeMediaUpdateError) {
      throw new Error(
        `Profile media preflight lookup failed: ${profileBeforeMediaUpdateError.message}`,
      )
    }

    const verificationSubmittedAt = new Date().toISOString()
    const nextVerification = {
      ...(profileBeforeMediaUpdate?.verification ?? {}),
      status: 'PENDING_REVIEW',
      submittedAt: verificationSubmittedAt,
      ageVerifiedAt: verificationSubmittedAt,
      isAdultVerified: true,
      documents: {
        ...(profileBeforeMediaUpdate?.verification?.documents ?? {}),
        idFront: verificationUpload,
      },
    }
    const { data: updatedProfileWithMedia, error: updatedProfileWithMediaError } =
      await fanClient
        .from('user_profiles')
        .update({
          avatar_url: avatarPublicUrl,
          avatar_storage: avatarUpload,
          verification: nextVerification,
        })
        .eq('id', fanAuthUserId)
        .select('avatar_url, avatar_storage, verification')
        .single()

    if (updatedProfileWithMediaError) {
      throw new Error(
        `Profile media update failed: ${updatedProfileWithMediaError.message}`,
      )
    }

    assert(
      trimText(updatedProfileWithMedia?.avatar_storage?.storagePath) === avatarUpload.storagePath,
      'Profile avatar storage metadata did not persist.',
    )
    assert(
      trimText(updatedProfileWithMedia?.verification?.documents?.idFront?.storagePath) ===
        verificationUpload.storagePath,
      'Verification document metadata did not persist.',
    )

    await downloadStorageObject(
      fanClient,
      PROFILE_AVATARS_BUCKET,
      avatarUpload.storagePath,
      'Fan profile avatar',
    )
    await downloadStorageObject(
      fanClient,
      VERIFICATION_DOCUMENTS_BUCKET,
      verificationUpload.storagePath,
      'Fan verification document',
    )
    await downloadStorageObject(
      adminClient,
      VERIFICATION_DOCUMENTS_BUCKET,
      verificationUpload.storagePath,
      'Admin verification document',
    )
    summary.steps.push('profile-storage-verify')

    const { response: talentResponse, body: talentBody } = await fetchJson(`${API_BASE_URL}/talents`)
    assertStatus(talentResponse, 200, 'Talent list')
    assert(Array.isArray(talentBody) && talentBody.length > 0, 'Talent list returned no records.')

    const bookingTalent = talentBody.find((talent) => talent?.eventBooking?.available)
    assert(bookingTalent, 'No event-bookable talent is available for the workflow test.')
    summary.talentId = bookingTalent.id
    summary.talentName = bookingTalent.name
    summary.steps.push('talent-read')

    const membershipProofUpload = await uploadStorageObject({
      client: fanClient,
      bucket: PAYMENT_PROOFS_BUCKET,
      fileName: 'membership-proof.pdf',
      mimeType: 'application/pdf',
      pathSegments: [fanAuthUserId, 'membership'],
      text: '%PDF-1.4 membership proof backend workflow test',
    })
    createdUploads.push(membershipProofUpload)

    const { response: membershipResponse, body: membershipBody } = await fetchJson(
      `${API_BASE_URL}/membership-requests`,
      {
        method: 'POST',
        token: fanToken,
        body: JSON.stringify({
          plan: 'INNER_CIRCLE',
          billingCycle: 'MONTHLY',
          talentId: bookingTalent.id,
          paymentMethod: 'BANK_TRANSFER',
          proofSummary: 'Manual transfer receipt uploaded for backend workflow verification.',
          proofFileName: membershipProofUpload.fileName,
          proofUpload: membershipProofUpload,
          currencyCode: 'USD',
          region: 'United States',
        }),
      },
    )
    assertStatus(membershipResponse, 201, 'Membership submit')
    assert(Number(membershipBody?.id) > 0, 'Membership submit did not return an id.')
    summary.membershipRequestId = membershipBody.id
    summary.steps.push('membership-submit')

    const { response: adminMembershipListResponse, body: adminMembershipListBody } = await fetchJson(
      `${API_BASE_URL}/membership-requests`,
      {
        method: 'GET',
        token: adminToken,
      },
    )
    assertStatus(adminMembershipListResponse, 200, 'Admin membership list')
    assert(
      Array.isArray(adminMembershipListBody) &&
        adminMembershipListBody.some((item) => Number(item.id) === Number(membershipBody.id)),
      'Admin membership list did not include the new membership request.',
    )
    summary.steps.push('membership-admin-list')

    const { response: membershipReviewResponse, body: membershipReviewBody } = await fetchJson(
      `${API_BASE_URL}/membership-requests/${membershipBody.id}`,
      {
        method: 'PATCH',
        token: adminToken,
        body: JSON.stringify({
          status: 'APPROVED',
        }),
      },
    )
    assertStatus(membershipReviewResponse, 200, 'Membership approval')
    assert(
      trimText(membershipReviewBody?.status) === 'APPROVED',
      'Membership approval did not persist APPROVED status.',
    )
    summary.steps.push('membership-approve')

    const updatedProfile = await waitFor(
      async () => {
        const { data, error } = await serviceClient
          .from('user_profiles')
          .select('plan, plan_billing_cycle, talents_unlocked')
          .eq('id', fanAuthUserId)
          .maybeSingle()

        if (error) {
          throw new Error(`Updated profile lookup failed: ${error.message}`)
        }

        return data
      },
      (profile) =>
        trimText(profile?.plan) === 'INNER_CIRCLE' &&
        trimText(profile?.plan_billing_cycle) === 'MONTHLY' &&
        Array.isArray(profile?.talents_unlocked) &&
        profile.talents_unlocked.some((talentId) => Number(talentId) === Number(bookingTalent.id)),
      'membership activation profile sync',
    )
    summary.updatedPlan = updatedProfile.plan
    summary.steps.push('membership-profile-verify')

    const orderProofUpload = await uploadStorageObject({
      client: fanClient,
      bucket: PAYMENT_PROOFS_BUCKET,
      fileName: 'order-proof.pdf',
      mimeType: 'application/pdf',
      pathSegments: [fanAuthUserId, 'orders'],
      text: '%PDF-1.4 order proof backend workflow test',
    })
    createdUploads.push(orderProofUpload)

    const orderRefCode = `WF${uniqueSuffix.slice(-6).toUpperCase()}`
    const orderTotal = 799
    const orderPayload = {
      refCode: orderRefCode,
      orderType: 'SERVICE',
      talentId: bookingTalent.id,
      talentName: bookingTalent.name,
      service: 'Private Live Call',
      totalPrice: orderTotal,
      items: [
        {
          id: `item-${uniqueSuffix}`,
          label: 'Private Live Call',
          quantity: 1,
          unitPrice: orderTotal,
          totalPrice: orderTotal,
        },
      ],
      paymentMethod: 'BANK_TRANSFER',
      paymentProof: 'BANK-REF-7654321',
      paymentProofFileName: orderProofUpload.fileName,
      proofUpload: orderProofUpload,
      proofSummary: 'Wire transfer confirmation uploaded for backend workflow verification.',
      requestedFor: 'Backend workflow test order',
      note: 'Backend workflow verification order.',
      fanName,
      email: fanEmail,
      contact: {
        fullName: fanName,
        email: fanEmail,
        phone: '+1 202 555 0198',
      },
      shippingAddress: {
        line1: '100 Backend Ave',
        line2: '',
        city: 'Austin',
        state: 'TX',
        postalCode: '73301',
        country: 'United States',
      },
    }

    const { response: orderResponse, body: orderBody } = await fetchJson(`${API_BASE_URL}/orders`, {
      method: 'POST',
      token: fanToken,
      body: JSON.stringify(orderPayload),
    })
    assertStatus(orderResponse, 201, 'Order submit')
    assert(trimText(orderBody?.refCode) === orderRefCode, 'Order submit did not persist the ref code.')
    summary.orderId = orderBody.id
    summary.orderRefCode = orderBody.refCode
    summary.steps.push('order-submit')

    await downloadStorageObject(
      fanClient,
      PAYMENT_PROOFS_BUCKET,
      orderProofUpload.storagePath,
      'Fan payment proof',
    )
    await downloadStorageObject(
      adminClient,
      PAYMENT_PROOFS_BUCKET,
      orderProofUpload.storagePath,
      'Admin payment proof',
    )
    summary.steps.push('order-proof-download')

    const { response: fanOrdersResponse, body: fanOrdersBody } = await fetchJson(
      `${API_BASE_URL}/orders`,
      {
        method: 'GET',
        token: fanToken,
      },
    )
    assertStatus(fanOrdersResponse, 200, 'Fan order list')
    assert(
      Array.isArray(fanOrdersBody) &&
        fanOrdersBody.some((order) => trimText(order.refCode) === orderRefCode),
      'Fan order list did not include the new order.',
    )

    const { response: orderLookupResponse, body: orderLookupBody } = await fetchJson(
      `${API_BASE_URL}/orders/ref/${orderRefCode}`,
      {
        method: 'GET',
        token: fanToken,
      },
    )
    assertStatus(orderLookupResponse, 200, 'Fan order lookup')
    assert(
      trimText(orderLookupBody?.refCode) === orderRefCode,
      'Fan order lookup returned the wrong order.',
    )
    summary.steps.push('order-read')

    const { response: adminOrdersResponse, body: adminOrdersBody } = await fetchJson(
      `${API_BASE_URL}/orders`,
      {
        method: 'GET',
        token: adminToken,
      },
    )
    assertStatus(adminOrdersResponse, 200, 'Admin order list')
    assert(
      Array.isArray(adminOrdersBody) &&
        adminOrdersBody.some((order) => Number(order.id) === Number(orderBody.id)),
      'Admin order list did not include the new order.',
    )

    const { response: orderReviewResponse, body: orderReviewBody } = await fetchJson(
      `${API_BASE_URL}/orders/${orderBody.id}`,
      {
        method: 'PATCH',
        token: adminToken,
        body: JSON.stringify({
          status: 'PAID',
        }),
      },
    )
    assertStatus(orderReviewResponse, 200, 'Order approval')
    assert(trimText(orderReviewBody?.status) === 'PAID', 'Order review did not persist PAID status.')
    summary.steps.push('order-approve')

    const eventDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const { response: bookingResponse, body: bookingBody } = await fetchJson(
      `${API_BASE_URL}/event-bookings`,
      {
        method: 'POST',
        token: fanToken,
        body: JSON.stringify({
          talentId: bookingTalent.id,
          talentName: bookingTalent.name,
          celebrityName: bookingTalent.name,
          eventDate,
          approximateBudget: '$25,000 - $40,000',
          eventType: 'Brand launch appearance',
          eventLocation: 'Houston, Texas',
          additionalInfo: 'Backend workflow verification booking request.',
          fullName: fanName,
          organizationName: 'Workflow QA',
          jobTitle: 'Producer',
          phoneNumber: '+1 202 555 0182',
          emailAddress: fanEmail,
          fullAddress: '200 Backend Ave, Houston, TX 77001',
          nearestAirport: 'IAH',
        }),
      },
    )
    assertStatus(bookingResponse, 201, 'Event booking submit')
    assert(Number(bookingBody?.id) > 0, 'Event booking submit did not return an id.')
    summary.eventBookingId = bookingBody.id
    summary.steps.push('event-booking-submit')

    const { response: adminBookingListResponse, body: adminBookingListBody } = await fetchJson(
      `${API_BASE_URL}/event-bookings`,
      {
        method: 'GET',
        token: adminToken,
      },
    )
    assertStatus(adminBookingListResponse, 200, 'Admin event booking list')
    assert(
      Array.isArray(adminBookingListBody) &&
        adminBookingListBody.some((item) => Number(item.id) === Number(bookingBody.id)),
      'Admin event booking list did not include the new booking request.',
    )

    const { response: bookingReviewResponse, body: bookingReviewBody } = await fetchJson(
      `${API_BASE_URL}/event-bookings/${bookingBody.id}`,
      {
        method: 'PATCH',
        token: adminToken,
        body: JSON.stringify({
          status: 'IN_TOUCH',
        }),
      },
    )
    assertStatus(bookingReviewResponse, 200, 'Event booking review')
    assert(
      trimText(bookingReviewBody?.status) === 'IN_TOUCH',
      'Event booking review did not persist IN_TOUCH status.',
    )
    summary.steps.push('event-booking-review')

    const { response: fanBookingListResponse, body: fanBookingListBody } = await fetchJson(
      `${API_BASE_URL}/event-bookings`,
      {
        method: 'GET',
        token: fanToken,
      },
    )
    assertStatus(fanBookingListResponse, 200, 'Fan event booking list')
    const reviewedBooking = Array.isArray(fanBookingListBody)
      ? fanBookingListBody.find((item) => Number(item.id) === Number(bookingBody.id))
      : null
    assert(
      trimText(reviewedBooking?.status) === 'IN_TOUCH',
      'Fan event booking list did not reflect the reviewed booking status.',
    )
    summary.steps.push('event-booking-read')

    const { response: fanThreadsResponse, body: fanThreadsBody } = await fetchJson(
      `${API_BASE_URL}/message-threads`,
      {
        method: 'GET',
        token: fanToken,
      },
    )
    assertStatus(fanThreadsResponse, 200, 'Fan thread list')
    assert(Array.isArray(fanThreadsBody), 'Fan thread list did not return an array.')
    const targetThread = fanThreadsBody.find(
      (thread) => Number(thread.talentId) === Number(bookingTalent.id),
    )
    assert(targetThread, 'Fan thread list did not create a thread for the unlocked talent.')
    assert(
      Array.isArray(targetThread.messages) && targetThread.messages.length >= 2,
      'Fan thread did not include welcome messages.',
    )
    summary.threadId = targetThread.backendThreadId
    summary.steps.push('message-thread-bootstrap')

    const messageAttachmentUpload = await uploadStorageObject({
      client: fanClient,
      bucket: MESSAGE_ATTACHMENTS_BUCKET,
      fileName: 'fan-note.pdf',
      mimeType: 'application/pdf',
      pathSegments: [String(targetThread.backendThreadId)],
      text: '%PDF-1.4 fan message attachment backend workflow test',
    })
    createdUploads.push(messageAttachmentUpload)

    const fanAttachmentMetadata = buildMessageAttachmentMetadata(messageAttachmentUpload, 'pdf')
    const { response: fanMessageResponse, body: fanMessageBody } = await fetchJson(
      `${API_BASE_URL}/message-threads/${targetThread.backendThreadId}/messages`,
      {
        method: 'POST',
        token: fanToken,
        body: JSON.stringify({
          senderRole: 'fan',
          senderLabel: fanName,
          text: 'Backend workflow fan message with attachment.',
          attachments: [fanAttachmentMetadata],
        }),
      },
    )
    assertStatus(fanMessageResponse, 200, 'Fan message send')
    const latestFanMessage = fanMessageBody?.messages?.[fanMessageBody.messages.length - 1] ?? null
    assert(
      trimText(latestFanMessage?.senderRole) === 'fan' &&
        Array.isArray(latestFanMessage?.attachments) &&
        latestFanMessage.attachments.length === 1,
      'Fan message send did not persist the attachment correctly.',
    )
    summary.steps.push('message-send-fan')

    await downloadStorageObject(
      fanClient,
      MESSAGE_ATTACHMENTS_BUCKET,
      messageAttachmentUpload.storagePath,
      'Fan message attachment',
    )
    await downloadStorageObject(
      adminClient,
      MESSAGE_ATTACHMENTS_BUCKET,
      messageAttachmentUpload.storagePath,
      'Admin message attachment',
    )
    summary.steps.push('message-attachment-download')

    const { response: adminThreadsResponse, body: adminThreadsBody } = await fetchJson(
      `${API_BASE_URL}/message-threads?talentId=${bookingTalent.id}`,
      {
        method: 'GET',
        token: adminToken,
      },
    )
    assertStatus(adminThreadsResponse, 200, 'Admin thread list')
    assert(
      Array.isArray(adminThreadsBody) &&
        adminThreadsBody.some(
          (thread) => Number(thread.backendThreadId) === Number(targetThread.backendThreadId),
        ),
      'Admin thread list did not include the fan thread.',
    )

    const { response: adminMessageResponse, body: adminMessageBody } = await fetchJson(
      `${API_BASE_URL}/message-threads/${targetThread.backendThreadId}/messages`,
      {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({
          senderRole: 'talent',
          senderLabel: bookingTalent.name,
          text: 'Backend workflow admin reply.',
          attachments: [],
        }),
      },
    )
    assertStatus(adminMessageResponse, 200, 'Admin message send')
    const latestAdminMessage =
      adminMessageBody?.messages?.[adminMessageBody.messages.length - 1] ?? null
    assert(
      trimText(latestAdminMessage?.senderRole) === 'talent',
      'Admin message send did not persist the reply correctly.',
    )
    summary.steps.push('message-send-admin')

    const { response: deleteResponse, body: deleteBody } = await fetchJson(
      `${API_BASE_URL}/users/me`,
      {
        method: 'DELETE',
        token: fanToken,
      },
    )
    assertStatus(deleteResponse, 200, 'Fan account delete')
    assert(
      Number(deleteBody?.removedMembershipCount ?? 0) >= 1,
      'Account delete did not remove the membership request.',
    )
    assert(
      Number(deleteBody?.removedOrderCount ?? 0) >= 1,
      'Account delete did not remove the order.',
    )
    assert(
      Number(deleteBody?.removedEventBookingCount ?? 0) >= 1,
      'Account delete did not remove the event booking request.',
    )
    assert(
      Number(deleteBody?.removedThreadCount ?? 0) >= 1,
      'Account delete did not remove the message thread.',
    )
    summary.steps.push('account-delete')

    const authUserAfterDelete = await getAuthUserById(fanAuthUserId)
    assert(!authUserAfterDelete, 'Fan auth user still exists after account deletion.')

    const profileCount = await readExactCount('user_profiles', 'id', fanAuthUserId)
    const membershipCount = await readExactCount('membership_requests', 'auth_user_id', fanAuthUserId)
    const orderCount = await readExactCount('orders', 'auth_user_id', fanAuthUserId)
    const bookingCount = await readExactCount('event_booking_requests', 'auth_user_id', fanAuthUserId)
    const threadCount = await readExactCount('message_threads', 'fan_auth_user_id', fanAuthUserId)

    assert(profileCount === 0, 'User profile still exists after account deletion.')
    assert(membershipCount === 0, 'Membership requests still exist after account deletion.')
    assert(orderCount === 0, 'Orders still exist after account deletion.')
    assert(bookingCount === 0, 'Event booking requests still exist after account deletion.')
    assert(threadCount === 0, 'Message threads still exist after account deletion.')

    await expectStorageObjectMissing(
      PAYMENT_PROOFS_BUCKET,
      membershipProofUpload.storagePath,
      'Membership proof upload',
    )
    await expectStorageObjectMissing(
      PROFILE_AVATARS_BUCKET,
      avatarUpload.storagePath,
      'Profile avatar upload',
    )
    await expectStorageObjectMissing(
      PAYMENT_PROOFS_BUCKET,
      orderProofUpload.storagePath,
      'Order proof upload',
    )
    await expectStorageObjectMissing(
      VERIFICATION_DOCUMENTS_BUCKET,
      verificationUpload.storagePath,
      'Verification document upload',
    )
    await expectStorageObjectMissing(
      MESSAGE_ATTACHMENTS_BUCKET,
      messageAttachmentUpload.storagePath,
      'Message attachment upload',
    )
    summary.steps.push('cleanup-verify')

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          summary,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    await restorePaymentSettings()
    await adminClient.auth.signOut().catch(() => {})
    await fanClient.auth.signOut().catch(() => {})
    await cleanupResidualData(fanAuthUserId, createdUploads)
  }
}

run().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
