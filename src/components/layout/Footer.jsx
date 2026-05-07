import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import brandLogo from '../../assets/crownpoint-logo.png'

function WhatsAppIcon(props) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 3.25c4.83 0 8.75 3.83 8.75 8.57 0 4.73-3.92 8.58-8.75 8.58a8.8 8.8 0 0 1-4.04-.98l-3.96 1.04 1.04-3.84a8.42 8.42 0 0 1-1.29-4.5c0-4.74 3.84-8.57 8.25-8.57Z" />
      <path d="M9.39 8.6c.16-.35.31-.38.54-.38h.45c.13 0 .35.05.52.45.18.41.64 1.51.7 1.62.05.12.09.25.02.4-.07.14-.11.23-.22.35-.11.13-.23.28-.33.38-.11.1-.23.23-.1.45.11.22.5.81 1.08 1.31.74.67 1.37.89 1.56.99.19.11.31.1.42-.07.14-.16.55-.63.7-.83.14-.2.29-.17.49-.1.2.07 1.29.6 1.51.71.22.11.36.17.42.26.05.09.05.49-.12.96-.17.47-.97.91-1.33.96-.36.06-.79.08-1.29-.07-.3-.1-.69-.23-1.17-.44-.2-.08-1.76-.73-2.87-1.93-.27-.3-.76-.82-1.13-1.47-.41-.7-.58-1.41-.58-1.92 0-.52.18-.93.37-1.2Z" />
    </svg>
  )
}

function XBrandIcon(props) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M4.25 4.5h3.78l4.13 5.55 4.6-5.55h2.99l-6.16 7.16 6.41 8.34h-3.79l-4.38-5.75L6.9 20H3.91l6.41-7.44-6.07-8.06Zm4.68 1.9H8.1l7.01 9.2h.84l-7.02-9.2Z" />
    </svg>
  )
}

function FacebookIcon(props) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M13.77 20v-6.1h2.14l.35-2.68h-2.49V9.5c0-.78.21-1.31 1.33-1.31h1.33V5.86c-.23-.03-1.02-.09-1.94-.09-1.92 0-3.23 1.17-3.23 3.33v2.12H9.1v2.68h2.16V20h2.51Z" />
    </svg>
  )
}

function InstagramIcon(props) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      <rect x="4.25" y="4.25" width="15.5" height="15.5" rx="4.5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.15" cy="6.85" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokIcon(props) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M14.74 4c.47 1.32 1.52 2.39 2.9 2.83v2.48a5.73 5.73 0 0 1-2.81-.75v5.25c0 3.18-2.55 5.19-5.22 5.19-2.9 0-5.11-2.2-5.11-4.93 0-2.89 2.27-5.02 5.18-5.02.35 0 .68.04 1.02.12v2.49a2.99 2.99 0 0 0-.91-.14c-1.48 0-2.69 1.05-2.69 2.46 0 1.45 1.19 2.42 2.48 2.42 1.53 0 2.73-.92 2.73-2.9V4h2.43Z" />
    </svg>
  )
}

const footerGroups = [
  {
    title: 'Explore',
      links: [
        { to: '/', label: 'Home' },
        { to: '/talents', label: 'Talent directory' },
        { to: '/pricing', label: 'Pricing' },
      ],
  },
  {
    title: 'Account',
    links: [
      { to: '/payment', label: 'Payment desk' },
      { to: '/dashboard', label: 'My account' },
      { to: '/membership', label: 'Membership desk' },
      { to: '/messages', label: 'Private messages' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { to: '/legal', label: 'Legal policies' },
      { to: '/legal', label: 'Terms of service' },
      { to: '/legal', label: 'Privacy notice' },
    ],
  },
]

const footerSocials = [
  { href: '', Icon: WhatsAppIcon, label: 'WhatsApp' },
  { href: '', Icon: XBrandIcon, label: 'X' },
  { href: '', Icon: FacebookIcon, label: 'Facebook' },
  { href: '', Icon: InstagramIcon, label: 'Instagram' },
  { href: '', Icon: TikTokIcon, label: 'TikTok' },
]

export default function Footer() {
  return (
    <footer className="cp-footer">
      <div className="cp-container cp-footer-grid">
        <div className="cp-footer-brand">
          <img
            alt="CrownPoint"
            className="cp-footer-logo"
            src={brandLogo}
          />
          <p className="cp-footer-kicker">Private talent concierge</p>
          <h2 className="cp-footer-title">
            Private talent access, handled with care.
          </h2>
          <p className="cp-footer-note">
            Explore talent profiles, request experiences, manage membership, and stay connected in
            one refined destination.
          </p>
          <Link className="cp-btn cp-btn--primary" to="/pricing">
            View pricing
            <ArrowRight size={14} />
          </Link>

          <div className="cp-footer-social-block">
            <div className="cp-footer-socials" aria-label="CrownPoint social platforms">
              {footerSocials.map((social) => {
                const content = <social.Icon aria-hidden="true" />

                return social.href ? (
                  <a
                    key={social.label}
                    aria-label={social.label}
                    className="cp-footer-social"
                    href={social.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {content}
                  </a>
                ) : (
                  <span
                    key={social.label}
                    aria-label={social.label}
                    className="cp-footer-social"
                    role="img"
                  >
                    {content}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title} className="cp-footer-column">
            <h3>{group.title}</h3>
            <div className="cp-footer-links">
              {group.links.map((link) => (
                <Link key={`${group.title}-${link.label}`} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="cp-container cp-footer-bottom">
        <span>Copyright 2026 CrownPoint Limited</span>
        <span>Premium talent experiences</span>
      </div>
    </footer>
  )
}
