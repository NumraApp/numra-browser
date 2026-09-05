# @getnumra/browser

**The risk states, badge styling and request logic shared by the Numra packages for React, Vue, Svelte and Angular.**

[![npm version](https://img.shields.io/npm/v/@getnumra/browser)](https://www.npmjs.com/package/@getnumra/browser) [![npm downloads](https://img.shields.io/npm/dm/@getnumra/browser)](https://www.npmjs.com/package/@getnumra/browser) [![licence: MIT](https://img.shields.io/npm/l/@getnumra/browser)](LICENSE)

What `@getnumra/react`, `@getnumra/vue` and `@getnumra/svelte` share. You do not
normally install this directly — install the one for your framework.

```bash
npm install @getnumra/browser   # only if you are writing your own binding
```

Zero dependencies, no build step, and **no API key** — there is no option to
pass one and no code path that could use it. Numra reads a shared fraud
ledger, so a key in a bundle is a key in everyone's hands. This package talks
only to the endpoint your own server mounts.

## Why it exists

Four framework packages doing the same four things is four chances for one
of them to quietly stop doing one. Two of those things are not obvious, and
both had already gone wrong once:

- **A blacklisted number outranks its band.** It can still score MEDIUM on
  events alone, and rendering “Medium risk” for it is how a storefront ends up
  contradicting the control panel about the same number.
- **A late answer is dropped by identity, not by catching `AbortError`.** An
  abort landing while `res.json()` is still running does not always throw. The
  React hook was missing this until the Vue tests went looking for it — which
  is the whole argument for this package in one sentence.

Same reasoning as `createHandlers` in `@getnumra/core`: the logic that must not
drift between framework packages does not live in any of them.

It is deliberately **not** `@getnumra/core`. That package holds an API key and
refuses to run in a browser. Two cores, on opposite sides of the credential
boundary, is the point rather than an accident.

## Writing your own binding

```js
import { createCheckController, badgeParts } from '@getnumra/browser';

const controller = createCheckController({
  endpoint: '/api/numra',
  debounceMs: 400,
  onState: (s) => yourFrameworkSetState(s),   // { status, data, error }
});

controller.set(phone, enabled);   // whenever either changes
controller.refetch();             // a "check again" button
controller.dispose();             // on unmount — not optional
```

`badgeParts(check, { loading, showScore, style })` returns the label, the
score and three style objects, or `null` when there is nothing to show. Render
those and your badge matches every other Numra badge exactly. `styleString()`
converts a style object to CSS for templates that cannot take objects.

## Also exported

| | |
|---|---|
| `riskStateFor(check)` | the state name, or null |
| `RISK_STATES` | label and colours per state; every pair clears 4.5:1 |
| `checkPhone(phone, { endpoint, signal })` | one request, no debounce |
| `NumraRequestError` | carries `.code` and `.status` from your endpoint |
| `IDLE` | the starting state |

## Release notes

Every release is tagged and written up on the
[Releases page](https://github.com/NumraApp/numra-browser/releases). The same
history in one file is in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Bug reports and patches are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers
running the tests, the regression test a change is expected to bring with it,
and which repository a given fix actually belongs in.

## Security

Vulnerabilities go privately to the address in [SECURITY.md](SECURITY.md).
**Do not open a public issue for a security problem** — a public report is a
working exploit for every merchant running the released version until a fix
ships.

## The rest of the family

Twelve packages, one contract. The server side holds the API key; the browser
side calls the endpoint the server side mounts.

Server:

| Package | Repository |
|---|---|
| `@getnumra/core` | [numra-js-core](https://github.com/NumraApp/numra-js-core) |
| `@getnumra/express` | [numra-express](https://github.com/NumraApp/numra-express) |
| `@getnumra/fastify` | [numra-fastify](https://github.com/NumraApp/numra-fastify) |
| `@getnumra/next` | [numra-next](https://github.com/NumraApp/numra-next) |
| `@getnumra/nuxt` | [numra-nuxt](https://github.com/NumraApp/numra-nuxt) |
| `numra/numra-php` | [numra-php](https://github.com/NumraApp/numra-php) |
| `numra/laravel` | [numra-laravel](https://github.com/NumraApp/numra-laravel) |

Browser:

| Package | Repository |
|---|---|
| `@getnumra/browser` | [numra-browser](https://github.com/NumraApp/numra-browser) — this repo |
| `@getnumra/react` | [numra-react](https://github.com/NumraApp/numra-react) |
| `@getnumra/vue` | [numra-vue](https://github.com/NumraApp/numra-vue) |
| `@getnumra/svelte` | [numra-svelte](https://github.com/NumraApp/numra-svelte) |
| `@getnumra/angular` | [numra-angular](https://github.com/NumraApp/numra-angular) |

Documentation for all of them is at [numra.ma/docs](https://numra.ma/docs).

## Licence

MIT
