/* The badge's decision, separated from its rendering.
   ─────────────────────────────────────────────────────────────────────────
   Pure, so it can be tested without a DOM, and reusable by anyone building
   their own component. The two rules here are the ones that stop a surface
   contradicting the control panel — and they now live in ONE package rather
   than in four, because four copies of "blacklisted outranks the band" is
   four chances for one of them to quietly stop being true.

   Lifted out of @getnumra/react unchanged when @getnumra/vue and @getnumra/svelte
   arrived. Same argument as createHandlers in @getnumra/core: the logic that
   must not drift between framework packages does not live in any of them. */

export const RISK_STATES = Object.freeze({
  UNRATED:  { label: 'No history',  bg: '#EEF0F2', fg: '#3F4448', dot: '#9AA0A6' },
  LOW:      { label: 'Low risk',    bg: '#E7F6EF', fg: '#0B5B38', dot: '#3ECF8E' },
  MEDIUM:   { label: 'Medium risk', bg: '#FDF3E2', fg: '#6B4708', dot: '#E8B34B' },
  HIGH:     { label: 'High risk',   bg: '#FDECEC', fg: '#8A1F1F', dot: '#F26D6D' },
  CRITICAL: { label: 'Critical',    bg: '#FBE3E3', fg: '#6E1414', dot: '#D93838' },
  BLOCKED:  { label: 'Blacklisted', bg: '#171819', fg: '#FFFFFF', dot: '#FF9523' },
});

/**
 * Which visual state a check result should render as.
 * @param {{ isBlacklisted?: boolean, isRated?: boolean, riskLevel?: string }|null} check
 * @returns {keyof typeof RISK_STATES | null}
 */
export function riskStateFor(check) {
  if (!check) return null;

  /* Blacklisted outranks the band. A blacklisted number can still score
     MEDIUM on events alone, and rendering "Medium risk" for it is exactly
     how a storefront ends up disagreeing with the control panel — the same
     class of defect as reading phone_profiles instead of phone_verdict. */
  if (check.isBlacklisted) return 'BLOCKED';

  /* An unrated number and a genuinely clean one both arrive with a low
     score. Rendering "Low risk" for a stranger tells the merchant someone
     has been vetted when nobody has. Unrated gets its own words.

     Anything not truthy is unrated, not just an explicit `false`. This read
     `=== false`, so a check that arrived without the field — an older
     server, a narrower projection, a 0 — fell straight through to the band
     below and a stranger was rendered "Low risk". Unrated is the safe
     default; the confident label has to be earned. */
  if (!check.isRated) return 'UNRATED';

  /* Own property, not inherited. A plain lookup is truthy for 'constructor',
     '__proto__', 'toString', 'valueOf' and 'hasOwnProperty', so a riskLevel
     with one of those values was accepted as a band and rendered a badge
     with no label and no colour at all. */
  return Object.hasOwn(RISK_STATES, check.riskLevel) ? check.riskLevel : 'UNRATED';
}
