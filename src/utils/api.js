import axios from 'axios'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL, SUPABASE_AUTH_ENABLED } from './backendConfig'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const getUnauthorizedRedirectPath = () => {
  if (typeof window === 'undefined') {
    return '/auth'
  }

  const redirect = `${window.location.pathname}${window.location.search}`

  if (window.location.pathname.startsWith('/admin')) {
    return `/admin-login?redirect=${encodeURIComponent(redirect)}`
  }

  return `/auth?redirect=${encodeURIComponent(redirect)}`
}

api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem('crownpoint_token')

    if (SUPABASE_AUTH_ENABLED) {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token ?? token
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crownpoint_token')
      window.location.href = getUnauthorizedRedirectPath()
    }
    return Promise.reject(error)
  },
)

export default api
