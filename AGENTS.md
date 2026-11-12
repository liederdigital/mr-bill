# Agent instructions

Mr. Bill is a small local Node.js tool. It reads bill text from the macOS clipboard, sends that text to Anthropic to extract vendor, amount, currency, due date, and a summary, then — only after the operator confirms — creates a Basecamp to-do that includes the same bill text in the description.

It is meant to run on the owner's machine. This repository is public for viewing only; see the README license note.

## Layout

- `authorize.js` — one-time Basecamp OAuth flow; writes tokens to `~/.mr-bill/tokens.json`
- `basecamp.js` — authenticated Basecamp helpers, including token refresh, `ensureTodoList`, and `createTodo`
- `bill.js` — clipboard read, model parse, preview, confirmation, then Basecamp write
- `test-todo.js` — live Basecamp plumbing check (creates a real to-do)
- `lib/oauth.js` — OAuth state, callback validation, token request bodies
- `lib/tokens.js` — token-file load/save (directory `0700`, file `0600`, atomic write)
- `lib/bill-parse.js` — model-output validation and to-do payload construction
- `test/` — unit tests (`npm test` runs only these)
- `COLOPHON.md` — how this repository was made
- `README.md` — setup, privacy, and the view-only copyright notice

## Tests and live APIs

- Run `npm test` (that is `node --test test/*.test.js`). These tests must not call Basecamp or Anthropic and must not need real credentials.
- Never run `npm run authorize`, `node bill.js`, or `npm run test-todo` (or otherwise call Basecamp or Anthropic with real credentials) unless the owner has explicitly agreed to that live call.
- Do not weaken security checks to make tests pass.

## Environment variables (names only)

Credentials come from the process environment, not from a committed file and not via `dotenv`.

- `BASECAMP_CLIENT_ID`
- `BASECAMP_CLIENT_SECRET`
- `BASECAMP_ACCOUNT_ID`
- `BASECAMP_PROJECT_ID`
- `USER_AGENT_NAME`
- `USER_AGENT_CONTACT`
- `ANTHROPIC_API_KEY`

OAuth tokens live in `~/.mr-bill/tokens.json`, outside the project. Never print or commit their values, or the values of the variables above.

## Security rules

- Do not add secrets, tokens, personal data, or local config to the repository. Keep `.env`, `.env.*`, `tokens.json`, and `.mr-bill/` gitignored. Do not rewrite Git history or remove commits without the owner's explicit approval. If a real credential is found, report its location (file and commit) and recommend rotation; do not use it or print its value.
- Create the token directory if needed (mode `0700`) and write the token file atomically at mode `0600` where POSIX permissions are supported. Persist only token fields. Errors and logs must not include credentials, authorization codes, or full token responses.
- Keep the existing confirmation (`y` / `yes`) before any Basecamp to-do is created from parsed bill text. Malformed or unexpected model output must not trigger a write.
- Validate model output before preview or any API write: expected field types, a finite amount, a 3-letter currency, and a real `YYYY-MM-DD` date. Drop unknown fields. Fail safely on invalid output.
- Do not log bill contents. Do not add any new transmission, logging, or storage of bill text. The only intended paths are the Anthropic parse request and, after confirmation, the Basecamp to-do description.
- The OAuth callback server must bind only to loopback. Use a cryptographically random, single-use `state` and validate it on callback. Accept only `GET /callback`. Put client secrets and tokens in the POST body, not in the URL, as the current Basecamp / Launchpad docs allow.

## Commits and pull requests

- Work on a new branch and open a pull request. The owner (Ron Stauffer) merges; do not merge, force-push, rewrite history, change repository visibility, or publish the repository unless the owner explicitly asks.
- Security Guard work is committed as `Security Guard <security@lieder.bot>` using the `security-guard-lieder` GitHub account, isolated from other accounts.
- Keep changes focused. Do not make unrelated refactors.

## Colophon

This project keeps COLOPHON.md, a short record of how it was made.
Agents update it themselves, in the same commit or pull request as their
work: add a row when the tool, model, model setting, or computer changes,
when a new phase of work starts, when you review someone else's work, and
before each release. Never hold up a commit for it. Follow the instructions
at https://colophon.md/instructions.md.
