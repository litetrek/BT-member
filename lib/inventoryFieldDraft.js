// Local draft persistence for Field mode forms (Quick Inspect, New Lantern), so a
// dropped connection or accidental back-swipe on-site doesn't lose what was entered.
// Wrapped in try/catch — localStorage can throw (private browsing, quota) and a lost
// draft is far less bad than a crashed page.

const PREFIX = 'inv_lantern_field_draft:'

export function saveDraft(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // ignore — draft is best-effort
  }
}

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

// Which lantern ids have been checked (inspected or newly created) this walkthrough,
// per location — backs the "X of Y checked" progress line and survives a reload.
const CHECKED_PREFIX = 'inv_lantern_field_checked:'

export function getCheckedIds(locationCode) {
  try {
    const raw = localStorage.getItem(CHECKED_PREFIX + locationCode)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function markChecked(locationCode, lanternId) {
  const ids = getCheckedIds(locationCode)
  if (!ids.includes(lanternId)) ids.push(lanternId)
  try {
    localStorage.setItem(CHECKED_PREFIX + locationCode, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function clearChecked(locationCode) {
  try {
    localStorage.removeItem(CHECKED_PREFIX + locationCode)
  } catch {
    // ignore
  }
}
