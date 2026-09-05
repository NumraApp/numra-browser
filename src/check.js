/* ═══════════════════════════════════════════════════════════════════════════
   Talking to YOUR backend
   ───────────────────────────────────────────────────────────────────────────
   This package never talks to api.numra.ma and cannot be made to. There is no
   apiKey option anywhere in it, by design: Numra reads a shared fraud ledger,
   and a key in a bundle is a key in everyone's hands.

   It talks to the endpoint one of the server packages mounts for you —
   @numra/express, fastify, next, nuxt, numra/laravel, or Numra\Handlers in
   plain PHP. All of them answer the same three paths with the same shapes,
   which is what makes one browser client enough for all of them.
   ═══════════════════════════════════════════════════════════════════════════ */

export class NumraRequestError extends Error {
  constructor(message, { code = 'REQUEST_FAILED', status = 0 } = {}) {
    super(message);
    this.name = 'NumraRequestError';
    /* The server packages return their own codes — NUMRA_NOT_CONFIGURED,
       FORBIDDEN, QUOTA_EXCEEDED, UPSTREAM_UNAVAILABLE. Branch on this, not
       on the message. */
    this.code = code;
    this.status = status;
  }
}

/* A 200 is not a check.
   ───────────────────────────────────────────────────────────────────────────
   Anything that answers on the merchant's own origin can return 200: a proxy
   that swallowed the route, an SSO login page, a CDN maintenance stub, a 204
   from a misconfigured rewrite. All of those parsed to `{}`, `[]` or a string
   and were handed to the badge, which rendered a confident grey "No history"
   for a number the server never looked at. Unrated and unanswered are not the
   same thing, so an unrecognisable body is an error, not a verdict. */
const CHECK_FIELDS = ['verdict', 'riskLevel', 'isRated'];

function looksLikeCheck(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return CHECK_FIELDS.some((k) => Object.hasOwn(body, k));
}

/**
 * Look up a phone number through your own backend.
 *
 * @param {string} phone
 * @param {{ endpoint?: string, signal?: AbortSignal, fetch?: typeof fetch }} [options]
 * @returns {Promise<object>} the narrowed check the server chose to expose
 * @throws {NumraRequestError}
 */
export async function checkPhone(phone, options = {}) {
  const { endpoint = '/api/numra', signal } = options;
  const f = options.fetch ?? globalThis.fetch;

  const res = await f(`${String(endpoint).replace(/\/+$/, '')}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    /* Same-origin by default: this is the merchant's own endpoint, and it is
       normally session-authenticated. */
    credentials: 'same-origin',
    body: JSON.stringify({ phone }),
    signal,
  });

  /* Parsed before the ok check, because the failure body is where the code
     is. A thrown error that says only "500" sends the integrator to their
     network tab instead of to the sentence the server already wrote. */
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    /* The failure body is usually an object, but an HTML error page parses to
       nothing and a proxy can answer with a bare string. Read the code out of
       it only when there is an object to read. */
    const detail = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    throw new NumraRequestError(detail.message || `Lookup failed (${res.status})`, {
      code: detail.error || 'REQUEST_FAILED',
      status: res.status,
    });
  }

  if (!looksLikeCheck(body)) {
    throw new NumraRequestError(
      `The endpoint answered ${res.status} with something that is not a check. ` +
        'Confirm it is the route one of the Numra server packages mounted.',
      { code: 'MALFORMED_RESPONSE', status: res.status },
    );
  }

  return body;
}
