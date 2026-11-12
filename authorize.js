// authorize.js
// One-time OAuth flow. Run this once with `npm run authorize`.
// Opens your browser, you approve, a local loopback server catches the
// response, then trades the code for access + refresh tokens and saves them
// to ~/.mr-bill/tokens.json.

import http from 'node:http';
import { exec } from 'node:child_process';
import {
  buildAuthorizationUrl,
  buildTokenRequest,
  createCallbackHandler,
  createStateStore,
  extractTokenPayload,
  generateState,
} from './lib/oauth.js';
import { defaultTokensPath, saveTokens } from './lib/tokens.js';

const {
  BASECAMP_CLIENT_ID,
  BASECAMP_CLIENT_SECRET,
} = process.env;

// Redirect URI uses localhost to match a typical Launchpad app registration.
// The callback server itself binds only to 127.0.0.1 (IPv4 loopback).
const PORT = 3737;
const HOST = '127.0.0.1';
const REDIRECT_URI = 'http://localhost:3737/callback';
const TOKENS_PATH = defaultTokensPath();

if (!BASECAMP_CLIENT_ID) {
  console.error('✗ BASECAMP_CLIENT_ID is missing from your environment');
  console.error('  Set it in your shell environment and try again.');
  process.exit(1);
}
if (!BASECAMP_CLIENT_SECRET) {
  console.error('✗ BASECAMP_CLIENT_SECRET is missing from your environment');
  console.error('  Set it in your shell environment and try again.');
  process.exit(1);
}

const stateStore = createStateStore(generateState());
const authUrl = buildAuthorizationUrl({
  clientId: BASECAMP_CLIENT_ID,
  redirectUri: REDIRECT_URI,
  state: stateStore.value,
});

const server = http.createServer();

async function exchangeAndSave(code) {
  const { url, options } = buildTokenRequest({
    clientId: BASECAMP_CLIENT_ID,
    clientSecret: BASECAMP_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    code,
  });
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string' && data.error.length <= 80
        ? data.error
        : `HTTP ${response.status}`
    );
  }
  const payload = extractTokenPayload(data);
  await saveTokens(payload, TOKENS_PATH);
}

const handler = createCallbackHandler({
  stateStore,
  exchangeAndSave,
  log: (message) => {
    // Messages from the handler are already sanitized (no tokens or codes).
    if (message === 'Authorization successful.') {
      console.log('');
      console.log('✓ Authorization successful.');
      console.log(`  Tokens saved to ${TOKENS_PATH}`);
      console.log('');
    } else {
      console.error('✗', message);
    }
  },
  onSettled: ({ ok }) => {
    setTimeout(() => {
      server.close(() => {
        process.exit(ok ? 0 : 1);
      });
    }, 500);
  },
});

server.on('request', handler);

server.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT} (loopback only)`);
  console.log('Opening your browser to authorize Mr. Bill...');
  exec(`open "${authUrl}"`, (err) => {
    if (err) {
      console.log('Could not open the browser automatically.');
      console.log('Paste this URL into your browser:');
      console.log('');
      console.log(authUrl);
      console.log('');
    }
  });
});
