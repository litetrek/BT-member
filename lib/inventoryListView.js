// The lantern list's current view (filters + sort), saved in this browser so that
//   - 燈籠列表 reopens with the same filters/sort, and
//   - a lantern's detail page can step to the previous/next lantern in that same order.
// Client-only; every storage access is wrapped because localStorage can throw
// (private browsing, storage disabled).
import { LANTERN_SORT_OPTIONS, DEFAULT_LANTERN_SORT } from '@/lib/inventoryLanternSort'

export const EMPTY_FILTERS = { q: '', category_id: '', location_id: '', voltage: '', condition: '', status: '', displayable: '' }
const VIEW_KEY = 'inv_lantern_list_view'

export function loadListView() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null')
    if (!v || typeof v !== 'object') return null
    const filters = { ...EMPTY_FILTERS }
    for (const k of Object.keys(EMPTY_FILTERS)) if (typeof v.filters?.[k] === 'string') filters[k] = v.filters[k]
    const sort = LANTERN_SORT_OPTIONS.some((o) => o.value === v.sort) ? v.sort : DEFAULT_LANTERN_SORT
    return { filters, sort }
  } catch { return null }
}

export function saveListView(filters, sort) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify({ filters, sort })) } catch {}
}

export function filtersToQuery(filters) {
  return new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => v !== '')).toString()
}

export function hasActiveFilters(filters) {
  return Object.values(filters ?? {}).some((v) => v !== '')
}
