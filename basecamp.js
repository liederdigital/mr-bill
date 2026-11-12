// basecamp.js
// Shared helpers for talking to the Basecamp API.
// Handles authenticated requests, auto-refreshes expired tokens,
// and finds/creates the to-do list for you.

import { loadTokens, saveTokens } from './lib/tokens.js';
import { buildRefreshRequest, extractTokenPayload } from './lib/oauth.js';

const {
  BASECAMP_CLIENT_ID,
  BASECAMP_CLIENT_SECRET,
  BASECAMP_ACCOUNT_ID,
  BASECAMP_PROJECT_ID,
  USER_AGENT_NAME,
  USER_AGENT_CONTACT,
} = process.env;

const API_BASE = `https://3.basecampapi.com/${BASECAMP_ACCOUNT_ID}`;

async function refreshAccessToken() {
  const existing = await loadTokens();
  if (typeof existing.refresh_token !== 'string' || existing.refresh_token.length === 0) {
    throw new Error('Token file is missing a valid refresh_token; run `npm run authorize`');
  }
  if (!BASECAMP_CLIENT_ID || !BASECAMP_CLIENT_SECRET) {
    throw new Error(
      'BASECAMP_CLIENT_ID and BASECAMP_CLIENT_SECRET must be set to refresh tokens'
    );
  }

  const { url, options } = buildRefreshRequest({
    clientId: BASECAMP_CLIENT_ID,
    clientSecret: BASECAMP_CLIENT_SECRET,
    refreshToken: existing.refresh_token,
  });

  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Token refresh failed (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const name =
      data && typeof data.error === 'string' && data.error.length <= 80
        ? data.error
        : String(res.status);
    throw new Error(`Token refresh failed (${name})`);
  }

  const extracted = extractTokenPayload(data);
  const merged = { ...existing, ...extracted };
  if (!extracted.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }
  await saveTokens(merged);
  return merged.access_token;
}

// Make an authenticated Basecamp API request.
// `path` can be a relative path like `/projects/123.json` or a full URL.
export async function bcFetch(path, options = {}) {
  const tokens = await loadTokens();
  let accessToken = tokens.access_token;

  const doRequest = async (token) => {
    if (typeof path !== 'string' || path.length === 0) {
      throw new Error('A Basecamp request path is required');
    }
    const url = path.startsWith('https://') || path.startsWith('http://')
      ? path
      : `${API_BASE}${path}`;
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `${USER_AGENT_NAME} (${USER_AGENT_CONTACT})`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  };

  let res = await doRequest(accessToken);

  if (res.status === 401) {
    accessToken = await refreshAccessToken();
    res = await doRequest(accessToken);
  }

  if (!res.ok) {
    const body = await res.text();
    // Truncate and do not include request headers (which carry the bearer token).
    throw new Error(`Basecamp API ${res.status}: ${body.slice(0, 300)}`);
  }

  if (res.status === 204) {
    return null;
  }
  return res.json();
}

// Find (or create) a to-do list by name in the configured project.
// Returns the list ID.
export async function ensureTodoList(listName) {
  if (typeof listName !== 'string' || !listName.trim()) {
    throw new Error('To-do list name is required');
  }
  if (!BASECAMP_PROJECT_ID) {
    throw new Error('BASECAMP_PROJECT_ID is missing from your environment');
  }

  const project = await bcFetch(`/projects/${BASECAMP_PROJECT_ID}.json`);
  if (!project || !Array.isArray(project.dock)) {
    throw new Error('Unexpected project response from Basecamp');
  }

  const todoset = project.dock.find((tool) => tool && tool.name === 'todoset');
  if (!todoset) {
    throw new Error(
      'No to-do set found on this project. Is BASECAMP_PROJECT_ID correct?'
    );
  }
  if (!todoset.enabled) {
    throw new Error(
      'The To-dos tool is disabled on this project. Enable it in Basecamp first.'
    );
  }

  const lists = await bcFetch(
    `/buckets/${BASECAMP_PROJECT_ID}/todosets/${todoset.id}/todolists.json`
  );
  if (!Array.isArray(lists)) {
    throw new Error('Unexpected to-do list response from Basecamp');
  }

  const existing = lists.find((list) => list && list.name === listName);
  if (existing) {
    return existing.id;
  }

  console.log(`  No list named "${listName}" found — creating it.`);
  const created = await bcFetch(
    `/buckets/${BASECAMP_PROJECT_ID}/todosets/${todoset.id}/todolists.json`,
    {
      method: 'POST',
      body: JSON.stringify({ name: listName }),
    }
  );
  if (!created || created.id == null) {
    throw new Error('Basecamp did not return a to-do list id');
  }
  return created.id;
}

// Create a to-do in the given list. Returns the created to-do object.
export async function createTodo(todolistId, { content, description, dueOn }) {
  if (todolistId == null || todolistId === '') {
    throw new Error('A to-do list id is required');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('To-do content is required');
  }
  if (!BASECAMP_PROJECT_ID) {
    throw new Error('BASECAMP_PROJECT_ID is missing from your environment');
  }

  return bcFetch(
    `/buckets/${BASECAMP_PROJECT_ID}/todolists/${todolistId}/todos.json`,
    {
      method: 'POST',
      body: JSON.stringify({
        content,
        description: description || '',
        due_on: dueOn || null,
      }),
    }
  );
}
