/* @getnumra/browser — everything the browser packages share and nothing else.

   Depended on by @getnumra/react, @getnumra/vue and @getnumra/svelte. Deliberately NOT
   @getnumra/core: that package holds an API key and refuses to run in a browser,
   and this one must never be able to. Two cores, on opposite sides of the
   credential boundary, is the point rather than an accident. */

export { RISK_STATES, riskStateFor } from './riskState.js';
export { badgeParts, styleString } from './badge.js';
export { checkPhone, NumraRequestError } from './check.js';
export { createCheckController, IDLE } from './controller.js';
