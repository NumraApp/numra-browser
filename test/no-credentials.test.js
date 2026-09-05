import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'src');

/* Comments are stripped before scanning. The files explain at length WHY they
   hold no credential, and a scanner that cannot tell an explanation from an
   implementation would force those explanations to be deleted — which is the
   opposite of what should happen. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = fs.readdirSync(srcDir).map((f) => ({
  f,
  s: stripComments(fs.readFileSync(path.join(srcDir, f), 'utf8')),
}));
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));

/* ═══════════════════════════════════════════════════════════════════════════
   The invariant every browser package exists to hold
   ───────────────────────────────────────────────────────────────────────────
   Browser code must never hold a Numra credential and must never reach the
   Numra API. That is not a convention to remember during review — one careless
   "just add an apiKey option so it works standalone" and every merchant who
   upgrades ships their fraud-database key to every visitor.

   This copy matters most: react, vue and svelte all depend on this package, so
   a credential leaking in here leaks everywhere at once.

   If it ever fails, the fix is not to relax the test.
   ═══════════════════════════════════════════════════════════════════════════ */

test('no source file mentions an API key', () => {
  for (const { f, s } of files) {
    assert.ok(!/apiKey|api_key|API_KEY/.test(s), `${f} mentions an API key`);
    assert.ok(!/secret/i.test(s), `${f} mentions a secret`);
  }
});

test('no source file can reach the Numra API directly', () => {
  for (const { f, s } of files) {
    assert.ok(!/api\.numra\.ma/.test(s), `${f} targets the Numra API directly`);
    assert.ok(!/Authorization/i.test(s), `${f} sets an Authorization header`);
  }
});

test('the package does not depend on @getnumra/core', () => {
  /* @getnumra/core throws in a browser by design. Depending on it here would
     either break the bundle or tempt someone to remove that guard. */
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(!('@getnumra/core' in deps), '@getnumra/core must not be a dependency of a browser package');
});

test('the package has no dependencies at all', () => {
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});

test('requests go same-origin, to the merchant’s own endpoint', () => {
  const check = files.find((x) => x.f === 'check.js').s;
  assert.match(check, /credentials: 'same-origin'/);
  assert.match(check, /endpoint = '\/api\/numra'/);
});
