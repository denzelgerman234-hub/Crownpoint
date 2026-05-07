import { motion } from 'framer-motion'
import { ArrowRight, ExternalLink, ShoppingBag } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import Loader from '../components/ui/Loader'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { revealUp } from '../utils/motion'

export default function TalentShop() {
  const { id } = useParams()
  const { isLoading, talent } = useResolvedTalent(id)

  if (isLoading) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <Loader label="Loading merchandise page..." />
          </div>
        </section>
      </PageWrapper>
    )
  }

  if (!talent) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <h2 className="section-title">
              This merch page is currently <em>unavailable.</em>
            </h2>
            <p>
              We could not find that talent profile just now. Return to the directory to keep exploring.
            </p>
            <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
              <Link className="cp-btn cp-btn--primary" to="/talents">
                Back to talents
              </Link>
            </div>
          </div>
        </section>
      </PageWrapper>
    )
  }

  return (
    <TalentDetailLayout
      activeTab="shop"
      eyebrow="Merchandise"
      intro={`Open ${talent.name}'s Amazon merch results and continue your purchase there.`}
      talent={talent}
      title={(
        <>
          Explore merch connected to {talent.name}. <em>Continue on Amazon.</em>
        </>
      )}
    >
      <motion.article className="cp-info-card cp-surface" {...revealUp}>
        <span className="cp-eyebrow">Official merch route</span>
        <h3>We will send you to Amazon for merchandise and collectibles.</h3>
        <p className="cp-text-muted">
          Merch purchases now happen outside CrownPoint so you can browse, compare, and checkout directly on Amazon.
        </p>

        <div className="cp-inline-trust" style={{ marginTop: 18 }}>
          <span className="cp-chip">
            <ShoppingBag size={14} />
            Amazon merch
          </span>
          <span className="cp-chip">{talent.name}</span>
        </div>

        <div className="cp-card-actions" style={{ marginTop: 22 }}>
          <a
            className="cp-btn cp-btn--primary"
            href={talent.shopLink}
            rel="noreferrer"
            target="_blank"
          >
            Open Amazon merch
            <ExternalLink size={14} />
          </a>
          <Link className="cp-btn cp-btn--ghost" to={`/talent/${talent.id}`}>
            Back to profile
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.article>
    </TalentDetailLayout>
  )
}
