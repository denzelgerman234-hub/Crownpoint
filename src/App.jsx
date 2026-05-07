import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import Loader from './components/ui/Loader'
import Toast from './components/ui/Toast'
import { useAuth } from './hooks/useAuth'

const ConciergeAssistant = lazy(() => import('./components/ui/ConciergeAssistant'))
const AdminAuth = lazy(() => import('./pages/AdminAuth'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const Auth = lazy(() => import('./pages/Auth'))
const Booking = lazy(() => import('./pages/Booking'))
const FanDashboard = lazy(() => import('./pages/FanDashboard'))
const Home = lazy(() => import('./pages/Home'))
const Legal = lazy(() => import('./pages/Legal'))
const Membership = lazy(() => import('./pages/Membership'))
const Messages = lazy(() => import('./pages/Messages'))
const MessageThread = lazy(() => import('./pages/MessageThread'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Payment = lazy(() => import('./pages/Payment'))
const Pricing = lazy(() => import('./pages/Pricing'))
const TalentDirectory = lazy(() => import('./pages/TalentDirectory'))
const TalentEvents = lazy(() => import('./pages/TalentEvents'))
const TalentMessaging = lazy(() => import('./pages/TalentMessaging'))
const TalentProfile = lazy(() => import('./pages/TalentProfile'))
const TalentReviews = lazy(() => import('./pages/TalentReviews'))
const TalentShop = lazy(() => import('./pages/TalentShop'))

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

const AnimatedPage = ({ children }) => (
  <motion.div
    animate="animate"
    exit="exit"
    initial="initial"
    style={{ minHeight: '100vh' }}
    variants={pageVariants}
  >
    {children}
  </motion.div>
)

const SuspendedPage = ({ children, label }) => (
  <Suspense fallback={<Loader label={label} />}>
    {children}
  </Suspense>
)

function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Loader label="Restoring your session..." />
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate replace to={`/auth?redirect=${encodeURIComponent(redirect)}`} />
  }

  return children
}

function RequireAdmin({ children }) {
  const { isAdmin, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Loader label="Restoring your session..." />
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate replace to={`/admin-login?redirect=${encodeURIComponent(redirect)}`} />
  }

  if (!isAdmin) {
    return <Navigate replace to="/" />
  }

  return children
}

function App() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  const renderPage = (page, label) => (
    <AnimatedPage>
      <SuspendedPage label={label}>{page}</SuspendedPage>
    </AnimatedPage>
  )

  return (
    <div className="cp-shell">
      <Header />
      <Toast />
      <Suspense fallback={null}>
        <ConciergeAssistant />
      </Suspense>

      <main className="cp-main">
        <AnimatePresence mode="wait">
          <Routes key={location.pathname} location={location}>
            <Route path="/" element={renderPage(<Home />, 'Loading home...')} />
            <Route path="/talents" element={renderPage(<TalentDirectory />, 'Loading talent search...')} />
            <Route path="/events" element={renderPage(<TalentEvents />, 'Loading event booking...')} />
            <Route path="/pricing" element={renderPage(<Pricing />, 'Loading pricing...')} />
            <Route
              path="/membership"
              element={renderPage(
                (
                  <RequireAuth>
                    <Membership />
                  </RequireAuth>
                ),
                'Loading membership...',
              )}
            />
            <Route path="/talent/:id" element={renderPage(<TalentProfile />, 'Loading talent profile...')} />
            <Route path="/talent/:id/events" element={renderPage(<TalentEvents />, 'Loading talent event booking...')} />
            <Route path="/talent/:id/shop" element={renderPage(<TalentShop />, 'Loading talent shop...')} />
            <Route path="/talent/:id/messages" element={renderPage(<TalentMessaging />, 'Loading talent messaging...')} />
            <Route path="/talent/:id/reviews" element={renderPage(<TalentReviews />, 'Loading talent reviews...')} />
            <Route path="/experiences" element={renderPage(<Booking />, 'Loading booking desk...')} />
            <Route path="/book" element={renderPage(<Booking />, 'Loading booking desk...')} />
            <Route path="/payment" element={renderPage(<Payment />, 'Loading payment desk...')} />
            <Route path="/auth" element={renderPage(<Auth />, 'Loading sign in...')} />
            <Route path="/admin-login" element={renderPage(<AdminAuth />, 'Loading admin sign in...')} />
            <Route path="/admin-auth" element={<Navigate replace to="/admin-login" />} />
            <Route path="/admin/signin" element={<Navigate replace to="/admin-login" />} />
            <Route path="/legal" element={renderPage(<Legal />, 'Loading legal page...')} />
            <Route
              path="/dashboard"
              element={renderPage(
                (
                  <RequireAuth>
                    <FanDashboard />
                  </RequireAuth>
                ),
                'Loading dashboard...',
              )}
            />
            <Route
              path="/messages"
              element={renderPage(
                (
                  <RequireAuth>
                    <Messages />
                  </RequireAuth>
                ),
                'Loading messages...',
              )}
            />
            <Route
              path="/messages/:threadId"
              element={renderPage(
                (
                  <RequireAuth>
                    <MessageThread />
                  </RequireAuth>
                ),
                'Loading thread...',
              )}
            />
            <Route
              path="/admin"
              element={renderPage(
                (
                  <RequireAdmin>
                    <AdminPanel />
                  </RequireAdmin>
                ),
                'Loading admin desk...',
              )}
            />
            <Route path="/admin-desk" element={<Navigate replace to="/admin" />} />
            <Route path="/admin-panel" element={<Navigate replace to="/admin" />} />
            <Route path="*" element={renderPage(<NotFound />, 'Loading page...')} />
          </Routes>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}

export default App
