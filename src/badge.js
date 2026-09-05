import { RISK_STATES, riskStateFor } from './riskState.js';

/* What a risk badge looks like, as data.
   ─────────────────────────────────────────────────────────────────────────
   React, Vue and Svelte each render this differently, but they must render
   the SAME thing — a merchant running two of our packages on two pages
   should not see two badges. So the label, the colours and the geometry are
   decided here and each framework package only turns them into its own kind
   of element.

   Inline styles rather than classes so it works with no stylesheet in any
   setup. Every foreground/background pair clears 4.5:1. */

const BASE = Object.freeze({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
});

const DOT = Object.freeze({
  width: 7,
  height: 7,
  borderRadius: '50%',
  flexShrink: 0,
});

const SCORE = Object.freeze({ opacity: 0.75, fontVariantNumeric: 'tabular-nums' });

/* The two states that are not verdicts. Both are grey on purpose: whatever
   they say, they must not be readable as a rating. Same contrast floor as the
   real states — test/riskState.test.js checks all of them together. */
const NEUTRAL = Object.freeze({ bg: '#EEF0F2', fg: '#3F4448', dot: '#9AA0A6' });
const FAILED = Object.freeze({ bg: '#E6E8EB', fg: '#3A3F44', dot: '#767C82' });

/**
 * Everything a badge needs, or null when there is nothing to show.
 *
 * @param {object|null} check
 * @param {{ loading?: boolean, error?: unknown, showScore?: boolean, style?: object }} [options]
 * @returns {{ state: string, label: string, score: number|null,
 *             container: object, dot: object, scoreStyle: object } | null}
 */
export function badgeParts(check, options = {}) {
  const { loading = false, error = null, showScore = false, style = {} } = options;

  if (loading) {
    /* Its own state, not a greyed-out result. A badge that dims the previous
       answer while fetching the next one is showing a stale verdict for the
       number the operator is looking at right now. */
    return {
      state: 'LOADING',
      label: 'Checking…',
      score: null,
      container: { ...BASE, background: NEUTRAL.bg, color: NEUTRAL.fg, ...style },
      dot: { ...DOT, background: NEUTRAL.dot },
      scoreStyle: SCORE,
    };
  }

  if (error) {
    /* There was no error state at all, so a 403, a 503 QUOTA_EXCEEDED and a
       dead network rendered exactly what an empty field renders: nothing.
       The operator could not tell "this number has no history" from "we
       never got to ask", and the second one is the one that needs a human.

       The words say the check did not happen, never what the number is. */
    return {
      state: 'ERROR',
      label: 'Check unavailable',
      score: null,
      container: { ...BASE, background: FAILED.bg, color: FAILED.fg, ...style },
      dot: { ...DOT, background: FAILED.dot },
      scoreStyle: SCORE,
    };
  }

  const key = riskStateFor(check);
  if (!key) return null;
  const s = RISK_STATES[key];

  return {
    state: key,
    label: s.label,
    /* Only for a rated number, and only when it is actually a number. A score
       beside "No history" reads as a measurement, and there is nothing to
       measure — and an unchecked riskScore reached the renderer as whatever
       the server sent: NaN printed as the literal "NaN", and an object took
       the whole React tree down with "Objects are not valid as a React
       child". A badge must not be able to crash the page it sits on. */
    score: showScore && check.isRated && Number.isFinite(check.riskScore) ? check.riskScore : null,
    container: { ...BASE, background: s.bg, color: s.fg, ...style },
    dot: { ...DOT, background: s.dot },
    scoreStyle: SCORE,
  };
}

/** The same styles as a CSS string, for templates that cannot take objects. */
export function styleString(obj) {
  return Object.entries(obj)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      /* Unitless numbers get px, the way React does it — except for the
         properties where a bare number is already correct. */
      const unitless = ['opacity', 'fontWeight', 'lineHeight', 'zIndex', 'flexShrink'];
      const val = typeof v === 'number' && !unitless.includes(k) ? `${v}px` : v;
      return `${prop}:${val}`;
    })
    .join(';');
}
