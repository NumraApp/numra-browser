import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPhone, NumraRequestError } from '../src/check.js';

/** A fetch stand-in that records what it was asked to do. */
function fakeFetch(response) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => {
        if (response.notJson) throw new SyntaxError('not json');
        return response.body;
      },
    };
  };
  f.calls = calls;
  return f;
}

test('it posts to the merchant endpoint, same-origin', () => {
  const f = fakeFetch({ status: 200, body: { riskLevel: 'HIGH' } });

  return checkPhone('0600000000', { fetch: f }).then((r) => {
    assert.equal(r.riskLevel, 'HIGH');
    const { url, init } = f.calls[0];
    assert.equal(url, '/api/numra/check');
    assert.equal(init.credentials, 'same-origin');
    assert.equal(JSON.parse(init.body).phone, '0600000000');
    /* No Authorization header, and nowhere to put a key even if someone
       wanted to. */
    assert.equal(init.headers.Authorization, undefined);
  });
});

test('a trailing slash on the endpoint does not become a double slash', () => {
  const f = fakeFetch({ status: 200, body: { isRated: false } });

  return checkPhone('0600000000', { endpoint: '/api/numra/', fetch: f }).then(() => {
    assert.equal(f.calls[0].url, '/api/numra/check');
  });
});

test('the server’s own error code survives to the caller', async () => {
  /* The server packages answer with NUMRA_NOT_CONFIGURED, FORBIDDEN,
     QUOTA_EXCEEDED and UPSTREAM_UNAVAILABLE. Throwing an error that says only
     "500" sends the integrator to their network tab instead of to the
     sentence the server already wrote for them. */
  const f = fakeFetch({
    status: 500,
    body: { error: 'NUMRA_NOT_CONFIGURED', message: 'This endpoint has no authorize function.' },
  });

  await assert.rejects(
    () => checkPhone('0600000000', { fetch: f }),
    (e) => {
      assert.ok(e instanceof NumraRequestError);
      assert.equal(e.code, 'NUMRA_NOT_CONFIGURED');
      assert.equal(e.status, 500);
      assert.match(e.message, /authorize/);
      return true;
    },
  );
});

test('an unparseable error body still throws something actionable', async () => {
  const f = fakeFetch({ status: 502, notJson: true });

  await assert.rejects(
    () => checkPhone('0600000000', { fetch: f }),
    (e) => {
      assert.equal(e.code, 'REQUEST_FAILED');
      assert.equal(e.status, 502);
      return true;
    },
  );
});

test('a 200 that is not a check is an error, not a verdict', async () => {
  /* Anything on the merchant's own origin can answer 200: a proxy that
     swallowed the route, an SSO login page, a CDN stub, a 204 from a bad
     rewrite. All of these used to be returned as-is and the badge rendered a
     confident grey "No history" for a number the server never looked at.
     Unrated and unanswered are not the same thing. */
  const bodies = [
    ['{} — an empty object', {}],
    ['[] — an array', []],
    ['a bare string', 'ok'],
    ['an HTML login page that did not parse', null],
    ['an unrelated JSON payload', { ok: true, user: 'admin' }],
    ['a number', 0],
  ];

  for (const [what, body] of bodies) {
    const f = fakeFetch({ status: 200, body, notJson: body === null });
    await assert.rejects(
      () => checkPhone('0600000000', { fetch: f }),
      (e) => {
        assert.ok(e instanceof NumraRequestError, `${what}: wrong error type`);
        assert.equal(e.code, 'MALFORMED_RESPONSE', `${what}: was accepted as a check`);
        assert.equal(e.status, 200);
        return true;
      },
      `${what} was accepted as a check`,
    );
  }
});

test('a real check still gets through on any one of its fields', async () => {
  for (const body of [{ isRated: false }, { riskLevel: 'HIGH' }, { verdict: 'ALLOW' }]) {
    const f = fakeFetch({ status: 200, body });
    assert.deepEqual(await checkPhone('0600000000', { fetch: f }), body);
  }
});

test('an abort signal is passed through', () => {
  /* Typing a phone number fires a request per keystroke, and each one is
     billable. A superseded request has to be abortable, not merely ignored. */
  const f = fakeFetch({ status: 200, body: { isRated: false } });
  const c = new AbortController();

  return checkPhone('06', { fetch: f, signal: c.signal }).then(() => {
    assert.equal(f.calls[0].init.signal, c.signal);
  });
});
