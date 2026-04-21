// basecamp.js
// Shared helpers for talking to the Basecamp API.
// Handles authenticated requests, auto-refreshes expired tokens,
// and finds/creates the to-do list for you.

import { readFile, writeFile } from 'node:fs/promises';

const {
  BASECAMP_CLIENT_ID,
  BASECAMP_CLIENT_SECRET,
  BASECAMP_ACCOUNT_ID,
  BASECAMP_PROJECT_ID,
  USER_AGENT_NAME,
  USER_AGENT_CONTACT,
} = process.env;

const API_BASE = `https://3.basecampapi.com/${BASECAMP_ACCOUNT_ID}`;

async function loadTokens() {
  return JSON.parse(await readFile('tokens.json', 'utf8'));
}

async function saveTokens(tokens) {
  await writeFile('tokens.json', JSON.stringify(tokens, null, 2));
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
  const { access_token } = await loadTokens();

  const doRequest = async (token) => {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
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

  let res = await doRequest(access_token);

  if (res.status === 401) {
    // Expired token — refresh once and retry.
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Basecamp API ${res.status}: ${body.slice(0, 300)}`);
  }

  if (res.status === 204) return null; // No Content
  return res.json();
}

// Find (or create) a to-do list by name in the configured project.
// Returns the list ID.
export async function ensureTodoList(listName) {
  const project = await bcFetch(`/projects/${BASECAMP_PROJECT_ID}.json`);

  const todoset = project.dock.find((tool) => tool.name === 'todoset');
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

  const existing = lists.find((l) => l.name === listName);
  if (existing) return existing.id;

  console.log(`  No list named "${listName}" found — creating it.`);
  const created = await bcFetch(
    `/buckets/${BASECAMP_PROJECT_ID}/todosets/${todoset.id}/todolists.json`,
    {
      method: 'POST',
      body: JSON.stringify({ name: listName }),
    }
  );
  return created.id;
}

// Create a to-do in the given list. Returns the created to-do object.
export async function createTodo(todolistId, { content, description, dueOn }) {
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
