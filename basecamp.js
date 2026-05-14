// basecamp.js
// Shared helpers for talking to the Basecamp API.
// Handles authenticated requests, auto-refreshes expired tokens,
// and finds/creates the to-do list for you.

import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const {
  BASECAMP_CLIENT_ID,
  BASECAMP_CLIENT_SECRET,
  BASECAMP_ACCOUNT_ID,
  BASECAMP_PROJECT_ID,
  USER_AGENT_NAME,
  USER_AGENT_CONTACT,
} = process.env;

const API_BASE = `https://3.basecampapi.com/${BASECAMP_ACCOUNT_ID}`;

// === NEW: Tokens now live in ~/.mr-bill/tokens.json ===
const TOKENS_PATH = path.join(os.homedir(), '.mr-bill', 'tokens.json');

async function loadTokens() {
  return JSON.parse(await readFile(TOKENS_PATH, 'utf8'));
}

async function saveTokens(tokens) {
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

// Access tokens expire after 2 weeks. If we get a 401, swap to the refresh flow.
async function refreshAccessToken() {
  const { refresh_token } = await loadTokens();
  const url =
    'https://launchpad.37signals.com/authorization/token?' +
    `type=refresh&refresh_token=${refresh_token}` +
    `&client_id=${BASECAMP_CLIENT_ID}&client_secret=${BASECAMP_CLIENT_SECRET}`;

  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error('Token refresh failed: ' + (data.error || res.status));
  }

  // Keep the existing refresh_token; only the access_token rotates.
  const existing = await loadTokens();
  const merged = { ...existing, ...data };
  await saveTokens(merged);
  return merged.access_token;
}

// Make an authenticated Basecamp API request.
// `path` can be a relative path like `/projects/123.json` or a full URL.
export async function bcFetch(path, options = {}) {
  let tokens = await loadTokens();
  let accessToken = tokens.access_token;

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': `${USER_AGENT_NAME} (${USER_AGENT_CONTACT})`,
    ...options.headers,
  };

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // If token expired, refresh and retry once
  if (res.status === 401) {
    accessToken = await refreshAccessToken();
    headers['Authorization'] = `Bearer ${accessToken}`;
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  }

  return res;
}
