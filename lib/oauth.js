// Basecamp / Launchpad OAuth helpers.
// Follows the current official guidance in the Basecamp 3 API authentication
// docs: https://github.com/basecamp/bc3-api/blob/master/sections/authentication.md
//
// Token exchange and refresh use POST with an application/x-www-form-urlencoded
// body (grant_type=authorization_code or grant_type=refresh_token). Client
// secrets and tokens are not placed in the URL. The older query-string
// type=web_server / type=refresh form is documented as legacy.

import { randomBytes, timingSafeEqual } from 'node:crypto';

export const AUTHORIZE_URL = 'https://launchpad.37signals.com/authorization/new';
export const TOKEN_URL = 'https://launchpad.37signals.com/authorization/token';
export const CALLBACK_PATH = '/callback';

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Mr. Bill is authorized</title></head>
  <body style="font-family: system-ui; max-width: 500px; margin: 60px auto; text-align: center;">
    <h1>✓ Mr. Bill is authorized</h1>
    <p>You can close this tab and return to your terminal.</p>
  </body>
</html>
`;

export function generateState() {
  return randomBytes(32).toString('base64url');
}

export function createStateStore(state = generateState()) {
  if (typeof state !== 'string' || state.length === 0) {
    throw new Error('OAuth state must be a non-empty string');
  }
  let consumed = false;
  const expected = Buffer.from(state, 'utf8');

  return {
    get value() {
      return state;
    },
    get consumed() {
      return consumed;
    },
    consume(candidate) {
      if (consumed) {
        return false;
      }
      if (typeof candidate !== 'string' || candidate.length === 0) {
        return false;
      }
      const actual = Buffer.from(candidate, 'utf8');
      if (actual.length !== expected.length) {
        return false;
      }
      if (!timingSafeEqual(expected, actual)) {
        return false;
      }
      consumed = true;
      return true;
    },
  };
}

export function buildAuthorizationUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) {
    throw new Error('clientId, redirectUri, and state are required');
  }
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

function formBody(params) {
  return new URLSearchParams(params).toString();
}

export function buildTokenRequest({ clientId, clientSecret, redirectUri, code }) {
  if (!clientId || !clientSecret || !redirectUri || !code) {
    throw new Error('clientId, clientSecret, redirectUri, and code are required');
  }
  return {
    url: TOKEN_URL,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    },
  };
}

export function buildRefreshRequest({ clientId, clientSecret, refreshToken }) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('clientId, clientSecret, and refreshToken are required');
  }
  return {
    url: TOKEN_URL,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    },
  };
}

function shortErrorName(data, fallback) {
  if (data && typeof data.error === 'string' && data.error.length > 0 && data.error.length <= 80) {
    return data.error;
  }
  return fallback;
}

export function extractTokenPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Token endpoint returned an unexpected response');
  }
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new Error(`Token endpoint returned an error (${shortErrorName(data, 'unknown_error')})`);
  }
  const payload = { access_token: data.access_token };
  if (typeof data.refresh_token === 'string' && data.refresh_token.length > 0) {
    payload.refresh_token = data.refresh_token;
  }
  if (data.expires_in !== undefined) {
    payload.expires_in = data.expires_in;
  }
  if (data.expires_at !== undefined) {
    payload.expires_at = data.expires_at;
  }
  if (typeof data.token_type === 'string') {
    payload.token_type = data.token_type;
  }
  return payload;
}

export function validateCallback({
  method,
  url,
  expectedPath = CALLBACK_PATH,
  stateStore,
}) {
  if (!stateStore || typeof stateStore.consume !== 'function') {
    throw new Error('A state store is required');
  }

  if (typeof method !== 'string' || method.toUpperCase() !== 'GET') {
    return {
      ok: false,
      status: 405,
      publicMessage: 'Method not allowed',
      logMessage: 'Callback rejected: method not allowed',
    };
  }

  let parsed;
  try {
    if (typeof url !== 'string' || url.length === 0) {
      throw new Error('missing url');
    }
    parsed = new URL(url, 'http://127.0.0.1');
  } catch {
    return {
      ok: false,
      status: 400,
      publicMessage: 'Malformed callback request',
      logMessage: 'Callback rejected: malformed URL',
    };
  }

  if (parsed.pathname !== expectedPath) {
    return {
      ok: false,
      status: 404,
      publicMessage: 'Not found',
      logMessage: 'Callback rejected: unexpected path',
    };
  }

  const state = parsed.searchParams.get('state');
  const code = parsed.searchParams.get('code');
  const error = parsed.searchParams.get('error');

  if (error) {
    // Consume a matching state so this authorization attempt cannot be reused.
    if (state) {
      stateStore.consume(state);
    }
    return {
      ok: false,
      status: 400,
      publicMessage: 'Authorization was denied or failed',
      logMessage: 'Callback rejected: authorization error',
    };
  }

  if (!state || !stateStore.consume(state)) {
    return {
      ok: false,
      status: 400,
      publicMessage: 'Invalid or expired OAuth state',
      logMessage: 'Callback rejected: invalid or reused state',
    };
  }

  if (typeof code !== 'string' || code.length === 0 || code.length > 2048) {
    return {
      ok: false,
      status: 400,
      publicMessage: 'No authorization code received',
      logMessage: 'Callback rejected: missing or invalid code',
    };
  }

  return { ok: true, code };
}

function safeEnd(res, status, body, contentType = 'text/plain; charset=utf-8') {
  if (res.headersSent) {
    return;
  }
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

export function createCallbackHandler({
  stateStore,
  expectedPath = CALLBACK_PATH,
  exchangeAndSave,
  onSettled,
  log = () => {},
}) {
  if (typeof exchangeAndSave !== 'function') {
    throw new Error('exchangeAndSave is required');
  }

  let settled = false;

  return async function handler(req, res) {
    try {
      const result = validateCallback({
        method: req.method,
        url: req.url,
        expectedPath,
        stateStore,
      });

      if (!result.ok) {
        log(result.logMessage);
        safeEnd(res, result.status, result.publicMessage);
        return;
      }

      if (settled) {
        log('Callback rejected: already completed');
        safeEnd(res, 409, 'Authorization already completed');
        return;
      }
      settled = true;

      await exchangeAndSave(result.code);

      safeEnd(res, 200, SUCCESS_HTML, 'text/html; charset=utf-8');
      log('Authorization successful.');
      onSettled?.({ ok: true });
    } catch {
      // Never forward the underlying error: it may contain token material.
      log('Token exchange failed.');
      safeEnd(res, 500, 'Token exchange failed.');
      onSettled?.({ ok: false });
    }
  };
}
