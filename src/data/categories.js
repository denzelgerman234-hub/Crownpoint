import { TALENT_CATEGORIES } from '../utils/constants'

export const categories = TALENT_CATEGORIES.map((label, index) => ({
  id: index,
  label,
  value: label === 'All' ? '' : label,
}))
