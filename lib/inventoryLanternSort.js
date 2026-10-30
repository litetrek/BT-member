// Sort orders for the lantern list (燈籠列表). Pure + client-safe; tested in
// tests/inventoryLanternSort.test.mjs.
//   category  (default) — category order (as set in 管理), then English title
//   location            — natural location order (A1…A11, then named), unassigned last
//   condition           — Good → OK → Fair → Bad
// Ties always fall back to category → English title → tag ID, so the order is stable.
// "English title" = name_en, or name_zh when no English name is set (many lanterns have
// English typed into the Chinese field).
import { compareLocationCodes } from './inventoryLocationSort.js'

export const LANTERN_SORT_OPTIONS = [
  { value: 'category', label: '排序：類別 Category' },
  { value: 'location', label: '排序：地點 Location' },
  { value: 'condition', label: '排序：狀況 Condition' },
]
export const DEFAULT_LANTERN_SORT = 'category'

const CONDITION_ORDER = ['Good', 'OK', 'Fair', 'Bad']
const LAST = Number.MAX_SAFE_INTEGER

export function lanternTitle(l) {
  return String(l?.name_en || l?.name_zh || '').trim()
}

function rank(list, value) {
  const i = list.indexOf(value)
  return i === -1 ? LAST : i
}

function byTitle(a, b) {
  return lanternTitle(a).localeCompare(lanternTitle(b), 'en', { sensitivity: 'base', numeric: true })
    || String(a.tag_id ?? '').localeCompare(String(b.tag_id ?? ''), 'en', { numeric: true })
}

// categoryIds: category ids in display order (e.g. the /api/inventory/categories list).
// Lanterns with no category, or one not in the list, sort after the known ones.
export function sortLanterns(lanterns, sort = DEFAULT_LANTERN_SORT, categoryIds = []) {
  const byCategory = (a, b) =>
    rank(categoryIds, a.category_id) - rank(categoryIds, b.category_id)
    || String(a.category_name_en ?? a.category_name_zh ?? '').localeCompare(String(b.category_name_en ?? b.category_name_zh ?? ''))
  const byLocation = (a, b) => {
    if (!a.location_code !== !b.location_code) return a.location_code ? -1 : 1
    return a.location_code ? compareLocationCodes(a.location_code, b.location_code) : 0
  }
  const byCondition = (a, b) => rank(CONDITION_ORDER, a.condition) - rank(CONDITION_ORDER, b.condition)

  const chain = {
    category: [byCategory, byTitle],
    location: [byLocation, byCategory, byTitle],
    condition: [byCondition, byCategory, byTitle],
  }[sort] ?? [byCategory, byTitle]

  return [...(lanterns ?? [])].sort((a, b) => {
    for (const cmp of chain) {
      const r = cmp(a, b)
      if (r) return r
    }
    return 0
  })
}
