import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, PencilLine, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react'
import EventBookingDesk from './EventBookingDesk'
import TalentSearchFilters from '../ui/TalentSearchFilters'
import { useAuth } from '../../hooks/useAuth'
import { useTalentFilters } from '../../hooks/useTalentFilters'
import { useToast } from '../../hooks/useToast'
import {
  addExperienceToTalent,
  addTalent,
  deleteExperienceFromTalent,
  deleteTalent,
  getAllTalents,
  subscribeToTalentRoster,
  updateExperienceForTalent,
  updateTalent,
} from '../../services/talentService'
import { EXPERIENCE_TYPES, TALENT_CATEGORIES } from '../../utils/constants'
import { formatCurrency } from '../../utils/formatters'

const DESK_STACK_STYLE = { display: 'grid', gap: 20 }
const PANEL_GRID_STYLE = {
  display: 'grid',
  gap: 20,
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  alignItems: 'start',
}
const CARD_GRID_STYLE = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
}
const CARD_STYLE = { padding: 18, display: 'grid', gap: 12 }
const SECTION_HEADER_STYLE = { display: 'grid', gap: 10 }

const MANAGEMENT_TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'experiences', label: 'Experiences' },
  { id: 'events', label: 'Event Booking' },
]

const ADMIN_ROSTER_PREVIEW_COUNT = 8
const EXPERIENCE_OPTIONS = Object.entries(EXPERIENCE_TYPES).map(([id, config]) => ({ id, ...config }))
const TALENT_CATEGORY_OPTIONS = TALENT_CATEGORIES.filter((category) => category !== 'All')

const formatProfileCount = (count) => `${count} profile${count === 1 ? '' : 's'}`

const splitCommaSeparated = (value = '') =>
  String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const truncateText = (value = '', maxLength = 140) => {
  const text = String(value ?? '').trim()
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trimEnd()}...`
}

const confirmInBrowser = (message) =>
  typeof window === 'undefined' ? true : window.confirm(message)

const createExperienceDraft = (type = EXPERIENCE_OPTIONS[0]?.id) => {
  const config = EXPERIENCE_TYPES[type] ?? EXPERIENCE_OPTIONS[0]
  return { type, label: config?.label ?? '', description: '', price: String(config?.basePrice ?? '') }
}

const mapExperienceToDraft = (service) => ({
  type: service?.type ?? EXPERIENCE_OPTIONS[0]?.id ?? '',
  label: service?.label ?? '',
  description: service?.description ?? '',
  price: service?.price != null ? String(service.price) : '',
})

const createTalentDraft = () => ({
  name: '',
  category: TALENT_CATEGORY_OPTIONS[0] ?? '',
  subcategory: '',
  bio: '',
  location: '',
  responseTime: '72h',
  rating: '5.0',
  reviewCount: '0',
  completedBookings: '0',
  avatarUrl: '',
  shopLink: '',
  languages: 'English',
  tags: '',
})

const mapTalentToDraft = (talent) => ({
  name: talent?.name ?? '',
  category: talent?.category ?? TALENT_CATEGORY_OPTIONS[0] ?? '',
  subcategory: talent?.subcategory ?? '',
  bio: talent?.bio ?? '',
  location: talent?.location ?? '',
  responseTime: talent?.responseTime ?? '72h',
  rating: talent?.rating != null ? String(talent.rating) : '5.0',
  reviewCount: talent?.reviewCount != null ? String(talent.reviewCount) : '0',
  completedBookings:
    talent?.completedBookings != null ? String(talent.completedBookings) : '0',
  avatarUrl: talent?.avatarUrl ?? '',
  shopLink: talent?.shopLink ?? '',
  languages: Array.isArray(talent?.languages) ? talent.languages.join(', ') : '',
  tags: Array.isArray(talent?.tags) ? talent.tags.join(', ') : '',
})

const buildRosterHelperText = ({ hasSearchIntent, previewCount, resultCount, totalCount }) => {
  if (!totalCount) {
    return 'Create the first talent profile above and it will appear here.'
  }

  if (!hasSearchIntent) {
    if (totalCount <= previewCount) {
      return `All ${formatProfileCount(totalCount)} are shown below.`
    }

    return `Showing ${formatProfileCount(previewCount)} of ${totalCount}. Search by name, location, category, or tag to pull up the right talent faster.`
  }

  if (!resultCount) {
    return 'No live talent matches this search. Try a broader name, location, category, or tag.'
  }

  return `Showing all ${formatProfileCount(resultCount)} that match the current search.`
}

const renderEmptyState = (copy) => <div className="cp-message-preview">{copy}</div>

export default function TalentManagementDesk({ onRosterChange }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [activeSection, setActiveSection] = useState('roster')
  const [talentRoster, setTalentRoster] = useState([])
  const [talentRosterLoaded, setTalentRosterLoaded] = useState(false)
  const [selectedTalentId, setSelectedTalentId] = useState(null)
  const [editingTalentId, setEditingTalentId] = useState(null)
  const [editingExperienceId, setEditingExperienceId] = useState(null)
  const [talentDraft, setTalentDraft] = useState(createTalentDraft)
  const [experienceDraft, setExperienceDraft] = useState(() => createExperienceDraft())
  const [savingKey, setSavingKey] = useState('')

  useEffect(() => {
    let isMounted = true

    const syncTalentRoster = async () => {
      const roster = await getAllTalents()
      if (!isMounted) return

      setTalentRoster(roster)
      setTalentRosterLoaded(true)
      setSelectedTalentId((current) =>
        roster.some((talent) => talent.id === current) ? current : roster[0]?.id ?? null,
      )
    }

    syncTalentRoster()
    const unsubscribe = subscribeToTalentRoster(syncTalentRoster)

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (talentRosterLoaded) {
      onRosterChange?.(talentRoster)
    }
  }, [onRosterChange, talentRoster, talentRosterLoaded])

  const selectedTalent = useMemo(
    () => talentRoster.find((talent) => talent.id === selectedTalentId) ?? null,
    [selectedTalentId, talentRoster],
  )

  const currentExperience = useMemo(
    () => selectedTalent?.services.find((item) => item.id === editingExperienceId) ?? null,
    [editingExperienceId, selectedTalent],
  )

  useEffect(() => {
    if (editingTalentId && !talentRoster.some((talent) => talent.id === editingTalentId)) {
      setEditingTalentId(null)
      setTalentDraft(createTalentDraft())
    }
  }, [editingTalentId, talentRoster])

  useEffect(() => {
    if (editingExperienceId && !currentExperience) {
      setEditingExperienceId(null)
      setExperienceDraft(createExperienceDraft())
    }
  }, [currentExperience, editingExperienceId])

  const totalExperienceCount = useMemo(
    () => talentRoster.reduce((sum, talent) => sum + talent.services.length, 0),
    [talentRoster],
  )
  const totalEventBookingCount = useMemo(
    () => talentRoster.filter((talent) => talent.eventBooking?.available).length,
    [talentRoster],
  )
  const activeCategories = useMemo(
    () => new Set(talentRoster.map((talent) => talent.category).filter(Boolean)).size,
    [talentRoster],
  )
  const {
    activeCategory,
    allMatchingTalents,
    clearFilters,
    hasSearchIntent,
    resultCount,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
  } = useTalentFilters(talentRoster)
  const rosterPreviewTalents = useMemo(() => {
    const previewTalents = talentRoster.slice(0, ADMIN_ROSTER_PREVIEW_COUNT)

    if (!selectedTalent) {
      return previewTalents
    }

    if (previewTalents.some((talent) => talent.id === selectedTalent.id)) {
      return previewTalents
    }

    return [selectedTalent, ...previewTalents.slice(0, Math.max(ADMIN_ROSTER_PREVIEW_COUNT - 1, 0))]
  }, [selectedTalent, talentRoster])
  const rosterVisibleTalents = hasSearchIntent ? allMatchingTalents : rosterPreviewTalents
  const hiddenRosterCount = Math.max(talentRoster.length - rosterVisibleTalents.length, 0)
  const rosterHelperText = useMemo(
    () =>
      buildRosterHelperText({
        hasSearchIntent,
        previewCount: rosterVisibleTalents.length,
        resultCount,
        totalCount: talentRoster.length,
      }),
    [hasSearchIntent, resultCount, rosterVisibleTalents.length, talentRoster.length],
  )
  const focusableTalents = useMemo(() => {
    const nextTalents = hasSearchIntent ? allMatchingTalents : talentRoster

    if (!selectedTalent) {
      return nextTalents
    }

    return nextTalents.some((talent) => talent.id === selectedTalent.id)
      ? nextTalents
      : [selectedTalent, ...nextTalents]
  }, [allMatchingTalents, hasSearchIntent, selectedTalent, talentRoster])

  const updateDraft = (setter) => (field, value) => {
    setter((current) => ({ ...current, [field]: value }))
  }

  const updateTalentDraft = updateDraft(setTalentDraft)
  const updateExperienceDraft = updateDraft(setExperienceDraft)

  const focusTalent = (talent, { openSection = false } = {}) => {
    if (!talent) {
      return
    }

    setSelectedTalentId(talent.id)
    setEditingTalentId(talent.id)
    setTalentDraft(mapTalentToDraft(talent))

    if (openSection) {
      setActiveSection('roster')
    }
  }

  useEffect(() => {
    if (!hasSearchIntent || allMatchingTalents.length !== 1) {
      return
    }

    const [onlyMatch] = allMatchingTalents

    if (onlyMatch?.id === selectedTalentId) {
      return
    }

    focusTalent(onlyMatch)
  }, [allMatchingTalents, hasSearchIntent, selectedTalentId])

  const withSave = async (key, action, onSuccess, fallbackMessage) => {
    setSavingKey(key)

    try {
      const result = await action()
      onSuccess(result)
    } catch (error) {
      showToast(error.message || fallbackMessage, 'warning')
    } finally {
      setSavingKey('')
    }
  }

  const syncUpdatedTalent = (updatedTalent) => {
    setTalentRoster((current) => {
      const hasMatch = current.some((talent) => talent.id === updatedTalent.id)
      return hasMatch
        ? current.map((talent) => (talent.id === updatedTalent.id ? updatedTalent : talent))
        : [...current, updatedTalent]
    })
  }

  const resetTalentEditor = () => {
    setEditingTalentId(null)
    setTalentDraft(createTalentDraft())
  }

  const resetExperienceEditor = () => {
    setEditingExperienceId(null)
    setExperienceDraft(createExperienceDraft())
  }

  const startTalentEdit = (talent) => {
    focusTalent(talent, { openSection: true })
  }

  const startExperienceEdit = (item) => {
    setEditingExperienceId(item.id)
    setExperienceDraft(mapExperienceToDraft(item))
    setActiveSection('experiences')
  }

  const handleFocusedTalentChange = (event) => {
    const nextTalentId = Number(event.target.value)

    if (!Number.isFinite(nextTalentId)) {
      return
    }

    focusTalent(
      talentRoster.find((talent) => talent.id === nextTalentId) ?? null,
    )
  }

  const handleExperienceTypeChange = (event) => {
    const nextType = event.target.value
    const previousType = EXPERIENCE_TYPES[experienceDraft.type]
    const nextConfig = EXPERIENCE_TYPES[nextType]

    setExperienceDraft((current) => ({
      ...current,
      type: nextType,
      label:
        !current.label || current.label === previousType?.label
          ? nextConfig?.label ?? ''
          : current.label,
      price:
        !String(current.price ?? '').trim() || Number(current.price) === previousType?.basePrice
          ? String(nextConfig?.basePrice ?? '')
          : current.price,
    }))
  }

  const handleTalentSubmit = async (event) => {
    event.preventDefault()

    if (!talentDraft.name.trim()) {
      return showToast('Add the talent name before saving the profile.', 'warning')
    }

    if (!talentDraft.category.trim()) {
      return showToast('Choose a category before saving the profile.', 'warning')
    }

    if (!talentDraft.subcategory.trim()) {
      return showToast('Add a subcategory before saving the profile.', 'warning')
    }

    if (!talentDraft.bio.trim()) {
      return showToast('Add a short bio before saving the profile.', 'warning')
    }

    const parsedRating = Number(talentDraft.rating)
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return showToast('Set a public rating between 1.0 and 5.0 before saving.', 'warning')
    }

    const parsedReviewCount = Number(talentDraft.reviewCount)
    if (!Number.isFinite(parsedReviewCount) || parsedReviewCount < 0) {
      return showToast('Set a public review count of zero or higher before saving.', 'warning')
    }

    const parsedCompletedBookings = Number(talentDraft.completedBookings)
    if (!Number.isFinite(parsedCompletedBookings) || parsedCompletedBookings < 0) {
      return showToast('Set completed experiences to zero or higher before saving.', 'warning')
    }

    const payload = {
      ...talentDraft,
      rating: Number(parsedRating.toFixed(1)),
      reviewCount: Math.round(parsedReviewCount),
      completedBookings: Math.round(parsedCompletedBookings),
      languages: splitCommaSeparated(talentDraft.languages),
      tags: splitCommaSeparated(talentDraft.tags),
    }

    if (editingTalentId) {
      await withSave(
        'talent',
        () => updateTalent(editingTalentId, payload),
        (updatedTalent) => {
          syncUpdatedTalent(updatedTalent)
          setSelectedTalentId(updatedTalent.id)
          setTalentDraft(mapTalentToDraft(updatedTalent))
          showToast(`${updatedTalent.name} was updated.`, 'success')
        },
        'We could not update that talent right now.',
      )

      return
    }

    await withSave(
      'talent',
      () =>
        addTalent({
          ...payload,
          available: true,
          verified: true,
        }),
      (createdTalent) => {
        syncUpdatedTalent(createdTalent)
        setSelectedTalentId(createdTalent.id)
        resetTalentEditor()
        showToast(`${createdTalent.name} is now live in the roster.`, 'success')
      },
      'We could not publish that talent right now.',
    )
  }

  const handleTalentDelete = async (talent = selectedTalent) => {
    if (!talent) return

    if (
      !confirmInBrowser(
        `Delete ${talent.name} from the live roster? This will also remove the talent's experiences, event booking setup, and merch link.`,
      )
    ) {
      return
    }

    const nextSelectedTalentId =
      talentRoster.find((candidate) => candidate.id !== talent.id)?.id ?? null

    await withSave(
      `delete-talent-${talent.id}`,
      () => deleteTalent(talent.id),
      (removedTalent) => {
        setTalentRoster((current) => current.filter((candidate) => candidate.id !== removedTalent.id))
        setSelectedTalentId((current) => (current === removedTalent.id ? nextSelectedTalentId : current))

        if (editingTalentId === removedTalent.id) {
          resetTalentEditor()
        }

        showToast(`${removedTalent.name} was removed from the roster.`, 'success')
      },
      'We could not delete that talent right now.',
    )
  }

  const handleExperienceSubmit = async (event) => {
    event.preventDefault()

    const price = Number(experienceDraft.price)

    if (!selectedTalentId) {
      return showToast('Select a talent before adding an experience.', 'warning')
    }

    if (!experienceDraft.label.trim()) {
      return showToast('Add an experience label before saving.', 'warning')
    }

    if (!Number.isFinite(price) || price <= 0) {
      return showToast('Set a valid price greater than zero.', 'warning')
    }

    const payload = { ...experienceDraft, price }

    if (editingExperienceId) {
      await withSave(
        'experience',
        () => updateExperienceForTalent(selectedTalentId, editingExperienceId, payload),
        (updatedTalent) => {
          syncUpdatedTalent(updatedTalent)
          const refreshedExperience =
            updatedTalent.services.find((item) => item.id === editingExperienceId) ?? null

          if (refreshedExperience) {
            setExperienceDraft(mapExperienceToDraft(refreshedExperience))
          }

          showToast(`${payload.label.trim()} was updated.`, 'success')
        },
        'We could not update that experience right now.',
      )

      return
    }

    await withSave(
      'experience',
      () => addExperienceToTalent(selectedTalentId, payload),
      (updatedTalent) => {
        syncUpdatedTalent(updatedTalent)
        resetExperienceEditor()
        showToast(`Added ${payload.label.trim()} to ${updatedTalent.name}.`, 'success')
      },
      'We could not add that experience right now.',
    )
  }

  const handleExperienceDelete = async (item) => {
    if (!selectedTalentId || !item) return

    if (
      !confirmInBrowser(`Delete ${item.label}? This removes it from the talent's public booking options.`)
    ) {
      return
    }

    await withSave(
      `delete-experience-${item.id}`,
      () => deleteExperienceFromTalent(selectedTalentId, item.id),
      (updatedTalent) => {
        syncUpdatedTalent(updatedTalent)

        if (editingExperienceId === item.id) {
          resetExperienceEditor()
        }

        showToast(`${item.label} was removed.`, 'success')
      },
      'We could not delete that experience right now.',
    )
  }

  const selectedTalentChips = selectedTalent ? (
    <div className="cp-inline-trust" style={{ marginTop: 18 }}>
      <span className="cp-chip">{selectedTalent.services.length} experience{selectedTalent.services.length === 1 ? '' : 's'}</span>
      <span className="cp-chip">
        {selectedTalent.eventBooking?.available ? 'Event booking open' : 'Event booking hidden'}
      </span>
      <span className="cp-chip">{selectedTalent.shopLink ? 'Amazon merch ready' : 'Merch link pending'}</span>
      <span className="cp-chip">{selectedTalent.rating.toFixed(1)} rating</span>
      <span className="cp-chip">
        {selectedTalent.reviewCount.toLocaleString()} public review
        {selectedTalent.reviewCount === 1 ? '' : 's'}
      </span>
      <span className="cp-chip">
        {selectedTalent.completedBookings.toLocaleString()} completed experience
        {selectedTalent.completedBookings === 1 ? '' : 's'}
      </span>
      <span className="cp-chip">{selectedTalent.location || 'Location pending'}</span>
      <span className="cp-chip">{selectedTalent.responseTime || '72h'} response</span>
    </div>
  ) : null

  const sectionMetrics =
    activeSection === 'roster'
      ? [
          { value: talentRosterLoaded ? talentRoster.length : 'Loading', label: 'Live talent profiles' },
          { value: activeCategories, label: 'Active categories' },
          { value: selectedTalent?.name ?? 'Choose one', label: 'Selected profile' },
          { value: selectedTalent?.location ?? 'Pending', label: 'Profile location' },
        ]
      : activeSection === 'experiences'
        ? [
            { value: totalExperienceCount, label: 'Live experiences' },
            { value: selectedTalent?.services.length ?? 0, label: 'Experiences for selected talent' },
            { value: currentExperience?.label ?? 'Ready', label: 'Current experience' },
            { value: selectedTalent?.name ?? 'Choose one', label: 'Selected talent' },
          ]
        : activeSection === 'events'
          ? [
              { value: totalEventBookingCount, label: 'Profiles open for event enquiries' },
              {
                value: selectedTalent?.eventBooking?.available ? 'Open' : 'Hidden',
                label: 'Booking visibility',
              },
              {
                value: selectedTalent?.eventBooking?.appearanceFee
                  ? formatCurrency(selectedTalent.eventBooking.appearanceFee)
                  : 'Pending',
                label: 'Appearance fee',
              },
              { value: selectedTalent?.name ?? 'Choose one', label: 'Selected talent' },
            ]
          : [
              { value: talentRosterLoaded ? talentRoster.length : 'Loading', label: 'Live talent profiles' },
              { value: activeCategories, label: 'Active categories' },
              { value: selectedTalent?.name ?? 'Choose one', label: 'Selected profile' },
              { value: selectedTalent?.location ?? 'Pending', label: 'Profile location' },
            ]

  const renderRosterSection = () => (
    <>
      <article className="cp-info-card cp-surface">
        <span className="cp-eyebrow">Roster control</span>
        <h3>Manage the current talent profile and merch destination.</h3>
        <p className="cp-text-muted">
          The selected talent from the search above now drives the profile editor, experiences,
          roster notes, and event-booking admin flow.
        </p>
        {selectedTalent ? (
          <>
            <div className="cp-price-row" style={{ marginTop: 18 }}>
              <div>
                <strong>{selectedTalent.name}</strong>
                <span>
                  {selectedTalent.category}
                  {selectedTalent.subcategory ? ` / ${selectedTalent.subcategory}` : ''}
                </span>
              </div>
              <div className="cp-action-row">
                <button className="cp-btn cp-btn--ghost" onClick={resetTalentEditor} type="button">
                  <Plus size={14} />
                  Create new talent
                </button>
              </div>
            </div>
            {selectedTalentChips}
          </>
        ) : talentRosterLoaded ? (
          <div className="cp-message-preview" style={{ marginTop: 18 }}>
            Search for and select a talent above, or create your first talent profile here.
          </div>
        ) : (
          <div className="cp-message-preview" style={{ marginTop: 18 }}>
            Loading live talent profiles...
          </div>
        )}
      </article>

      <div style={PANEL_GRID_STYLE}>
        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">{editingTalentId ? 'Edit profile' : 'New talent'}</span>
          <h3>
            {editingTalentId && selectedTalent
              ? `Update ${selectedTalent.name}.`
              : 'Create a talent profile from admin.'}
          </h3>
          <p className="cp-text-muted">
            Keep public profile details, ratings, tags, and merch routing in one place.
          </p>
          <form onSubmit={handleTalentSubmit}>
            <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
              {[
                ['admin-talent-name', 'Talent name', 'Tems', 'name'],
                ['admin-talent-subcategory', 'Subcategory', 'Afrobeats / Soul', 'subcategory'],
                ['admin-talent-location', 'Location', 'Lagos, Nigeria', 'location'],
                ['admin-talent-response-time', 'Response time', '48h', 'responseTime'],
                ['admin-talent-avatar', 'Avatar image URL', 'https://...', 'avatarUrl'],
                ['admin-talent-merch-link', 'Amazon merch link', 'https://www.amazon.com/s?k=tems+merch', 'shopLink'],
                ['admin-talent-languages', 'Languages', 'English, Yoruba', 'languages'],
                ['admin-talent-tags', 'Highlight tags', 'Grammy Winner, Festival Headliner', 'tags'],
              ].map(([id, label, placeholder, field]) => (
                <div key={id} className="cp-field">
                  <label htmlFor={id}>{label}</label>
                  <input
                    id={id}
                    onChange={(nextEvent) => updateTalentDraft(field, nextEvent.target.value)}
                    placeholder={placeholder}
                    value={talentDraft[field]}
                  />
                </div>
              ))}
              <div className="cp-field">
                <label htmlFor="admin-talent-category">Category</label>
                <select
                  id="admin-talent-category"
                  onChange={(nextEvent) => updateTalentDraft('category', nextEvent.target.value)}
                  value={talentDraft.category}
                >
                  {TALENT_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cp-field">
                <label htmlFor="admin-talent-rating">Public rating</label>
                <input
                  id="admin-talent-rating"
                  max="5"
                  min="1"
                  onChange={(nextEvent) => updateTalentDraft('rating', nextEvent.target.value)}
                  placeholder="4.9"
                  step="0.1"
                  type="number"
                  value={talentDraft.rating}
                />
              </div>
              <div className="cp-field">
                <label htmlFor="admin-talent-review-count">Public review count</label>
                <input
                  id="admin-talent-review-count"
                  min="0"
                  onChange={(nextEvent) => updateTalentDraft('reviewCount', nextEvent.target.value)}
                  placeholder="2418"
                  step="1"
                  type="number"
                  value={talentDraft.reviewCount}
                />
              </div>
              <div className="cp-field">
                <label htmlFor="admin-talent-completed-bookings">Completed experiences</label>
                <input
                  id="admin-talent-completed-bookings"
                  min="0"
                  onChange={(nextEvent) =>
                    updateTalentDraft('completedBookings', nextEvent.target.value)
                  }
                  placeholder="2418"
                  step="1"
                  type="number"
                  value={talentDraft.completedBookings}
                />
              </div>
            </div>

            <div className="cp-field" style={{ marginTop: 18 }}>
              <label htmlFor="admin-talent-bio">Bio</label>
              <textarea
                id="admin-talent-bio"
                onChange={(nextEvent) => updateTalentDraft('bio', nextEvent.target.value)}
                placeholder="Add a concise profile summary that will appear on the public talent page."
                value={talentDraft.bio}
              />
            </div>

            <p className="cp-note">
              Public rating and review count stay editable here for imported or manually managed
              totals. New fan reviews submitted on the talent profile also append to the talent
              record so the backend has one place to read both aggregates and recent entries.
            </p>

            <div className="cp-queue-card-footer" style={{ marginTop: 18 }}>
              <div className="cp-meta-row">
                <span>
                  {talentRosterLoaded
                    ? `${talentRoster.length} profile${talentRoster.length === 1 ? '' : 's'} live`
                    : 'Loading profiles'}
                </span>
                <span>{user?.name ? `Working as ${user.name}` : 'Admin session'}</span>
              </div>
              <div className="cp-action-row">
                {editingTalentId ? (
                  <button className="cp-btn cp-btn--quiet" onClick={resetTalentEditor} type="button">
                    Create new talent
                  </button>
                ) : null}
                {editingTalentId && selectedTalent ? (
                  <button
                    className="cp-btn cp-btn--danger"
                    disabled={savingKey === `delete-talent-${selectedTalent.id}`}
                    onClick={() => handleTalentDelete(selectedTalent)}
                    type="button"
                  >
                    <Trash2 size={14} />
                    Delete talent
                  </button>
                ) : null}
                <button className="cp-btn cp-btn--primary" disabled={savingKey === 'talent'} type="submit">
                  {editingTalentId ? <PencilLine size={14} /> : <UserPlus size={14} />}
                  {savingKey === 'talent'
                    ? editingTalentId
                      ? 'Saving...'
                      : 'Publishing...'
                    : editingTalentId
                      ? 'Save profile'
                      : 'Publish talent'}
                </button>
              </div>
            </div>
          </form>
        </article>

        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">Roster structure</span>
          <h3>{selectedTalent ? `${selectedTalent.name} admin structure` : 'Use the other tabs for experiences and event booking.'}</h3>
          <p className="cp-text-muted">
            Keep this tab focused on public profile information while the other tabs use the same
            current talent for booking offers and event enquiries.
          </p>
          <ul className="cp-list" style={{ marginTop: 18 }}>
            <li>Use `Experiences` to add, edit, or delete booking offers for the current talent.</li>
            <li>Use `Event Booking` to manage public enquiry setup and incoming requests for the current talent.</li>
            <li>Use the Amazon merch link field on the current profile to control where the merch button opens.</li>
          </ul>
          <div className="cp-action-row" style={{ marginTop: 18 }}>
            <button className="cp-btn cp-btn--primary" onClick={() => setActiveSection('experiences')} type="button">
              Open experiences
            </button>
          </div>
        </article>
      </div>

        <article className="cp-info-card cp-surface">
          <div style={SECTION_HEADER_STYLE}>
            <span className="cp-eyebrow">Matching profiles</span>
            <h3>Search results now stay synced with the current talent focus.</h3>
            <p className="cp-text-muted">
              Use the talent search at the top of the management desk to change who you are
              working on here.
            </p>
          </div>

          {talentRoster.length ? (
            <>
              <div className="cp-inline-trust" style={{ marginTop: 18 }}>
                <span className="cp-chip">
                  {hasSearchIntent
                    ? `${resultCount.toLocaleString()} matching ${formatProfileCount(resultCount)}`
                    : hiddenRosterCount > 0
                      ? `Previewing ${rosterVisibleTalents.length} of ${talentRoster.length} live profiles`
                      : `Showing all ${formatProfileCount(talentRoster.length)}`}
                </span>
                {!hasSearchIntent && hiddenRosterCount > 0 ? (
                  <span className="cp-chip">Search or choose a category to surface the rest instantly</span>
                ) : null}
              </div>

              {rosterVisibleTalents.length ? (
                <div style={{ ...CARD_GRID_STYLE, marginTop: 18 }}>
                  {rosterVisibleTalents.map((talent) => (
                    <div
                      key={talent.id}
                      className="cp-surface cp-surface--soft"
                      style={{
                        ...CARD_STYLE,
                        borderColor:
                          selectedTalent?.id === talent.id ? 'rgba(201, 169, 98, 0.5)' : undefined,
                      }}
                    >
                      <div className="cp-price-row">
                        <div>
                          <strong>{talent.name}</strong>
                          <span>
                            {talent.category}
                            {talent.subcategory ? ` / ${talent.subcategory}` : ''}
                          </span>
                        </div>
                        <span>
                          {talent.startingPrice ? formatCurrency(talent.startingPrice) : 'No price yet'}
                        </span>
                      </div>

                      <p className="cp-text-muted">
                        {truncateText(
                          talent.bio || 'No profile summary has been added for this talent yet.',
                          150,
                        )}
                      </p>

                      <div className="cp-inline-trust">
                        <span className="cp-chip">{talent.location || 'Location pending'}</span>
                        <span className="cp-chip">{talent.services.length} experiences</span>
                        <span className="cp-chip">
                          {talent.eventBooking?.available ? 'Event booking open' : 'Event booking hidden'}
                        </span>
                        <span className="cp-chip">{talent.shopLink ? 'Amazon merch ready' : 'Merch link pending'}</span>
                      </div>

                      <div className="cp-action-row">
                        <button
                          className="cp-btn cp-btn--ghost"
                          onClick={() => startTalentEdit(talent)}
                          type="button"
                        >
                          <PencilLine size={14} />
                          {selectedTalent?.id === talent.id ? 'Current profile' : 'Open profile'}
                        </button>
                        <button
                          className="cp-btn cp-btn--danger"
                          disabled={savingKey === `delete-talent-${talent.id}`}
                          onClick={() => handleTalentDelete(talent)}
                          type="button"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 18 }}>
                  {renderEmptyState('No talent profiles match the current roster search yet.')}
                </div>
              )}
            </>
          ) : talentRosterLoaded ? (
            <div style={{ marginTop: 18 }}>
              {renderEmptyState('No talent profiles are live yet. Publish the first one above.')}
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              {renderEmptyState('Loading live talent profiles...')}
            </div>
          )}

        <div className="cp-inline-trust" style={{ marginTop: 18 }}>
          <span className="cp-chip">
            <Sparkles size={14} />
            Directory, profile, booking, event, and merch buttons all read from this roster
          </span>
        </div>
      </article>
    </>
  )

  const renderExperiencesSection = () => {
    if (!talentRoster.length) {
      return (
        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">Experiences</span>
          <h3>Publish a talent profile before creating booking offers.</h3>
          <p className="cp-text-muted">
            Experiences are attached to a talent profile, so start by creating the profile you want to publish.
          </p>
          <div className="cp-action-row" style={{ marginTop: 18 }}>
            <button className="cp-btn cp-btn--primary" onClick={() => setActiveSection('roster')} type="button">
              Open roster
            </button>
          </div>
        </article>
      )
    }

    return (
      <>
        <article className="cp-info-card cp-surface">
          <span className="cp-eyebrow">Experience management</span>
          <h3>{selectedTalent ? `Manage ${selectedTalent.name}'s bookable experiences.` : 'Manage bookable experiences.'}</h3>
          <p className="cp-text-muted">
            The current talent from the search above stays in focus here, so experience changes do
            not jump to a different profile.
          </p>

          {selectedTalentChips}
        </article>

        <div style={PANEL_GRID_STYLE}>
          <article className="cp-info-card cp-surface">
            <span className="cp-eyebrow">{editingExperienceId ? 'Edit experience' : 'New experience'}</span>
            <h3>
              {editingExperienceId && currentExperience
                ? `Update ${currentExperience.label}`
                : `Publish a booking offer for ${selectedTalent?.name ?? 'the selected talent'}.`}
            </h3>
            <p className="cp-text-muted">
              Set the label, description, type, and price for each experience.
            </p>

            <form onSubmit={handleExperienceSubmit}>
              <div className="cp-form-grid cp-form-grid--two" style={{ marginTop: 18 }}>
                <div className="cp-field">
                  <label htmlFor="admin-experience-type">Experience type</label>
                  <select
                    id="admin-experience-type"
                    onChange={handleExperienceTypeChange}
                    value={experienceDraft.type}
                  >
                    {EXPERIENCE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cp-field">
                  <label htmlFor="admin-experience-price">Price (USD)</label>
                  <input
                    id="admin-experience-price"
                    min="1"
                    onChange={(nextEvent) => updateExperienceDraft('price', nextEvent.target.value)}
                    placeholder="299"
                    step="1"
                    type="number"
                    value={experienceDraft.price}
                  />
                </div>
                <div className="cp-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="admin-experience-label">Experience label</label>
                  <input
                    id="admin-experience-label"
                    onChange={(nextEvent) => updateExperienceDraft('label', nextEvent.target.value)}
                    placeholder="VIP Listening Session"
                    value={experienceDraft.label}
                  />
                </div>
              </div>

              <div className="cp-field" style={{ marginTop: 18 }}>
                <label htmlFor="admin-experience-description">Description</label>
                <textarea
                  id="admin-experience-description"
                  onChange={(nextEvent) => updateExperienceDraft('description', nextEvent.target.value)}
                  placeholder="Describe what the fan receives, how long it lasts, and what makes it special."
                  value={experienceDraft.description}
                />
              </div>

              <div className="cp-queue-card-footer" style={{ marginTop: 18 }}>
                <div className="cp-meta-row">
                  <span>{selectedTalent?.services.length ?? 0} live experiences</span>
                  <span>
                    {selectedTalent?.startingPrice
                      ? `${formatCurrency(selectedTalent.startingPrice)} starting price`
                      : 'No starting price yet'}
                  </span>
                </div>
                <div className="cp-action-row">
                  {editingExperienceId ? (
                    <button className="cp-btn cp-btn--quiet" onClick={resetExperienceEditor} type="button">
                      Cancel edit
                    </button>
                  ) : null}
                  {editingExperienceId && currentExperience ? (
                    <button
                      className="cp-btn cp-btn--danger"
                      disabled={savingKey === `delete-experience-${currentExperience.id}`}
                      onClick={() => handleExperienceDelete(currentExperience)}
                      type="button"
                    >
                      <Trash2 size={14} />
                      Delete experience
                    </button>
                  ) : null}
                  <button
                    className="cp-btn cp-btn--primary"
                    disabled={savingKey === 'experience'}
                    type="submit"
                  >
                    {editingExperienceId ? <PencilLine size={14} /> : <Plus size={14} />}
                    {savingKey === 'experience'
                      ? 'Saving...'
                      : editingExperienceId
                        ? 'Save experience'
                        : 'Add experience'}
                  </button>
                </div>
              </div>
            </form>
          </article>

          <article className="cp-info-card cp-surface">
            <span className="cp-eyebrow">Current experiences</span>
            <h3>{selectedTalent?.name ?? 'Selected talent'} booking offers</h3>
            <p className="cp-text-muted">
              Review, edit, or remove each published experience from this list.
            </p>

            {selectedTalent?.services.length ? (
              <div style={{ ...CARD_GRID_STYLE, marginTop: 18 }}>
                {selectedTalent.services.map((service) => (
                  <div
                    key={service.id}
                    className="cp-surface cp-surface--soft"
                    style={{
                      ...CARD_STYLE,
                      borderColor:
                        editingExperienceId === service.id ? 'rgba(201, 169, 98, 0.5)' : undefined,
                    }}
                  >
                    <div className="cp-price-row">
                      <div>
                        <strong>{service.label}</strong>
                        <span>{EXPERIENCE_TYPES[service.type]?.label ?? service.type}</span>
                      </div>
                      <span>{formatCurrency(service.price)}</span>
                    </div>

                    <p className="cp-text-muted">
                      {service.description || 'No admin description has been added yet.'}
                    </p>

                    <div className="cp-inline-trust">
                      <span className="cp-chip">
                        {EXPERIENCE_TYPES[service.type]?.label ?? service.type}
                      </span>
                      <span className="cp-chip">
                        {selectedTalent.startingPrice === service.price ? 'Starting offer' : 'Premium offer'}
                      </span>
                    </div>

                    <div className="cp-action-row">
                      <button
                        className="cp-btn cp-btn--ghost"
                        onClick={() => startExperienceEdit(service)}
                        type="button"
                      >
                        <PencilLine size={14} />
                        Edit experience
                      </button>
                      <button
                        className="cp-btn cp-btn--danger"
                        disabled={savingKey === `delete-experience-${service.id}`}
                        onClick={() => handleExperienceDelete(service)}
                        type="button"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 18 }}>
                {renderEmptyState('No experiences have been published for this talent yet.')}
              </div>
            )}
          </article>
        </div>
      </>
    )
  }

  const renderEventsSection = () => (
    <EventBookingDesk
      selectedTalent={selectedTalent}
      talentRoster={talentRoster}
    />
  )

  return (
    <div style={DESK_STACK_STYLE}>
      <article className="cp-summary-card cp-surface cp-surface--accent">
        <span className="cp-eyebrow">Talent management</span>
        <h3>Manage roster, experiences, and event booking from one desk.</h3>
        <p className="cp-text-muted">
          Each profile also includes a single Amazon merch link for the public merch button.
        </p>

        <TalentSearchFilters
          activeCategory={activeCategory}
          helperText={rosterHelperText}
          onCategoryChange={setActiveCategory}
          onClear={clearFilters}
          onSearchChange={setSearchQuery}
          panelClassName="cp-filter-panel cp-surface cp-surface--soft"
          placeholder="Search and focus a talent by name, location, category, or tag"
          searchQuery={searchQuery}
        />

        {talentRoster.length ? (
          <div className="cp-form-grid cp-form-grid--two">
            <div className="cp-field">
              <label htmlFor="admin-management-talent-focus">Current talent focus</label>
              <select
                id="admin-management-talent-focus"
                onChange={handleFocusedTalentChange}
                value={selectedTalentId ?? ''}
              >
                {focusableTalents.map((talent) => (
                  <option key={talent.id} value={talent.id}>
                    {talent.name} / {talent.category}
                  </option>
                ))}
              </select>
            </div>

            <div className="cp-inline-trust" style={{ alignItems: 'end' }}>
              <span className="cp-chip">
                {selectedTalent?.name ?? 'Choose a talent'}
              </span>
              <span className="cp-chip">
                {hasSearchIntent
                  ? `${resultCount} matching result${resultCount === 1 ? '' : 's'}`
                  : `${talentRoster.length} live profile${talentRoster.length === 1 ? '' : 's'}`}
              </span>
              {selectedTalent?.eventBooking?.available ? (
                <span className="cp-chip">Event booking open</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="cp-metric-grid" style={{ marginTop: 20 }}>
          {sectionMetrics.map((metric) => (
            <div key={metric.label} className="cp-metric-card cp-surface cp-surface--soft">
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>

        <div className="cp-payment-tabs cp-payment-tabs--wrap" style={{ marginTop: 20 }}>
          {MANAGEMENT_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`cp-tab-button${activeSection === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveSection(tab.id)}
              type="button"
            >
              {tab.label}
              {' '}
              <span style={{ opacity: 0.74 }}>
                (
                {tab.id === 'roster'
                  ? talentRosterLoaded ? talentRoster.length : '...'
                  : tab.id === 'experiences'
                    ? totalExperienceCount
                    : totalEventBookingCount}
                )
              </span>
            </button>
          ))}
        </div>
      </article>

      {activeSection === 'roster'
        ? renderRosterSection()
        : activeSection === 'experiences'
          ? renderExperiencesSection()
          : renderEventsSection()}
    </div>
  )
}
