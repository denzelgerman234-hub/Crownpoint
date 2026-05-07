const palette = [
  { background: '#c9a962', foreground: '#061a10' },
  { background: '#2d7a58', foreground: '#f8f4ec' },
  { background: '#345f84', foreground: '#f8f4ec' },
  { background: '#7f5f3a', foreground: '#f8f4ec' },
]

export const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CP'

const getPaletteForName = (name = '') => {
  const hash = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

export const createAvatarDataUrl = (name = 'CrownPoint User') => {
  const initials = getInitials(name)
  const colors = getPaletteForName(name)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.background}" />
          <stop offset="100%" stop-color="#061a10" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#bg)" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        fill="${colors.foreground}"
        font-family="Cormorant Garamond, serif"
        font-size="58"
        letter-spacing="2"
      >
        ${initials}
      </text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
