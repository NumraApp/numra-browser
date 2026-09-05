# Contributing to @numra/browser

Patches are welcome. This package is what four front-end packages agree on, so
a change here changes what a merchant's storefront says about a phone number in
React, Vue, Svelte and Angular at once. The bar for a change is a test that
would have caught the bug, not a convincing description of it.

## Running the tests

```bash
npm install
npm test
```

Node 22.12 or newer, as `engines` declares. The suite is the built-in
`node:test` runner and there is nothing else to install; the tests stub
`fetch` rather than reaching a network.

## Every change needs a test

Every package in this family ships a regression suite, and it is the only
thing standing between a refactor and a silent behavioural change. So:

- A bug fix comes with a test that fails before it and passes after.
- A new export or option comes with a test that exercises it.
- A change to existing behaviour comes with the changed assertion, and the
  reason for the change in the commit message.

Two of the assertions here look fussy and are not:

- **A blacklisted number outranks its band.** It can still compute to MEDIUM
  on events alone, and rendering "Medium risk" for it is how a storefront ends
  up contradicting the control panel about the same number.
- **A late answer is dropped by identity, not by catching `AbortError`.** An
  abort landing while `res.json()` is still running does not always throw.

`test/riskState.test.js` also holds the contrast assertion for the palette —
every state's text must be legible on its own background — because the colours
are defined here and the four bindings only render them.

`test/no-credentials.test.js` fails the build if anything key-shaped or any
reference to the Numra API appears in the source. That test is the whole
credential boundary; do not weaken it to make something build.

## Which repository your fix belongs in

These repositories are split out of a single monorepo. What you see here is
one package of twelve, and this one is the shared floor for the browser side:
[numra-react](https://github.com/NumraApp/numra-react),
[numra-vue](https://github.com/NumraApp/numra-vue),
[numra-svelte](https://github.com/NumraApp/numra-svelte) and
[numra-angular](https://github.com/NumraApp/numra-angular) are bindings over
what is here.

So:

- Anything about *what a check means* — risk states, badge labels and colours,
  debounce, abort, request lifecycle — belongs **here**, not in the framework
  package you noticed it in. Fixing it in one of those four is how they drift.
- Anything framework-shaped — a hook, a composable, a store, a service, a
  component template — belongs in that framework's repository.

A fix that lands here reaches the four bindings as a version bump, so say in
the pull request which of them you expect to need re-releasing.

## The conformance gate

```bash
node scripts/openapi-conformance.js
```

This checks the package against the API contract and against itself. It fails
by default when no contract is vendored, on purpose: a conformance step that
goes green having compared nothing manufactures exactly the assurance it
exists to provide. Point `NUMRA_OPENAPI` at a copy of the spec, or drop it at
one of the paths the script lists, to make it run for real.

## House style

British spelling, no emoji in headings, and prose that says what a thing does
rather than how good it is. Comments explain the decision, not the syntax.

## Reporting a bug

Open an issue with the package version, the Node version, and the smallest
reproduction you can manage. **A security vulnerability is not a bug report**
— see [SECURITY.md](SECURITY.md) and mail it privately instead.
