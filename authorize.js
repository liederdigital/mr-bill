// authorize.js
// One-time OAuth flow. Run this once with `npm run authorize`.
// Opens your browser, you approve, a local server catches the response,
// then trades the code for access + refresh tokens and saves them to tokens.json.

import http from 'node:http';
import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import 'dotenv/config';

const {
  BASECAMP_CLIENT_ID,
  BASECAMP_CLIENT_SECRET,
} = process.env;

const REDIRECT_URI = 'http://localhost:3737/callback';
const PORT = 3737;

// Sanity check: make sure .env was filled in
if (!BASECAMP_CLIENT_ID || BASECAMP_CLIENT_ID.includes('PASTE')) {
  console.error('✗ BASECAMP_CLIENT_ID is missing from .env');
  process.exit(1);
}
if (!BASECAMP_CLIENT_SECRET || BASECAMP_CLIENT_SECRET.includes('PASTE')) {
  console.error('✗ BASECAMP_CLIENT_SECRET is missing from .env');
  console.error('  Open .env and paste the Client Secret from your launchpad.37signals.com page.');
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

  // Exchange the verification code for an access token.
  // Basecamp's token endpoint expects params in the URL, POST body empty.
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

    // data has: access_token, refresh_token, expires_in
    await writeFile('tokens.json', JSON.stringify(data, null, 2));

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
    console.log('  Tokens saved to tokens.json (gitignored, stays on your machine).');
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
  console.log('');

  exec(`open "${authUrl}"`, (err) => {
    if (err) {
      console.log('Could not open browser automatically.');
      console.log('Paste this URL into your browser:');
      console.log('');
      console.log(authUrl);
      console.log('');
    }
  });
});
