// Display eligibility for a lantern group — pure, client-safe, the single source of the
// rule. A group is not displayable when cloth OR frame damage reaches its threshold
// (damage % describes the group's worst unit). Thresholds come from inv_lantern_settings
// (see lib/inventorySettings.js); DEFAULT_THRESHOLDS are the pre-Phase-1 hard-coded values.

export const DEFAULT_THRESHOLDS = { cloth_pct: 30, frame_pct: 30 }

// Returns { displayable, reasons } — reasons are human-readable, e.g.
// "布面損壞 35% ≥ 門檻 30% Cloth damage". Empty when displayable.
export function evaluateDisplayability(lantern, thresholds = DEFAULT_THRESHOLDS) {
  const t = { ...DEFAULT_THRESHOLDS, ...(thresholds ?? {}) }
  const cloth = Number(lantern?.cloth_damage_pct ?? 0)
  const frame = Number(lantern?.frame_damage_pct ?? 0)
  const reasons = []
  if (cloth >= t.cloth_pct) reasons.push(`布面損壞 ${cloth}% ≥ 門檻 ${t.cloth_pct}% Cloth damage`)
  if (frame >= t.frame_pct) reasons.push(`骨架損壞 ${frame}% ≥ 門檻 ${t.frame_pct}% Frame damage`)
  return { displayable: reasons.length === 0, reasons }
}
