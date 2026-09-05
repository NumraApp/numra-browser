import { checkPhone } from './check.js';

/* ═══════════════════════════════════════════════════════════════════════════
   The lookup, as a state machine
   ───────────────────────────────────────────────────────────────────────────
   Debounce, abort, stale-answer rejection and the idle reset are identical in
   React, Vue and Svelte, and writing them three times means three chances to
   lose one. Two of them are not obvious:

     · A superseded request is ABORTED, not merely ignored. Typing a phone
       number otherwise fires a request per keystroke, and every one is
       billable.

     · A late answer is dropped by identity, not by catching AbortError. An
       abort that lands after the response resolved — while `res.json()` is
       still running — does not always throw, so checking the error is not
       enough. The operator would be shown the verdict for a number they
       already changed.

   The second one was missing from the React hook until the Vue tests went
   looking for it. Hence this file.

   Framework-free on purpose: it pushes a plain `{ status, data, error }`
   object at a callback, and each binding turns that into its own kind of
   reactive state.
   ═══════════════════════════════════════════════════════════════════════════ */

export const IDLE = Object.freeze({ status: 'idle', data: null, error: null });

/**
 * @param {{ endpoint?: string, debounceMs?: number,
 *           onState: (s: {status: string, data: object|null, error: Error|null}) => void,
 *           fetch?: typeof fetch }} options
 */
export function createCheckController(options) {
  const { endpoint = '/api/numra', debounceMs = 400, onState } = options;

  let controller = null;
  let timer = null;
  let current = null;
  let disposed = false;
  let inFlight = null;

  async function run(value) {
    if (disposed) return null;
    controller?.abort();
    controller = new AbortController();
    const mine = controller;

    onState({ status: 'loading', data: null, error: null });
    try {
      const data = await checkPhone(value, { endpoint, signal: mine.signal, fetch: options.fetch });
      if (disposed || mine !== controller) return null;
      onState({ status: 'success', data, error: null });
      return data;
    } catch (e) {
      if (disposed || mine !== controller || e.name === 'AbortError') return null;
      onState({ status: 'error', data: null, error: e });
      return null;
    }
  }

  return {
    /** Call whenever the phone or the enabled flag changes. */
    set(phone, enabled = true) {
      if (disposed) return;
      const changed = phone !== current;
      current = phone;
      clearTimeout(timer);

      if (!enabled || !phone) {
        /* Clearing the field drops the previous verdict. Leaving the old
           badge up beside an empty box says the blank field has a rating. */
        controller?.abort();
        controller = null;
        onState(IDLE);
        return;
      }

      if (changed) {
        /* The verdict on screen belongs to the number that WAS in the box.
           Only the timer was cleared here, so for the whole debounce window
           the old answer stayed up — and the in-flight request for it could
           still land and be committed. A green "Low risk" pill sat beside a
           blacklisted number for up to debounceMs, which is long enough to
           approve an order on.

           So: drop the old request and the old answer now, synchronously,
           before the wait. Loading rather than idle because a lookup IS
           coming — the badge should say "Checking…", not vanish. */
        controller?.abort();
        controller = null;
        onState({ status: 'loading', data: null, error: null });
      }

      timer = setTimeout(() => run(phone), debounceMs);
    },

    /** An explicit re-run, for a "check again" button. Skips the debounce. */
    refetch() {
      if (disposed || !current) return Promise.resolve(null);
      /* Every lookup is billable, and a "check again" button is exactly the
         thing an impatient operator clicks eight times. Callers get the
         request already on the wire rather than a ninth one. */
      if (inFlight) return inFlight;
      inFlight = run(current).finally(() => { inFlight = null; });
      return inFlight;
    },

    /** Unmount. No timer left holding state, no request nobody will read. */
    dispose() {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    },
  };
}
