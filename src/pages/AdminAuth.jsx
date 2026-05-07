import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { loginAdmin as loginAdminService } from '../services/authService'
import { revealUp } from '../utils/motion'

const defaultFormState = {
  email: '',
  password: '',
}

export default function AdminAuth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAdmin, login, logout } = useAuth()
  const { showToast } = useToast()
  const [formData, setFormData] = useState(defaultFormState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)

  const redirectTarget = searchParams.get('redirect') || '/admin'

  useEffect(() => {
    if (user && isAdmin) {
      navigate(redirectTarget, { replace: true })
    }
  }, [isAdmin, navigate, redirectTarget, user])

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }))
    setError('')
  }

  const handleAdminSignIn = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await loginAdminService(formData.email, formData.password)
      login(response.user, response.token)
      showToast(`Admin access granted for ${response.user.name}.`, 'success')
      navigate(redirectTarget, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignOut = () => {
    logout()
    showToast('Signed out of the current session.', 'success')
  }

  return (
    <PageWrapper className="cp-page--auth">
      <section className="cp-page-hero cp-page-hero--compact">
        <div className="cp-container">
          <motion.div {...revealUp}>
            <span className="cp-eyebrow">Admin access</span>
            <h1 className="cp-page-title">
              Sign in to the operations desk with an <em>admin account only.</em>
            </h1>
            <p className="cp-page-intro">
              This route is intentionally not linked in the public interface and is reserved for
              authorized CrownPoint operations staff.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="cp-section" style={{ paddingTop: 20 }}>
        <div className="cp-container cp-auth-grid">
          <motion.div className="cp-auth-lead cp-surface cp-surface--accent" {...revealUp}>
            <span className="cp-eyebrow">Protected access</span>
            <h2 className="section-title">
              The admin sign-in is separated from fan auth so the operations desk keeps a clear
              <em> permission boundary.</em>
            </h2>
            <ul className="cp-list">
              <li>The route is hidden from the public header and mobile navigation.</li>
              <li>Only users with the `ADMIN` role can complete sign-in here.</li>
              <li>The same role check protects both `/admin-login` and the `/admin` workspace.</li>
            </ul>
            <div className="cp-inline-trust" style={{ marginTop: 22 }}>
              <span className="cp-chip">
                <ShieldCheck size={14} />
                Admin role enforced
              </span>
              <span className="cp-chip">
                <LockKeyhole size={14} />
                Hidden direct URL access
              </span>
            </div>
          </motion.div>

          <motion.div className="cp-auth-card cp-surface" {...revealUp}>
            {user && !isAdmin ? (
              <div className="cp-nda-card" style={{ marginBottom: 24 }}>
                <span className="cp-eyebrow">Current session</span>
                <p className="cp-nda-copy">
                  You are currently signed in as {user.name}. Signing in here will replace this
                  browser session with the admin account.
                </p>
                <button className="cp-btn cp-btn--quiet" onClick={handleSignOut} type="button">
                  <LogOut size={14} />
                  Sign out current account
                </button>
              </div>
            ) : null}

            <form className="cp-form-grid" onSubmit={handleAdminSignIn}>
              <div className="cp-field">
                <label htmlFor="admin-email">Email</label>
                <input
                  autoComplete="username"
                  id="admin-email"
                  onChange={updateField('email')}
                  placeholder="admin email"
                  required
                  type="email"
                  value={formData.email}
                />
              </div>
              <div className="cp-field">
                <label htmlFor="admin-password">Password</label>
                <div className="cp-password-field">
                  <input
                    autoComplete="current-password"
                    id="admin-password"
                    onChange={updateField('password')}
                    placeholder="Admin password"
                    required
                    type={passwordVisible ? 'text' : 'password'}
                    value={formData.password}
                  />
                  <button
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={passwordVisible}
                    className="cp-password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    title={passwordVisible ? 'Hide password' : 'Show password'}
                    type="button"
                  >
                    {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <p className="cp-form-error">{error}</p>}

              <button className="cp-btn cp-btn--primary" disabled={submitting} type="submit">
                {submitting ? 'Signing in...' : 'Sign in as admin'}
                <ArrowRight size={14} />
              </button>
            </form>

            <p className="cp-note">
              Need the public site instead? <Link to="/">Return home.</Link>
            </p>
          </motion.div>
        </div>
      </section>
    </PageWrapper>
  )
}
