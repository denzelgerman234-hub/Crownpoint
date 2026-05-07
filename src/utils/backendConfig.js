const trimEnvValue = (value) => String(value ?? '').trim()

const envFlagEnabled = (value) => trimEnvValue(value).toLowerCase() === 'true'

const supabaseUrl = trimEnvValue(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = trimEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY)
const localFallbackOverride = trimEnvValue(import.meta.env.VITE_ENABLE_LOCAL_BACKEND_FALLBACKS)

export const SUPABASE_ENV_CONFIGURED = Boolean(supabaseUrl) && Boolean(supabaseAnonKey)

export const SUPABASE_AUTH_ENABLED =
  envFlagEnabled(import.meta.env.VITE_USE_SUPABASE_AUTH) && SUPABASE_ENV_CONFIGURED

export const SUPABASE_TALENTS_ENABLED =
  envFlagEnabled(import.meta.env.VITE_USE_SUPABASE_TALENTS) && SUPABASE_ENV_CONFIGURED

export const LOCAL_BACKEND_FALLBACKS_ENABLED = localFallbackOverride
  ? envFlagEnabled(localFallbackOverride)
  : Boolean(import.meta.env.DEV)

export const API_BASE_URL =
  trimEnvValue(import.meta.env.VITE_API_URL) ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')

export const BACKEND_REQUIRED_MESSAGE =
  'This feature is temporarily unavailable right now. Please try again shortly.'

export const STORAGE_REQUIRED_MESSAGE =
  'File uploads are temporarily unavailable right now. Please try again shortly.'
