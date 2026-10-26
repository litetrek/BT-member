// Shared constants for the Lantern Inventory module. Client-safe (no server-only imports).

// A lantern group is hidden from the display shortlist when cloth OR frame damage
// reaches this threshold. One config constant so management can change it later.
export const NOT_DISPLAYABLE_DAMAGE_PCT = 30

export const VOLTAGE_OPTIONS = ['AC110V', 'DC24V']
export const CONDITION_OPTIONS = ['Good', 'OK', 'Fair', 'Bad']
export const STATUS_OPTIONS = ['Active', 'Retired', 'Missing']
export const DISPLAY_DECISION_OPTIONS = ['Candidate', 'Selected', 'Needs repair', 'Not this year']

// A group's damage % describes its worst unit, so this rule never hides a damaged lantern.
export function computeDisplayable(clothDamagePct, frameDamagePct) {
  return clothDamagePct < NOT_DISPLAYABLE_DAMAGE_PCT && frameDamagePct < NOT_DISPLAYABLE_DAMAGE_PCT
}
