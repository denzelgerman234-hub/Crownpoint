import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import TalentDetailLayout from '../components/layout/TalentDetailLayout'
import PageWrapper from '../components/layout/PageWrapper'
import Loader from '../components/ui/Loader'
import { useAuth } from '../hooks/useAuth'
import { useResolvedTalent } from '../hooks/useResolvedTalent'
import { useToast } from '../hooks/useToast'
import { addReviewToTalent } from '../services/talentService'
import { revealUp } from '../utils/motion'

const createReviewDraft = () => ({
  rating: '5',
  comment: '',
})

export default function TalentReviews() {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isLoading, talent } = useResolvedTalent(id)
  const [reviewDraft, setReviewDraft] = useState(createReviewDraft)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  useEffect(() => {
    setReviewDraft(createReviewDraft())
  }, [talent?.id, user?.id])

  if (isLoading) {
    return (
      <PageWrapper>
        <section className="cp-empty-state">
          <div className="cp-container">
            <Loader label="Loading review page..." />
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
              This review page is currently <em>unavailable.</em>
            </h2>
            <p>
              We could not find that profile. Head back to the directory to explore the available
              talent.
            </p>
            <div className="cp-page-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
              <Link className="cp-btn cp-btn--primary" to="/talents">
                Back to directory
              </Link>
            </div>
          </div>
        </section>
      </PageWrapper>
    )
  }

  const existingUserReview =
    user == null ? null : talent.reviews.find((review) => review.userId === Number(user.id)) ?? null
  const reviewAuthLink = `/auth?redirect=${encodeURIComponent(`/talent/${talent.id}/reviews`)}`

  const handleReviewSubmit = async (event) => {
    event.preventDefault()

    if (!user) {
      return showToast('Sign in before leaving a review.', 'warning')
    }

    if (existingUserReview) {
      return showToast('You already left a review for this talent.', 'warning')
    }

    const parsedRating = Number(reviewDraft.rating)
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return showToast('Choose a rating between 1 and 5 stars.', 'warning')
    }

    if (!reviewDraft.comment.trim()) {
      return showToast('Add a short review before submitting.', 'warning')
    }

    setIsSubmittingReview(true)

    try {
      await addReviewToTalent(talent.id, {
        userId: user.id,
        authorName: user.name,
        authorLocation: user.profile?.country ?? '',
        rating: parsedRating,
        comment: reviewDraft.comment.trim(),
        verified: true,
      })
      setReviewDraft(createReviewDraft())
      showToast(`Your review for ${talent.name} is now live.`, 'success')
    } catch (error) {
      showToast(error.message || 'We could not save your review right now.', 'warning')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <TalentDetailLayout
      activeTab="reviews"
      eyebrow="Leave a review"
      intro={`Share feedback for ${talent.name} from the same profile flow.`}
      talent={talent}
      title={(
        <>
          Leave a review for {talent.name}. <em>Help the next fan feel more confident.</em>
        </>
      )}
      aside={null}
    >
      <motion.article className="cp-info-card cp-surface" {...revealUp}>
        <span className="cp-eyebrow">Leave a review</span>
        <h3>Share how {talent.name} showed up for your request.</h3>
        {!user ? (
          <div className="cp-message-preview" style={{ marginTop: 18 }}>
            Sign in to leave a verified review for this talent.
            <div className="cp-card-actions" style={{ marginTop: 16 }}>
              <Link className="cp-btn cp-btn--primary" to={reviewAuthLink}>
                Sign in to review
              </Link>
            </div>
          </div>
        ) : existingUserReview ? (
          <div className="cp-message-preview" style={{ marginTop: 18 }}>
            You already reviewed {talent.name}. Thanks for adding your feedback to this profile.
          </div>
        ) : (
          <form className="cp-review-form" onSubmit={handleReviewSubmit}>
            <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
              <div className="cp-field">
                <label htmlFor="talent-review-rating">Your rating</label>
                <select
                  id="talent-review-rating"
                  onChange={(event) =>
                    setReviewDraft((current) => ({ ...current, rating: event.target.value }))
                  }
                  value={reviewDraft.rating}
                >
                  <option value="5">5 stars - Exceptional</option>
                  <option value="4">4 stars - Great</option>
                  <option value="3">3 stars - Good</option>
                  <option value="2">2 stars - Fair</option>
                  <option value="1">1 star - Needs work</option>
                </select>
              </div>
              <div className="cp-field">
                <label htmlFor="talent-review-author">Reviewing as</label>
                <input
                  disabled
                  id="talent-review-author"
                  value={user.name}
                />
              </div>
            </div>

            <div className="cp-field" style={{ marginTop: 18 }}>
              <label htmlFor="talent-review-comment">Your review</label>
              <textarea
                id="talent-review-comment"
                maxLength={600}
                onChange={(event) =>
                  setReviewDraft((current) => ({ ...current, comment: event.target.value }))
                }
                placeholder={`What stood out about booking ${talent.name}?`}
                value={reviewDraft.comment}
              />
            </div>

            <div className="cp-review-form-footer">
              <p className="cp-note">
                Your feedback helps other fans know what to expect and gives the talent team a
                clearer view of the experience.
              </p>
              <button
                className="cp-btn cp-btn--primary"
                disabled={isSubmittingReview}
                type="submit"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit review'}
              </button>
            </div>
          </form>
        )}
      </motion.article>

      <div className="cp-support-grid">
        <motion.article className="cp-summary-card cp-surface cp-surface--accent" {...revealUp}>
          <span className="cp-eyebrow">Public rating</span>
          <h3>{talent.rating.toFixed(1)} / 5</h3>
          <p className="cp-text-muted">
            Verified fan feedback helps shape how this profile is presented.
          </p>

          <div className="cp-price-row">
            {talent.completedBookings > 0 ? (
              <div>
                <strong>{talent.completedBookings.toLocaleString()}</strong>
                <span>completed experiences</span>
              </div>
            ) : null}
            <span>{talent.responseTime} response pace</span>
          </div>

          <div className="cp-inline-trust" style={{ marginTop: 18 }}>
            <span className="cp-chip">
              <Star size={14} />
              Verified fan feedback
            </span>
          </div>
        </motion.article>

        <motion.article className="cp-info-card cp-surface" {...revealUp}>
          <span className="cp-eyebrow">Helpful reviews</span>
          <h3>Keep it clear, honest, and useful.</h3>
          <ul className="cp-list">
            <li>Mention what felt personal, smooth, or memorable about the experience.</li>
            <li>Call out timing, tone, and how well the request matched what you asked for.</li>
            <li>Focus on the experience itself so your review helps the next fan decide confidently.</li>
          </ul>
          <div className="cp-card-actions">
            <Link className="cp-btn cp-btn--ghost" to={`/talent/${talent.id}`}>
              Back to services
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.article>
      </div>
    </TalentDetailLayout>
  )
}
