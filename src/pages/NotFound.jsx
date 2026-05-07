import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'

export default function NotFound() {
  return (
    <PageWrapper>
      <section className="cp-notfound">
        <div className="cp-container">
          <span className="cp-eyebrow">404</span>
          <h1>This page is no longer available.</h1>
          <p>
            The page you are looking for cannot be found. Head back home or explore the roster to
            keep browsing.
          </p>
          <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
            <Link className="cp-btn cp-btn--primary" to="/">
              Return home
            </Link>
            <Link className="cp-btn cp-btn--ghost" to="/talents">
              Explore talent
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </PageWrapper>
  )
}
