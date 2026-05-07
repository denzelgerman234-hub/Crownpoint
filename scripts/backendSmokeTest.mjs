const API_BASE_URL = process.env.CROWNPOINT_API_BASE_URL || 'http://127.0.0.1:3001/api'
const HEALTH_URL = `${API_BASE_URL}/health`

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  let body = null

  try {
    body = await response.json()
  } catch {
    body = null
  }

  return {
    body,
    response,
  }
}

const ensureApiReady = async () => {
  try {
    const { response, body } = await fetchJson(HEALTH_URL)

    if (response.ok && body?.status === 'ok') {
      return { health: body }
    }
  } catch (error) {
    throw new Error(
      `Could not reach the backend smoke target at ${HEALTH_URL}. Start the API with \`npm run api\` and try again.`,
    )
  }

  throw new Error(
    `The backend health check at ${HEALTH_URL} did not return a healthy response. Start the API with \`npm run api\` and try again.`,
  )
}

const assertStatus = (actualStatus, expectedStatus, label) => {
  if (actualStatus !== expectedStatus) {
    throw new Error(`${label} returned ${actualStatus}, expected ${expectedStatus}.`)
  }
}

const run = async () => {
  const { health } = await ensureApiReady()
  const checks = [
    {
      label: 'Membership GET without auth',
      method: 'GET',
      url: `${API_BASE_URL}/membership-requests`,
      expectedStatus: 401,
    },
    {
      label: 'Orders GET without auth',
      method: 'GET',
      url: `${API_BASE_URL}/orders`,
      expectedStatus: 401,
    },
    {
      label: 'Event bookings GET without auth',
      method: 'GET',
      url: `${API_BASE_URL}/event-bookings`,
      expectedStatus: 401,
    },
    {
      label: 'Message threads GET without auth',
      method: 'GET',
      url: `${API_BASE_URL}/message-threads`,
      expectedStatus: 401,
    },
    {
      label: 'Event booking validation',
      method: 'POST',
      url: `${API_BASE_URL}/event-bookings`,
      expectedStatus: 400,
      body: JSON.stringify({}),
    },
  ]

  for (const check of checks) {
    const { response } = await fetchJson(check.url, {
      method: check.method,
      headers: check.body
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: check.body,
    })
    assertStatus(response.status, check.expectedStatus, check.label)
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      baseUrl: API_BASE_URL,
      health,
      checks: checks.map((check) => check.label),
    }, null, 2)}\n`,
  )
}

run().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
