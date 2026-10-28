// Natural sort for Lantern Inventory location codes — the one place location order is
// decided. Zone codes (A–E followed by a number) sort by zone letter, then numerically
// (A1, A2 … A10, A11), so A11 follows A10 instead of A1. Anything else (Cabin and other
// named spots) comes after every zone code, alphabetically.
// Pure + dependency-free so it can run in the browser, API routes and `node --test`.

const ZONE_CODE = /^([A-Ea-e])\s*-?\s*(\d+)$/

function parse(code) {
  const s = String(code ?? '').trim()
  const m = ZONE_CODE.exec(s)
  return m ? { zoned: true, zone: m[1].toUpperCase(), num: Number(m[2]), raw: s } : { zoned: false, raw: s }
}

export function compareLocationCodes(a, b) {
  const pa = parse(a)
  const pb = parse(b)
  if (pa.zoned && pb.zoned) {
    if (pa.zone !== pb.zone) return pa.zone < pb.zone ? -1 : 1
    if (pa.num !== pb.num) return pa.num - pb.num
    return pa.raw.localeCompare(pb.raw)
  }
  if (pa.zoned !== pb.zoned) return pa.zoned ? -1 : 1
  return pa.raw.localeCompare(pb.raw, 'en', { sensitivity: 'base', numeric: true })
}

// Returns a new array; accepts location objects ({ code }) or plain code strings.
export function sortLocations(locations) {
  return [...(locations ?? [])].sort((x, y) =>
    compareLocationCodes(typeof x === 'string' ? x : x?.code, typeof y === 'string' ? y : y?.code)
  )
}

// Groups already-sorted locations into [{ zone, items }] in sorted order, so a zone the
// UI doesn't know about yet (e.g. a new "F") still shows up instead of being dropped.
export function groupLocationsByZone(locations) {
  const groups = []
  for (const loc of sortLocations(locations)) {
    const zone = loc.zone || 'Other'
    let g = groups.find((x) => x.zone === zone)
    if (!g) { g = { zone, items: [] }; groups.push(g) }
    g.items.push(loc)
  }
  return groups
}
