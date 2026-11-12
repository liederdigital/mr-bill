import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  TOKEN_URL,
  buildAuthorizationUrl,
  buildRefreshRequest,
  buildTokenRequest,
  createCallbackHandler,
  createStateStore,
  extractTokenPayload,
  generateState,
  validateCallback,
} from '../lib/oauth.js';

describe('generateState / createStateStore', () => {
  it('produces a cryptographically random, high-entropy state value', () => {
    const a = generateState();
    const b = generateState();
    assert.equal(typeof a, 'string');
    assert.ok(a.length >= 32);
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });

  it('accepts the expected state once and rejects reuse or a mismatch', () => {
    const state = generateState();
    const store = createStateStore(state);
    assert.equal(store.value, state);
    assert.equal(store.consumed, false);
    assert.equal(store.consume(state), true);
    assert.equal(store.consumed, true);
    assert.equal(store.consume(state), false);

    const other = createStateStore(state);
    assert.equal(other.consume('totally-wrong-state-value-padded-ok!!'), false);
    assert.equal(other.consumed, false);
    assert.equal(other.consume(state), true);
  });

  it('rejects empty or non-string candidates without consuming', () => {
    const store = createStateStore('fixed-state-value-for-this-test-ok');
    assert.equal(store.consume(''), false);
    assert.equal(store.consume(null), false);
    assert.equal(store.consume(undefined), false);
    assert.equal(store.consumed, false);
  });
});

describe('validateCallback', () => {
  const path = '/callback';

  function make({ method = 'GET', query = '', store } = {}) {
    const stateStore = store || createStateStore('expected-state-value-32-chars-pad');
    const url = query.startsWith('http') ? query : `${path}${query}`;
    return {
      stateStore,
      result: validateCallback({ method, url, expectedPath: path, stateStore }),
    };
  }

  it('accepts a valid GET callback and consumes state', () => {
    const store = createStateStore('expected-state-value-32-chars-pad');
    const { result } = make({
      query: '?code=one-time-code&state=expected-state-value-32-chars-pad',
      store,
    });
    assert.equal(result.ok, true);
    assert.equal(result.code, 'one-time-code');
    assert.equal(store.consumed, true);
  });

  it('rejects a repeated callback with the same state', () => {
    const store = createStateStore('expected-state-value-32-chars-pad');
    const first = make({
      query: '?code=first-code&state=expected-state-value-32-chars-pad',
      store,
    });
    assert.equal(first.result.ok, true);
    const second = make({
      query: '?code=second-code&state=expected-state-value-32-chars-pad',
      store,
    });
    assert.equal(second.result.ok, false);
    assert.equal(second.result.status, 400);
    assert.match(second.result.publicMessage, /Invalid or expired OAuth state/);
    assert.doesNotMatch(second.result.publicMessage, /second-code/);
    assert.doesNotMatch(second.result.logMessage, /second-code/);
  });

  it('rejects a mismatched state and does not consume the real state', () => {
    const store = createStateStore('expected-state-value-32-chars-pad');
    const { result } = make({
      query: '?code=stolen-code&state=wrong-state',
      store,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(store.consumed, false);
    const later = make({
      query: '?code=real-code&state=expected-state-value-32-chars-pad',
      store,
    });
    assert.equal(later.result.ok, true);
    assert.equal(later.result.code, 'real-code');
  });

  it('rejects a missing state or code', () => {
    const missingState = make({ query: '?code=only-a-code' });
    assert.equal(missingState.result.ok, false);
    assert.equal(missingState.stateStore.consumed, false);

    const store = createStateStore('expected-state-value-32-chars-pad');
    const missingCode = make({
      query: '?state=expected-state-value-32-chars-pad',
      store,
    });
    assert.equal(missingCode.result.ok, false);
    assert.match(missingCode.result.publicMessage, /No authorization code/);
    assert.equal(store.consumed, true);
  });

  it('rejects a non-GET method without consuming state', () => {
    const store = createStateStore('expected-state-value-32-chars-pad');
    const { result } = make({
      method: 'POST',
      query: '?code=c&state=expected-state-value-32-chars-pad',
      store,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 405);
    assert.equal(store.consumed, false);
  });

  it('rejects an unexpected path without consuming state', () => {
    const store = createStateStore('expected-state-value-32-chars-pad');
    const result = validateCallback({
      method: 'GET',
      url: '/other?code=c&state=expected-state-value-32-chars-pad',
      expectedPath: '/callback',
      stateStore: store,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
    assert.equal(store.consumed, false);
  });

  it('rejects a malformed URL', () => {
    const store = createStateStore('expected-state-value-32-chars-pad');
    const result = validateCallback({
      method: 'GET',
      url: 'http://[not-a-valid-url',
      expectedPath: '/callback',
      stateStore: store,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.publicMessage, /Malformed/);
    assert.equal(store.consumed, false);
  });

  it('handles an authorization error: matching state is consumed, mismatched is not', () => {
    const matching = createStateStore('expected-state-value-32-chars-pad');
    const denied = validateCallback({
      method: 'GET',
      url: '/callback?error=access_denied&state=expected-state-value-32-chars-pad',
      expectedPath: '/callback',
      stateStore: matching,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 400);
    assert.match(denied.publicMessage, /denied or failed/);
    assert.doesNotMatch(denied.publicMessage, /access_denied/);
    assert.equal(matching.consumed, true);

    const mismatched = createStateStore('expected-state-value-32-chars-pad');
    const spoofed = validateCallback({
      method: 'GET',
      url: '/callback?error=access_denied&state=wrong',
      expectedPath: '/callback',
      stateStore: mismatched,
    });
    assert.equal(spoofed.ok, false);
    assert.equal(mismatched.consumed, false);
  });

  it('does not put the authorization code in public or log messages', () => {
    const { result } = make({
      method: 'GET',
      query: '?code=SUPER-SECRET-CODE&state=wrong',
    });
    assert.equal(result.ok, false);
    assert.doesNotMatch(result.publicMessage, /SUPER-SECRET-CODE/);
    assert.doesNotMatch(result.logMessage, /SUPER-SECRET-CODE/);
  });
});

describe('token request construction (official grant_type form body)', () => {
  it('puts the client secret and code in the POST body, not the URL', () => {
    const { url, options } = buildTokenRequest({
      clientId: 'client-id-value',
      clientSecret: 'super-secret-client',
      redirectUri: 'http://localhost:3737/callback',
      code: 'one-time-code',
    });
    assert.equal(url, TOKEN_URL);
    assert.equal(new URL(url).search, '');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('client_id'), 'client-id-value');
    assert.equal(body.get('client_secret'), 'super-secret-client');
    assert.equal(body.get('code'), 'one-time-code');
    assert.equal(body.get('redirect_uri'), 'http://localhost:3737/callback');
    assert.doesNotMatch(url, /super-secret-client/);
    assert.doesNotMatch(url, /one-time-code/);
  });

  it('puts the refresh token and client secret in the POST body, not the URL', () => {
    const { url, options } = buildRefreshRequest({
      clientId: 'client-id-value',
      clientSecret: 'super-secret-client',
      refreshToken: 'super-secret-refresh',
    });
    assert.equal(url, TOKEN_URL);
    assert.equal(new URL(url).search, '');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), 'super-secret-refresh');
    assert.equal(body.get('client_secret'), 'super-secret-client');
    assert.doesNotMatch(url, /super-secret/);
  });

  it('builds an authorization URL with response_type=code and state, and no secret', () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: 'client-id-value',
        redirectUri: 'http://localhost:3737/callback',
        state: 'the-state',
      })
    );
    assert.equal(url.origin + url.pathname, 'https://launchpad.37signals.com/authorization/new');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), 'client-id-value');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3737/callback');
    assert.equal(url.searchParams.get('state'), 'the-state');
    assert.equal(url.searchParams.get('client_secret'), null);
    assert.equal(url.searchParams.get('type'), null);
  });
});

describe('extractTokenPayload', () => {
  it('keeps only token fields and drops identity or other extras', () => {
    const payload = extractTokenPayload({
      access_token: 'access-value',
      refresh_token: 'refresh-value',
      expires_in: 1209600,
      token_type: 'Bearer',
      identity: { email_address: 'hidden@example.com' },
    });
    assert.deepEqual(payload, {
      access_token: 'access-value',
      refresh_token: 'refresh-value',
      expires_in: 1209600,
      token_type: 'Bearer',
    });
  });

  it('errors without echoing credentials when access_token is missing', () => {
    assert.throws(
      () =>
        extractTokenPayload({
          error: 'invalid_grant',
          error_description: 'the code is secret-ish',
          access_token: '',
        }),
      (err) => {
        assert.match(err.message, /invalid_grant/);
        assert.doesNotMatch(err.message, /secret-ish/);
        return true;
      }
    );
  });
});

describe('callback HTTP server', () => {
  async function withServer(handler, fn) {
    const server = http.createServer((req, res) => {
      handler(req, res);
    });
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
    });
    const { address, port } = server.address();
    try {
      assert.equal(address, '127.0.0.1');
      await fn({ address, port, base: `http://${address}:${port}` });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it('binds to loopback, accepts one valid GET, and rejects repeats, POSTs, and other paths', async () => {
    const state = generateState();
    const store = createStateStore(state);
    const logs = [];
    let savedCode = null;
    let settled = [];
    const handler = createCallbackHandler({
      stateStore: store,
      exchangeAndSave: async (code) => {
        savedCode = code;
      },
      log: (m) => logs.push(m),
      onSettled: (result) => settled.push(result),
    });

    await withServer(handler, async ({ address, port, base }) => {
      assert.equal(address, '127.0.0.1');
      assert.notEqual(address, '0.0.0.0');

      const ok = await fetch(`${base}/callback?code=the-code&state=${encodeURIComponent(state)}`);
      assert.equal(ok.status, 200);
      const body = await ok.text();
      assert.match(body, /Mr\. Bill is authorized/);
      assert.doesNotMatch(body, /the-code/);
      assert.equal(savedCode, 'the-code');
      assert.deepEqual(settled, [{ ok: true }]);

      const repeat = await fetch(
        `${base}/callback?code=another-code&state=${encodeURIComponent(state)}`
      );
      assert.equal(repeat.status, 400);
      const repeatBody = await repeat.text();
      assert.doesNotMatch(repeatBody, /another-code/);
      assert.equal(savedCode, 'the-code');

      const post = await fetch(`${base}/callback?code=x&state=${encodeURIComponent(state)}`, {
        method: 'POST',
      });
      assert.equal(post.status, 405);

      const other = await fetch(`${base}/favicon.ico`);
      assert.equal(other.status, 404);
    });

    assert.ok(logs.includes('Authorization successful.'));
    assert.ok(logs.some((m) => m.includes('invalid or reused state')));
    assert.ok(!logs.some((m) => m.includes('the-code') || m.includes('another-code')));
  });

  it('returns a generic failure and does not leak a token from a thrown error', async () => {
    const state = generateState();
    const store = createStateStore(state);
    const logs = [];
    const handler = createCallbackHandler({
      stateStore: store,
      exchangeAndSave: async () => {
        throw new Error('access_token=LEAKED-TOKEN-VALUE refresh_token=LEAKED-REFRESH');
      },
      log: (m) => logs.push(m),
    });

    await withServer(handler, async ({ base }) => {
      const res = await fetch(`${base}/callback?code=the-code&state=${encodeURIComponent(state)}`);
      assert.equal(res.status, 500);
      const body = await res.text();
      assert.equal(body, 'Token exchange failed.');
      assert.doesNotMatch(body, /LEAKED/);
    });
    assert.deepEqual(logs, ['Token exchange failed.']);
  });

  it('does not call exchangeAndSave for a malformed or unauthorized callback', async () => {
    const state = generateState();
    const store = createStateStore(state);
    let called = 0;
    const handler = createCallbackHandler({
      stateStore: store,
      exchangeAndSave: async () => {
        called += 1;
      },
    });

    await withServer(handler, async ({ base }) => {
      const badState = await fetch(`${base}/callback?code=c&state=nope`);
      assert.equal(badState.status, 400);
      const badMethod = await fetch(`${base}/callback?code=c&state=${encodeURIComponent(state)}`, {
        method: 'PUT',
      });
      assert.equal(badMethod.status, 405);
    });
    assert.equal(called, 0);
    assert.equal(store.consumed, false);
  });
});
