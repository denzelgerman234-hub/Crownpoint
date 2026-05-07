import { createClient } from '@supabase/supabase-js'

const trimText = (value) => String(value ?? '').trim()
const supabaseUrl = trimText(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
const serviceRoleKey = trimText(process.env.SUPABASE_SERVICE_ROLE_KEY)
const adminEmail = trimText(process.env.SUPABASE_ADMIN_EMAIL).toLowerCase()
const adminPassword = trimText(process.env.SUPABASE_ADMIN_PASSWORD)
const adminUserId = trimText(process.env.SUPABASE_ADMIN_USER_ID)
const adminName = trimText(process.env.SUPABASE_ADMIN_NAME) || 'CrownPoint Admin'

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local first.')
}

if (!adminUserId && !adminEmail) {
  throw new Error('Add SUPABASE_ADMIN_EMAIL to .env.local, or SUPABASE_ADMIN_USER_ID to promote an existing Supabase Auth user.')
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const mergeAdminMetadata = (user = {}) => ({
  app_metadata: {
    ...(user.app_metadata ?? {}),
    role: 'ADMIN',
  },
  user_metadata: {
    ...(user.user_metadata ?? {}),
    name: adminName,
  },
})

const updateUserAsAdmin = async (user) => {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    mergeAdminMetadata(user),
  )

  if (error) {
    throw new Error(`Supabase admin promotion failed: ${error.message}`)
  }

  return data.user
}

const findUserByEmail = async (email) => {
  const perPage = 1000

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw new Error(`Supabase user lookup failed: ${error.message}`)
    }

    const users = data?.users ?? []
    const user = users.find((candidate) => trimText(candidate.email).toLowerCase() === email)

    if (user || users.length < perPage) {
      return user ?? null
    }
  }

  return null
}

let adminUser = null
let action = 'promoted'

if (adminUserId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(adminUserId)

  if (error || !data?.user) {
    throw new Error(`Supabase admin user lookup failed: ${error?.message || 'User not found.'}`)
  }

  adminUser = await updateUserAsAdmin(data.user)
} else {
  const existingUser = await findUserByEmail(adminEmail)

  if (existingUser) {
    adminUser = await updateUserAsAdmin(existingUser)
  } else {
    if (adminPassword.length < 12) {
      throw new Error('Add SUPABASE_ADMIN_PASSWORD with at least 12 characters to create a new admin user.')
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'ADMIN' },
      user_metadata: { name: adminName },
    })

    if (error) {
      throw new Error(`Supabase admin user creation failed: ${error.message}`)
    }

    adminUser = data.user
    action = 'created'
  }
}

console.log(JSON.stringify({
  action,
  id: adminUser.id,
  email: adminUser.email,
  role: adminUser.app_metadata?.role,
}, null, 2))
