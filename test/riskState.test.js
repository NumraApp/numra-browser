import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riskStateFor, RISK_STATES } from '../src/riskState.js';
import { badgeParts } from '../src/badge.js';

test('a blacklisted number outranks whatever band it scored', () => {
  /* A blacklisted number can still compute MEDIUM from events alone.
     Rendering "Medium risk" for it is how a storefront ends up
     contradicting the control panel about the same number. */
  assert.equal(riskStateFor({ isBlacklisted: true, isRated: true, riskLevel: 'MEDIUM' }), 'BLOCKED');
});

test('an unrated number is not reported as low risk', () => {
  /* The distinction the whole product turns on: a stranger and a vetted
     customer both arrive with a low score. */
  assert.equal(riskStateFor({ isRated: false, riskLevel: 'LOW', riskScore: 12 }), 'UNRATED');
});

test('a rated number uses its band', () => {
  assert.equal(riskStateFor({ isRated: true, riskLevel: 'HIGH' }), 'HIGH');
  assert.equal(riskStateFor({ isRated: true, riskLevel: 'CRITICAL' }), 'CRITICAL');
});

test('an unknown band degrades to unrated rather than throwing', () => {
  assert.equal(riskStateFor({ isRated: true, riskLevel: 'BANANA' }), 'UNRATED');
});

test('a band that happens to name an Object.prototype member is not a band', () => {
  /* The lookup was a plain truthiness test, and RISK_STATES.constructor is a
     function. So these were accepted as real bands and rendered a badge with
     no label and no colour — a blank pill beside the number. */
  for (const inherited of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    assert.equal(
      riskStateFor({ isRated: true, riskLevel: inherited }),
      'UNRATED',
      `${inherited} was treated as a risk band`,
    );
    const b = badgeParts({ isRated: true, riskLevel: inherited });
    assert.equal(b.label, 'No history', `${inherited} produced a badge with no words`);
  }
});

test('unrated is the default, not something the server has to ask for', () => {
  /* This tested `isRated === false`, so a check that arrived without the
     field fell through to its band and a stranger was labelled "Low risk".
     Failing toward the confident, dangerous label is the one failure this
     function exists to prevent. */
  assert.equal(riskStateFor({ riskLevel: 'LOW' }), 'UNRATED', 'missing isRated');
  assert.equal(riskStateFor({ isRated: null, riskLevel: 'LOW' }), 'UNRATED', 'null isRated');
  assert.equal(riskStateFor({ isRated: undefined, riskLevel: 'LOW' }), 'UNRATED', 'undefined isRated');
  assert.equal(riskStateFor({ isRated: 0, riskLevel: 'LOW' }), 'UNRATED', '0 isRated');
  assert.equal(riskStateFor({ isRated: '', riskLevel: 'LOW' }), 'UNRATED', 'empty-string isRated');
  /* And it still reports the band when the server did say so. */
  assert.equal(riskStateFor({ isRated: true, riskLevel: 'LOW' }), 'LOW');
});

test('no result renders nothing', () => {
  assert.equal(riskStateFor(null), null);
  assert.equal(riskStateFor(undefined), null);
});

test('every state has legible text on its own background', () => {
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ratio = (a, b) => {
    const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const pairs = Object.entries(RISK_STATES).map(([name, s]) => [name, s.fg, s.bg]);

  /* The two states that are not verdicts live in badge.js rather than in the
     table, because neither is something a riskLevel may be. They are read out
     of the badge itself so they cannot be left out of this floor. */
  for (const options of [{ loading: true }, { error: new Error('503') }]) {
    const b = badgeParts(null, options);
    pairs.push([b.state, b.container.color, b.container.background]);
  }

  for (const [name, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    assert.ok(r >= 4.5, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1`);
  }
  assert.ok(pairs.some(([n]) => n === 'ERROR'), 'the error state was not covered');
});
