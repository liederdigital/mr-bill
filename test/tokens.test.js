import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureTokensDir, loadTokens, saveTokens } from '../lib/tokens.js';

const SAMPLE = {
  access_token: 'test-access-token-value',
  refresh_token: 'test-refresh-token-value',
  expires_in: 1209600,
  token_type: 'Bearer',
  identity: { email_address: 'should-not-be-persisted@example.com' },
};

describe('token file handling', () => {
  let dir;
  let tokensPath;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mr-bill-tokens-'));
    tokensPath = path.join(dir, 'tokens.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates the directory at mode 0700 and the file at 0600', async () => {
    await saveTokens(SAMPLE, tokensPath);
    const dirStat = await stat(dir);
    const fileStat = await stat(tokensPath);
    assert.equal(dirStat.mode & 0o777, 0o700);
    assert.equal(fileStat.mode & 0o777, 0o600);
  });

  it('tightens permissions on a pre-existing too-open directory', async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true, mode: 0o755 });
    // mkdir honors umask; force a loose mode then require saveTokens to tighten it.
    const { chmod } = await import('node:fs/promises');
    await chmod(dir, 0o755);
    await saveTokens(SAMPLE, tokensPath);
    const dirStat = await stat(dir);
    assert.equal(dirStat.mode & 0o777, 0o700);
  });

  it('writes only known token fields, atomically, and leaves no temp files', async () => {
    await saveTokens(SAMPLE, tokensPath);
    const raw = await readFile(tokensPath, 'utf8');
    const data = JSON.parse(raw);
    assert.equal(data.access_token, SAMPLE.access_token);
    assert.equal(data.refresh_token, SAMPLE.refresh_token);
    assert.equal(data.expires_in, SAMPLE.expires_in);
    assert.equal(data.token_type, 'Bearer');
    assert.equal(data.identity, undefined);
    const { readdir } = await import('node:fs/promises');
    const leftovers = (await readdir(dir)).filter((name) => name.includes('.tmp'));
    assert.deepEqual(leftovers, []);
  });

  it('round-trips tokens through loadTokens', async () => {
    await saveTokens(SAMPLE, tokensPath);
    const loaded = await loadTokens(tokensPath);
    assert.equal(loaded.access_token, SAMPLE.access_token);
    assert.equal(loaded.refresh_token, SAMPLE.refresh_token);
  });

  it('does not include file contents in errors for invalid JSON', async () => {
    await writeFile(tokensPath, '{ "access_token": "leaked-should-not-appear" }\n{bad');
    await assert.rejects(() => loadTokens(tokensPath), (err) => {
      assert.match(err.message, /not valid JSON/);
      assert.doesNotMatch(err.message, /leaked-should-not-appear/);
      assert.doesNotMatch(err.message, /access_token/);
      return true;
    });
  });

  it('rejects a missing access_token without echoing the file', async () => {
    await writeFile(tokensPath, JSON.stringify({ refresh_token: 'hidden-refresh' }));
    await assert.rejects(() => loadTokens(tokensPath), (err) => {
      assert.match(err.message, /missing a valid access_token/);
      assert.doesNotMatch(err.message, /hidden-refresh/);
      return true;
    });
  });

  it('reports a missing file without a crash', async () => {
    await assert.rejects(() => loadTokens(tokensPath), /Token file not found/);
  });

  it('rejects a payload with no access_token before writing', async () => {
    await assert.rejects(
      () => saveTokens({ refresh_token: 'only-refresh' }, tokensPath),
      /missing a valid access_token/
    );
    await assert.rejects(() => readFile(tokensPath), { code: 'ENOENT' });
  });

  it('ensureTokensDir creates a 0700 directory', async () => {
    const nested = path.join(dir, 'nested-config');
    await ensureTokensDir(nested);
    const dirStat = await stat(nested);
    assert.equal(dirStat.mode & 0o777, 0o700);
  });
});
