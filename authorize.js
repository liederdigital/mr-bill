// authorize.js
// One-time OAuth flow. Run this once with `npm run authorize`.
// Opens your browser, you approve, a local server catches the response,
// then trades the code for access + refresh tokens and saves them to ~/.mr-bill/tokens.json.

import http from 'node:http';
import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const {
  BASECAMP_CLIENT_ID,
  BASECAMP_CLIENT_SECRET,
} = process.env;

const REDIRECT_URI = 'http://localhost:3737/callback';
const PORT = 3737;

const TOKENS_PATH = path.join(os.homedir(), '.mr-bill', 'tokens.json');

// Sanity check
if (!BASECAMP_CLIENT_ID) {
  console.error('✗ BASECAMP_CLIENT_ID is missing from your environment');
  console.error('  Make sure it is set in your ~/.zshrc and run: source ~/.zshrc');
  process.exit(1);
}
if (!BASECAMP_CLIENT_SECRET) {
  console.error('✗ BASECAMP_CLIENT_SECRET is missing from your environment');
  console.error('  Make sure it is set in your ~/.zshrc and run: source ~/.zshrc');
  process.exit(1);
}

const authUrl =
  'https://launchpad.37signals.com/authorization/new?' +
  `type=web_server&client_id=${BASECAMP_CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400);
    res.end('No authorization code received from Basecamp.');
    console.error('✗ No code in callback URL');
    return;
  }

  const tokenUrl =
    'https://launchpad.37signals.com/authorization/token?' +
    `type=web_server&client_id=${BASECAMP_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&client_secret=${BASECAMP_CLIENT_SECRET}` +
    `&code=${code}`;

  try {
    const response = await fetch(tokenUrl, { method: 'POST' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    await writeFile(TOKENS_PATH, JSON.stringify(data, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: system-ui; max-width: 500px; margin: 60px auto; text-align: center;">
          <h1>✓ Mr. Bill is authorized</h1>
          <p>You can close this tab and return to your terminal.</p>
        </body>
      </html>
    `);

    console.log('');
    console.log('✓ Authorization successful.');
    console.log(`  Tokens saved to ${TOKENS_PATH}`);
    console.log('');

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } catch (err) {
    res.writeHead(500);
    res.end('Token exchange failed: ' + err.message);
    console.error('✗ Token exchange failed:', err.message);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
  console.log('Opening your browser to authorize Mr. Bill...');
  exec(`open "${authUrl}"`);
});
