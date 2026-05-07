import { useState } from 'react'

export default function TalentAvatar({
  talent,
  className = '',
  priority = 'auto',
  sizes = '58px',
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [useOriginalSource, setUseOriginalSource] = useState(false)
  const avatarClassName = className ? `cp-avatar ${className}` : 'cp-avatar'
  const initials = talent?.initials ?? talent?.name?.charAt(0) ?? '?'
  const optimizedImageSrc = talent?.avatarThumbnailUrl || talent?.avatarUrl || ''
  const originalImageSrc = talent?.avatarOriginalUrl || talent?.avatarUrl || ''
  const imageSrc = useOriginalSource ? originalImageSrc : optimizedImageSrc
  const imageSrcSet = talent?.avatarSrcSet || undefined
  const loadingStrategy = priority === 'high' ? 'eager' : 'lazy'
  const handleImageError = () => {
    if (!useOriginalSource && originalImageSrc && originalImageSrc !== optimizedImageSrc) {
      setUseOriginalSource(true)
      return
    }

    setImageFailed(true)
  }

  return (
    <div className={avatarClassName} style={{ background: talent?.gradient }}>
      {imageSrc && !imageFailed ? (
        <img
          alt={talent.name}
          className="cp-avatar-image"
          decoding="async"
          fetchPriority={priority}
          loading={loadingStrategy}
          onError={handleImageError}
          sizes={sizes}
          src={imageSrc}
          srcSet={useOriginalSource ? undefined : imageSrcSet}
        />
      ) : (
        initials
      )}
    </div>
  )
}
