const DEFAULT_AVATAR_WIDTHS = [120, 250, 500]

const cleanText = (value) =>
  String(value ?? '')
    .trim()

const normalizeWikimediaFileName = (value) =>
  cleanText(value)
    .replace(/\s+/g, '_')

const decodePathSegment = (value) => {
  const normalizedValue = cleanText(value)

  if (!normalizedValue) {
    return ''
  }

  try {
    return decodeURIComponent(normalizedValue.replace(/\+/g, '%20'))
  } catch {
    return normalizedValue.replace(/\+/g, ' ')
  }
}

const extractWikimediaFileName = (value) => {
  const normalizedUrl = cleanText(value)

  if (!normalizedUrl) {
    return ''
  }

  const specialFilePathMatch = normalizedUrl.match(
    /https?:\/\/commons\.wikimedia\.org\/wiki\/Special:(?:FilePath|Redirect\/file)\/([^?#]+)/i,
  )

  if (specialFilePathMatch) {
    return normalizeWikimediaFileName(decodePathSegment(specialFilePathMatch[1]))
  }

  const uploadPathMatch = normalizedUrl.match(
    /https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i,
  )

  if (uploadPathMatch) {
    return normalizeWikimediaFileName(decodePathSegment(uploadPathMatch[1]))
  }

  return ''
}

const buildWikimediaThumbUrl = (fileName, width) => {
  const normalizedFileName = normalizeWikimediaFileName(fileName)

  if (!normalizedFileName) {
    return ''
  }

  const encodedFileName = encodeURIComponent(normalizedFileName)

  return `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodedFileName}&width=${width}`
}

export const buildOptimizedAvatarSources = (
  value,
  widths = DEFAULT_AVATAR_WIDTHS,
) => {
  const originalUrl = cleanText(value).replace(/^http:\/\//i, 'https://')

  if (!originalUrl) {
    return {
      avatarOriginalUrl: '',
      avatarThumbnailUrl: '',
      avatarSrcSet: '',
    }
  }

  const wikimediaFileName = extractWikimediaFileName(originalUrl)

  if (!wikimediaFileName) {
    return {
      avatarOriginalUrl: originalUrl,
      avatarThumbnailUrl: originalUrl,
      avatarSrcSet: '',
    }
  }

  const uniqueWidths = [...new Set(widths.map((width) => Number(width)).filter((width) => width > 0))]
    .sort((left, right) => left - right)
  const previewWidth =
    uniqueWidths.find((width) => width >= 250) ?? uniqueWidths[uniqueWidths.length - 1]
  const avatarSrcSet = uniqueWidths
    .map((width) => `${buildWikimediaThumbUrl(wikimediaFileName, width)} ${width}w`)
    .join(', ')

  return {
    avatarOriginalUrl: originalUrl,
    avatarThumbnailUrl: buildWikimediaThumbUrl(wikimediaFileName, previewWidth),
    avatarSrcSet,
  }
}
