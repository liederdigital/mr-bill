// Token file helpers. Tokens live outside the project, in ~/.mr-bill/tokens.json.
// The directory is created at mode 0700 and the file is written atomically at 0600
// where the filesystem supports POSIX permissions.

import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open as fsOpen, readFile, rename, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TOKEN_FIELDS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
];

export function defaultTokensDir() {
  return path.join(os.homedir(), '.mr-bill');
}

export function defaultTokensPath() {
  return path.join(defaultTokensDir(), 'tokens.json');
}

function pickTokenFields(tokens) {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    throw new Error('Token payload must be an object');
  }
  if (typeof tokens.access_token !== 'string' || tokens.access_token.length === 0) {
    throw new Error('Token payload is missing a valid access_token');
  }
  const out = {};
  for (const key of TOKEN_FIELDS) {
    if (tokens[key] !== undefined) {
      out[key] = tokens[key];
    }
  }
  return out;
}

async function chmodIfSupported(targetPath, mode) {
  try {
    await chmod(targetPath, mode);
  } catch (err) {
    if (err && (err.code === 'ENOTSUP' || err.code === 'EPERM' || err.code === 'EINVAL')) {
      return;
    }
    throw err;
  }
}

export async function ensureTokensDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmodIfSupported(dir, 0o700);
}

export async function saveTokens(tokens, tokensPath = defaultTokensPath()) {
  const payload = pickTokenFields(tokens);
  const dir = path.dirname(tokensPath);
  await ensureTokensDir(dir);

  const tmp = path.join(dir, `.tokens.${randomBytes(16).toString('hex')}.tmp`);
  let handle;
  try {
    handle = await fsOpen(tmp, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await chmodIfSupported(tmp, 0o600);
    await rename(tmp, tokensPath);
    await chmodIfSupported(tokensPath, 0o600);
  } catch (err) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // ignore close errors during cleanup
      }
    }
    try {
      await unlink(tmp);
    } catch {
      // ignore cleanup errors
    }
    const wrapped = new Error('Failed to save tokens');
    wrapped.cause = err;
    throw wrapped;
  }
}

export async function loadTokens(tokensPath = defaultTokensPath()) {
  let raw;
  try {
    raw = await readFile(tokensPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(
        `Token file not found at ${tokensPath}. Run \`npm run authorize\` first.`
      );
    }
    throw new Error('Failed to read token file');
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Do not include the file contents — they may contain credentials.
    throw new Error('Token file is not valid JSON');
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof data.access_token !== 'string' ||
    data.access_token.length === 0
  ) {
    throw new Error('Token file is missing a valid access_token');
  }
  return data;
}
