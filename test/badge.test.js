import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeParts, styleString } from '../src/badge.js';
import { RISK_STATES } from '../src/riskState.js';

const rated = { isRated: true, riskLevel: 'HIGH', riskScore: 72 };

test('loading is its own state, not a dimmed previous answer', () => {
  /* A badge that greys out the last result while fetching the next one is
     showing a verdict for a different number than the one on screen. */
  const b = badgeParts(rated, { loading: true });
  assert.equal(b.state, 'LOADING');
  assert.equal(b.label, 'Checking…');
  assert.equal(b.score, null);
});

test('nothing to show renders nothing', () => {
  assert.equal(badgeParts(null), null);
});

test('the score appears only when the number is rated', () => {
  assert.equal(badgeParts(rated, { showScore: true }).score, 72);
  /* "No history 12" reads as a measurement, and there is nothing measured. */
  assert.equal(badgeParts({ isRated: false, riskLevel: 'LOW', riskScore: 12 }, { showScore: true }).score, null);
  assert.equal(badgeParts(rated).score, null, 'off by default');
});

test('a score that is not a finite number never reaches the renderer', () => {
  /* This was passed through unchecked. NaN rendered as the literal word
     "NaN" beside "High risk", and an object took the whole React tree down
     with "Objects are not valid as a React child" — a badge that crashes the
     checkout page it was added to. */
  for (const riskScore of [NaN, Infinity, -Infinity, null, undefined, '72', {}, [], { value: 72 }]) {
    const b = badgeParts({ isRated: true, riskLevel: 'HIGH', riskScore }, { showScore: true });
    assert.equal(b.score, null, `${JSON.stringify(riskScore) ?? String(riskScore)} was passed through`);
    assert.equal(b.label, 'High risk', 'the label still renders');
  }
  /* A real score is still a real score, including zero. */
  assert.equal(badgeParts({ isRated: true, riskLevel: 'LOW', riskScore: 0 }, { showScore: true }).score, 0);
});

test('a failed lookup says the check did not run', () => {
  /* There was no error state at all, so badgeParts returned null and a 403,
     a 503 QUOTA_EXCEEDED and a dead network rendered exactly what an empty
     field renders: nothing. The operator could not tell "this number has no
     history" from "we never got to ask". */
  const b = badgeParts(null, { error: new Error('QUOTA_EXCEEDED') });
  assert.notEqual(b, null, 'a failed lookup rendered nothing at all');
  assert.equal(b.state, 'ERROR');
  assert.equal(b.label, 'Check unavailable');
  assert.equal(b.score, null);
  /* Whatever it says, it must not be readable as a verdict. */
  for (const s of Object.values(RISK_STATES)) {
    assert.notEqual(b.label, s.label);
    assert.notEqual(b.container.background, s.bg, `the error pill wears ${s.label}'s colour`);
  }
});

test('an error outranks a stale result but not a request in flight', () => {
  /* A result on screen with an error beside it is the previous number's
     answer; saying the check failed is honest, showing its verdict is not. */
  assert.equal(badgeParts(rated, { error: new Error('boom') }).state, 'ERROR');
  /* While a retry is actually running, "Checking…" is the truer sentence. */
  assert.equal(badgeParts(rated, { error: new Error('boom'), loading: true }).state, 'LOADING');
  assert.equal(badgeParts(rated, { error: null }).state, 'HIGH', 'no error, no change');
});

test('a caller style reaches the error state too', () => {
  const b = badgeParts(null, { error: new Error('boom'), style: { fontSize: 16 } });
  assert.equal(b.container.fontSize, 16);
  assert.equal(b.container.display, 'inline-flex');
});

test('a blacklisted number carries the blocked colours, not the band ones', () => {
  const b = badgeParts({ isBlacklisted: true, isRated: true, riskLevel: 'MEDIUM' });
  assert.equal(b.label, 'Blacklisted');
  assert.equal(b.container.background, '#171819');
});

test('a caller style overrides the container without losing the base', () => {
  const b = badgeParts(rated, { style: { fontSize: 16, background: 'red' } });
  assert.equal(b.container.fontSize, 16);
  assert.equal(b.container.background, 'red');
  assert.equal(b.container.display, 'inline-flex', 'base geometry survives');
});

test('the base object is not mutated between calls', () => {
  /* Spread, not assign. One badge with a custom style must not repaint every
     other badge on the page. */
  badgeParts(rated, { style: { background: 'red' } });
  assert.equal(badgeParts(rated).container.background, '#FDECEC');
});

test('styleString produces CSS a template can use', () => {
  const css = styleString({ fontSize: 13, fontWeight: 600, opacity: 0.75, borderRadius: '50%' });
  assert.match(css, /font-size:13px/);
  assert.match(css, /border-radius:50%/);
  /* Unitless properties must not get px. `font-weight:600px` is ignored by
     every browser, so the badge would silently render at normal weight. */
  assert.match(css, /font-weight:600(;|$)/);
  assert.match(css, /opacity:0\.75(;|$)/);
});

test('every framework package renders the same badge', () => {
  /* The reason this package exists. A merchant running @getnumra/react on one
     page and @getnumra/vue on another must not see two different badges, so the
     label, the colours and the geometry are decided once, here. */
  const b = badgeParts(rated);
  assert.deepEqual(Object.keys(b).sort(), ['container', 'dot', 'label', 'score', 'scoreStyle', 'state']);
  assert.equal(b.dot.background, '#F26D6D');
  assert.equal(b.container.borderRadius, 999);
});
