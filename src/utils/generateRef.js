// ─── GENERATE UNIQUE PAYMENT REFERENCE ────────────────────
// Used client-side as placeholder until backend confirms
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const generateRef = (length = 6) => {
  let ref = ''
  for (let i = 0; i < length; i++) {
    ref += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return ref
}
