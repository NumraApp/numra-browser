import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckController } from '../src/controller.js';

const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const RATED = { isRated: true, riskLevel: 'HIGH', riskScore: 72 };

/** A fetch stand-in. `plan(n)` decides how each call answers. */
function fakeFetch(plan) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init, phone: JSON.parse(init.body).phone });
    return plan(calls.length, init);
  };
  f.calls = calls;
  return f;
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

/** Collects every state the controller pushes. */
function harness(fetchImpl, opts = {}) {
  const states = [];
  const c = createCheckController({
    debounceMs: 10,
    fetch: fetchImpl,
    onState: (s) => states.push(s),
    ...opts,
  });
  return { c, states, last: () => states[states.length - 1] };
}

test('typing fires one lookup, not one per keystroke', async () => {
  /* Every lookup is billable. Without the debounce a merchant pays for every
     prefix their operator typed. */
  const f = fakeFetch(() => ok(RATED));
  const { c, last } = harness(f);

  c.set('06');
  c.set('060');
  c.set('0600000000');
  await tick(40);

  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].phone, '0600000000');
  assert.equal(last().status, 'success');
  c.dispose();
});

test('a slow earlier answer cannot overwrite a newer one', async () => {
  /* THE bug this file exists for. The first lookup takes 80ms, the second
     5ms. Catching AbortError is not enough — an abort landing while
     res.json() is still running does not always throw — so the late answer is
     dropped by controller identity instead. Without that, the operator is
     shown the verdict for a number they already changed. */
  const f = fakeFetch(async (n, init) => {
    const phone = JSON.parse(init.body).phone;
    await tick(n === 1 ? 80 : 5);
    return ok({ ...RATED, phone, riskLevel: n === 1 ? 'LOW' : 'CRITICAL' });
  });
  const { c, last } = harness(f, { debounceMs: 1 });

  c.set('0611111111');
  await tick(20);
  c.set('0622222222');
  await tick(140);

  assert.equal(last().data.phone, '0622222222');
  assert.equal(last().data.riskLevel, 'CRITICAL');
  c.dispose();
});

test('a superseded request is aborted, not merely ignored', async () => {
  let aborted = 0;
  const f = fakeFetch(async (_n, init) => {
    init.signal.addEventListener('abort', () => { aborted += 1; });
    await tick(100);
    return ok(RATED);
  });
  const { c } = harness(f, { debounceMs: 1 });

  c.set('0611111111');
  await tick(20);
  c.set('0622222222');
  await tick(20);

  assert.equal(aborted, 1, 'the first request was cancelled on the wire');
  c.dispose();
});

test('clearing the field drops the previous verdict', async () => {
  /* Leaving the old badge up beside an empty box says the blank field has a
     rating. */
  const f = fakeFetch(() => ok(RATED));
  const { c, last } = harness(f, { debounceMs: 1 });

  c.set('0600000000');
  await tick(30);
  assert.equal(last().status, 'success');

  c.set('');
  assert.equal(last().status, 'idle');
  assert.equal(last().data, null);
  c.dispose();
});

test('enabled: false holds the lookup until it is true', async () => {
  const f = fakeFetch(() => ok(RATED));
  const { c, last } = harness(f, { debounceMs: 1 });

  c.set('0600000000', false);
  await tick(20);
  assert.equal(f.calls.length, 0);

  c.set('0600000000', true);
  await tick(30);
  assert.equal(f.calls.length, 1);
  assert.equal(last().status, 'success');
  c.dispose();
});

test('dispose cancels and stops answering', async () => {
  /* A component that unmounts mid-lookup must not leave a timer holding its
     state, nor push a state change at a listener that is gone. */
  let aborted = false;
  const f = fakeFetch(async (_n, init) => {
    init.signal.addEventListener('abort', () => { aborted = true; });
    await tick(60);
    return ok(RATED);
  });
  const { c, states } = harness(f, { debounceMs: 1 });

  c.set('0600000000');
  await tick(20);
  const before = states.length;
  c.dispose();
  await tick(80);

  assert.equal(aborted, true);
  assert.equal(states.length, before, 'no state pushed after dispose');
});

test('refetch skips the debounce and reuses the current number', async () => {
  const f = fakeFetch(() => ok(RATED));
  const { c } = harness(f, { debounceMs: 500 });

  c.set('0600000000');
  await c.refetch();

  assert.equal(f.calls.length, 1, 'fired immediately, not after 500ms');
  assert.equal(f.calls[0].phone, '0600000000');
  c.dispose();
});

test('the previous verdict comes down the moment the number changes', async () => {
  /* Only the timer was cleared when the value changed, so for the whole
     debounce window the answer for the PREVIOUS number stayed on screen —
     and the request for it was still on the wire, free to land and be
     committed. A green "Low risk" pill sat beside a blacklisted number for
     up to debounceMs, which is long enough to approve an order on.

     A realistic debounce is the whole point: the old test used 1ms, which is
     why it never saw this. */
  let aborted = 0;
  const f = fakeFetch(async (n, init) => {
    init.signal.addEventListener('abort', () => { aborted += 1; });
    /* The first answer lands during the second number's debounce window. */
    await tick(n === 1 ? 30 : 5);
    return ok({ ...RATED, phone: JSON.parse(init.body).phone, riskLevel: n === 1 ? 'LOW' : 'CRITICAL' });
  });
  const { c, last } = harness(f, { debounceMs: 300 });

  c.set('0611111111');
  await tick(340);
  assert.equal(last().status, 'success');
  assert.equal(last().data.riskLevel, 'LOW', 'the first number is rated LOW');

  c.set('0699999999');
  /* Synchronously, before anything is awaited: the LOW verdict must already
     be gone, because it is not this number's. */
  assert.notEqual(last().status, 'success', 'the old verdict survived the change');
  assert.equal(last().data, null, 'the old answer was still on screen');

  /* And nothing the old request does can put it back. */
  await tick(100);
  assert.equal(last().data, null, 'a stale answer landed during the debounce');
  assert.equal(aborted, 1, 'the superseded request was left running');

  await tick(300);
  assert.equal(last().data.riskLevel, 'CRITICAL');
  c.dispose();
});

test('an error also comes down the moment the number changes', async () => {
  const f = fakeFetch(async () => ({
    ok: false, status: 403, json: async () => ({ error: 'FORBIDDEN', message: 'no' }),
  }));
  const { c, last } = harness(f, { debounceMs: 200 });

  c.set('0611111111');
  await tick(240);
  assert.equal(last().status, 'error');

  c.set('0699999999');
  assert.equal(last().error, null, 'the previous number’s failure stayed on screen');
  c.dispose();
});

test('eight refetches in one tick are one lookup, not eight bills', async () => {
  /* A "check again" button is exactly the thing an impatient operator clicks
     eight times, and every one of those was a real, billable request. */
  const f = fakeFetch(async () => { await tick(30); return ok(RATED); });
  const { c } = harness(f, { debounceMs: 500 });

  c.set('0600000000');
  const all = await Promise.all([c.refetch(), c.refetch(), c.refetch(), c.refetch(),
    c.refetch(), c.refetch(), c.refetch(), c.refetch()]);

  assert.equal(f.calls.length, 1, `${f.calls.length} requests went out`);
  /* Every caller gets the same answer, not a null for turning up late. */
  for (const r of all) assert.equal(r.riskLevel, 'HIGH');

  /* And once it has settled, a later click is allowed to ask again. */
  await c.refetch();
  assert.equal(f.calls.length, 2);
  c.dispose();
});

test('refetch with nothing to check does nothing', async () => {
  const f = fakeFetch(() => ok(RATED));
  const { c } = harness(f);

  assert.equal(await c.refetch(), null);
  assert.equal(f.calls.length, 0);
  c.dispose();
});

test('a failing endpoint surfaces the server’s own code', async () => {
  const f = fakeFetch(async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'NUMRA_NOT_CONFIGURED', message: 'This endpoint has no authorize function.' }),
  }));
  const { c, last } = harness(f, { debounceMs: 1 });

  c.set('0600000000');
  await tick(30);

  assert.equal(last().status, 'error');
  assert.equal(last().error.code, 'NUMRA_NOT_CONFIGURED');
  assert.equal(last().data, null);
  c.dispose();
});
