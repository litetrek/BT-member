// Shared WHERE-clause builder for lantern queries — used by the list endpoint and the
// CSV export endpoint so their filtering logic can never drift apart.
// condition / display_decision accept comma-separated values (e.g. "Good,OK") for the
// Dashboard's Fair 2027 shortlist, which filters on more than one value at once;
// a single value still works the same as plain equality.
export function buildLanternWhere(q) {
  const { q: search, category_id, location_id, voltage, condition, displayable, status, display_decision } = q

  const where = []
  const params = []

  if (search) {
    params.push(`%${search}%`)
    const p = `$${params.length}`
    where.push(`(l.tag_id ILIKE ${p} OR l.name_zh ILIKE ${p} OR l.name_en ILIKE ${p})`)
  }
  if (category_id) { params.push(category_id); where.push(`l.category_id = $${params.length}`) }
  if (location_id) { params.push(location_id); where.push(`l.location_id = $${params.length}`) }
  if (voltage)      { params.push(voltage);      where.push(`l.voltage = $${params.length}`) }
  if (status)       { params.push(status);       where.push(`l.status = $${params.length}`) }
  if (condition)        { params.push(condition.split(',').filter(Boolean));        where.push(`l.condition = ANY($${params.length})`) }
  if (display_decision) { params.push(display_decision.split(',').filter(Boolean)); where.push(`l.display_decision = ANY($${params.length})`) }
  if (displayable === 'true' || displayable === 'false') {
    params.push(displayable === 'true')
    where.push(`l.displayable = $${params.length}`)
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}
