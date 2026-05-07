import { useEffect, useState } from 'react'
import { LogOut, Menu, ShoppingBag, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import brandLogo from '../../assets/crownpoint-logo.png'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../hooks/useAuth'
import { useScrollPosition } from '../../hooks/useScrollPosition'
import MobileCartTray from './MobileCartTray'

const talentSectionPattern = /^\/talent\/[^/]+(?:\/(shop|reviews))?\/?$/
const talentEventPattern = /^\/talent\/[^/]+\/events\/?$/
const talentMessagePattern = /^\/talent\/[^/]+\/messages\/?$/
const experiencesPattern = /^\/(?:experiences|book)\/?$/
const messagesPattern = /^\/messages(?:\/[^/]+)?\/?$/

const linkClassName = (item, pathname) => ({ isActive }) => {
  const sectionActive = item.match ? item.match(pathname) : false
  return `cp-nav-link${sectionActive || isActive ? ' active' : ''}`
}

export default function Header() {
  const location = useLocation()
  const scrollY = useScrollPosition()
  const [isOpen, setIsOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(location.pathname)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartPath, setCartPath] = useState(location.pathname)
  const { itemCount } = useCart()
  const { currentPlanLabel, isAdmin, logout, user } = useAuth()
  const canOpenCart = experiencesPattern.test(location.pathname) || itemCount > 0
  const isMenuVisible = isOpen && menuPath === location.pathname
  const isCartVisible = canOpenCart && isCartOpen && cartPath === location.pathname
  const closeMenu = () => setIsOpen(false)
  const closeCart = () => setIsCartOpen(false)
  const closePanels = () => {
    closeMenu()
    closeCart()
  }
  const navItems = [
    { to: '/', label: 'Home' },
    {
      to: '/talents',
      label: 'Talents',
      match: (pathname) => pathname === '/talents' || talentSectionPattern.test(pathname),
    },
    {
      to: '/experiences',
      label: 'Experiences',
      match: (pathname) => experiencesPattern.test(pathname),
    },
    {
      to: '/events',
      label: 'Event Booking',
      match: (pathname) => pathname === '/events' || talentEventPattern.test(pathname),
    },
    { to: '/pricing', label: 'Pricing' },
    ...(user && !isAdmin
      ? [{
          to: '/messages',
          label: 'Messages',
          match: (pathname) => messagesPattern.test(pathname) || talentMessagePattern.test(pathname),
        }]
      : []),
    { to: '/legal', label: 'Legal' },
  ]

  const handleLogout = () => {
    logout()
    closePanels()
  }

  const handleCartToggle = () => {
    closeMenu()

    if (isCartVisible) {
      closeCart()
      return
    }

    setCartPath(location.pathname)
    setIsCartOpen(true)
  }

  const handleMenuToggle = () => {
    closeCart()

    if (isMenuVisible) {
      closeMenu()
      return
    }

    setMenuPath(location.pathname)
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isCartVisible) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsCartOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCartVisible])

  return (
    <div className="cp-header-wrap">
      <header className={`cp-header${scrollY > 24 ? ' is-scrolled' : ''}`}>
        <Link className="cp-brand" onClick={closePanels} to="/">
          <span className="cp-brand-copy cp-brand-copy--logo">
            <img
              alt="CrownPoint"
              className="cp-brand-logo"
              src={brandLogo}
            />
          </span>
        </Link>

        <nav aria-label="Primary" className="cp-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={linkClassName(item, location.pathname)}
              onClick={closePanels}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="cp-header-actions">
          {user ? (
            isAdmin ? (
              <>
                <Link className="cp-btn cp-btn--quiet cp-header-desktop-action" onClick={closePanels} to="/admin">
                  Admin Desk
                </Link>
                <Link className="cp-profile-pill cp-header-desktop-action" onClick={closePanels} to="/admin">
                  <img
                    alt={`${user.name} profile`}
                    className="cp-profile-photo"
                    src={user.avatarUrl}
                  />
                  <span className="cp-profile-copy">
                    <strong>{user.name}</strong>
                    <span>Administrator</span>
                  </span>
                </Link>
                <button className="cp-profile-logout cp-header-desktop-action" onClick={handleLogout} type="button">
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <>
                <Link className="cp-btn cp-btn--quiet cp-header-desktop-action" onClick={closePanels} to="/membership">
                  Membership
                </Link>
                <Link className="cp-profile-pill cp-header-desktop-action" onClick={closePanels} to="/dashboard">
                  <img
                    alt={`${user.name} profile`}
                    className="cp-profile-photo"
                    src={user.avatarUrl}
                  />
                  <span className="cp-profile-copy">
                    <strong>{user.name}</strong>
                    <span>{currentPlanLabel}</span>
                  </span>
                </Link>
                <button className="cp-profile-logout cp-header-desktop-action" onClick={handleLogout} type="button">
                  <LogOut size={14} />
                </button>
              </>
            )
          ) : (
            <>
              <Link className="cp-btn cp-btn--quiet cp-header-desktop-action" onClick={closePanels} to="/auth?mode=signin">
                Sign In
              </Link>
              <Link className="cp-btn cp-btn--primary cp-header-desktop-action" onClick={closePanels} to="/pricing">
                View Pricing
              </Link>
            </>
          )}
          {canOpenCart ? (
            <button
              aria-controls="mobile-cart-tray"
              aria-expanded={isCartVisible}
              aria-label={isCartVisible ? 'Close cart summary' : 'Open cart summary'}
              className={`cp-header-cart-button${isCartVisible ? ' is-active' : ''}`}
              onClick={handleCartToggle}
              type="button"
            >
              <ShoppingBag size={18} />
              {itemCount ? (
                <span className="cp-header-cart-badge">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            aria-expanded={isMenuVisible}
            aria-label={isMenuVisible ? 'Close navigation menu' : 'Open navigation menu'}
            className="cp-menu-button"
            onClick={handleMenuToggle}
            type="button"
          >
            {isMenuVisible ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className={`cp-mobile-panel${isMenuVisible ? ' is-open' : ''}`}>
        {user && (
          <div className="cp-mobile-profile">
            <img
              alt={`${user.name} profile`}
              className="cp-profile-photo"
              src={user.avatarUrl}
            />
            <div className="cp-profile-copy">
              <strong>{user.name}</strong>
              <span>{isAdmin ? 'Administrator' : currentPlanLabel}</span>
            </div>
          </div>
        )}

        <nav aria-label="Mobile" className="cp-mobile-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={linkClassName(item, location.pathname)}
              onClick={closePanels}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="cp-mobile-actions">
          {user ? (
            isAdmin ? (
              <>
                <Link className="cp-btn cp-btn--primary" onClick={closePanels} to="/admin">
                  Open Admin Desk
                </Link>
                <button className="cp-btn cp-btn--quiet" onClick={handleLogout} type="button">
                  <LogOut size={14} />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link className="cp-btn cp-btn--ghost" onClick={closePanels} to="/dashboard">
                  Open Account
                </Link>
                <Link className="cp-btn cp-btn--ghost" onClick={closePanels} to="/membership">
                  Manage Membership
                </Link>
                <Link className="cp-btn cp-btn--primary" onClick={closePanels} to="/messages">
                  Private Messages
                </Link>
                <button className="cp-btn cp-btn--quiet" onClick={handleLogout} type="button">
                  <LogOut size={14} />
                  Sign Out
                </button>
              </>
            )
          ) : (
            <>
              <Link className="cp-btn cp-btn--ghost" onClick={closePanels} to="/auth?mode=signin">
                Sign In
              </Link>
              <Link className="cp-btn cp-btn--primary" onClick={closePanels} to="/pricing">
                View Pricing
              </Link>
            </>
          )}
        </div>
      </div>

      <MobileCartTray isOpen={isCartVisible} onClose={closeCart} />
    </div>
  )
}
