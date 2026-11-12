# Mr. Bill

A small local Node.js tool that turns pasted bill text into a Basecamp to-do with a vendor, amount, and due date.

It is meant to run on your own machine. It talks to Anthropic to parse the bill and to Basecamp to create the to-do.

---

## Privacy

When you run `node bill.js`:

- The bill text from your clipboard is **sent to Anthropic** so a model can extract the vendor, amount, currency, due date, and a short summary.
- That same bill text is **copied into the resulting Basecamp to-do** (in the description), after you confirm.

Mr. Bill does not otherwise transmit, log, or store the bill contents. OAuth tokens stay in `~/.mr-bill/tokens.json` on your machine. API credentials come from your environment variables.

---

## Project History & What Changed

### Original Setup (Before May 2026)

- Secrets (API keys, tokens) were stored in a local `.env` file and `tokens.json` inside the project folder.
- Used the `dotenv` package to load environment variables from `.env`.
- Tokens were read/written directly from a `tokens.json` file in the project root.
- This worked, but was not ideal from a security or best-practice standpoint.

### Current Setup (May 2026, hardened November 2026)

- **No local `.env` file** is required, and the `dotenv` package is not used.
- **Client credentials** (Client ID, Client Secret, Account ID, and so on) are loaded from environment variables (`process.env`). You can set them in your shell profile (for example `~/.zshrc`).
- **OAuth tokens** are stored outside the project in `~/.mr-bill/tokens.json`. The tool creates that directory if needed (mode `0700`) and writes the file atomically (mode `0600` where the filesystem supports it).
- The OAuth callback server binds only to loopback, uses a one-time `state` value, and exchanges the authorization code with a POST body (client secrets are not placed in the URL).
- Model output is validated before any Basecamp write, and you still have to confirm the preview.

---

## Current Architecture

| Secret Type          | Where It's Stored                     | How It's Loaded          |
|----------------------|---------------------------------------|--------------------------|
| Client credentials   | Environment variables                 | `process.env`            |
| OAuth tokens         | `~/.mr-bill/tokens.json`              | `loadTokens()`           |
| Code                 | Your local project checkout           | Normal project files     |

---

## Setup Instructions

### 1. Prerequisites

Make sure you have Node.js 18 or higher:

```bash
node --version
```

On macOS, authorizing and reading the clipboard use `open` and `pbpaste`.

### 2. Install Dependencies

From inside the `mr-bill` folder:

```bash
npm install
```

### 3. Add Your Credentials to Your Environment

Set the following variables in your shell profile (for example `~/.zshrc`) or another environment your Node process will inherit. Replace the placeholders with your real values:

```bash
# === Mr. Bill (Basecamp) Configuration ===
export BASECAMP_CLIENT_ID="your-client-id"
export BASECAMP_CLIENT_SECRET="your-client-secret"
export BASECAMP_ACCOUNT_ID="your-account-id"
export BASECAMP_PROJECT_ID="your-project-id"
export USER_AGENT_NAME="Mr. Bill"
export USER_AGENT_CONTACT="your@email.com"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

If you edited a shell profile, reload it (for example `source ~/.zshrc`).

Register the OAuth application at [Launchpad](https://launchpad.37signals.com/integrations) with the redirect URI `http://localhost:3737/callback`.

### 4. Run the Authorization Flow

```bash
npm run authorize
```

This will:

- Listen on `127.0.0.1:3737` (loopback only)
- Open your browser to Basecamp’s OAuth page (or print the URL if the browser cannot be opened)
- Let you grant access to “Mr. Bill”
- Save the resulting access and refresh tokens to `~/.mr-bill/tokens.json`

You should see a success message. The token directory is created for you; you do not need to create an empty tokens file first.

---

## How to Use

1. Copy bill text to the clipboard (a renewal page, an invoice email, and so on).
2. Run:

   ```bash
   node bill.js
   ```

3. Review the extracted vendor, amount, due date, and summary.
4. Type `y` to create the Basecamp to-do, or anything else to cancel.

`npm test` runs the local unit tests and does **not** call Basecamp or Anthropic. `npm run test-todo` is a separate plumbing check that **does** create a real Basecamp to-do; only run it when you intend to do that.

---

## Security Notes

- Never commit `.env`, `tokens.json`, or any file containing real credentials. The `.gitignore` in this project is configured to ignore these files.
- Keeping secrets in `~/.mr-bill/` (outside the project) and in environment variables keeps credentials out of the repository working tree. That is not a substitute for reviewing Git history before a public release.
- If you need to rotate tokens, delete `~/.mr-bill/tokens.json` and re-run `npm run authorize`. If a credential was ever committed, rotate it and treat history cleanup as a separate, explicit decision.
- The OAuth callback is only accepted as a GET to `/callback` with a matching, single-use `state` parameter. Malformed or repeated callbacks are rejected.

---

## Project Structure

```
mr-bill/
├── authorize.js          # One-time OAuth flow
├── basecamp.js           # Shared Basecamp API helpers
├── bill.js               # Main bill parsing logic
├── lib/                  # OAuth, token-file, and model-output helpers
├── test/                 # Unit tests (no live API calls)
├── package.json
├── README.md             # This file
├── COLOPHON.md           # How this repository was made
├── AGENTS.md             # Instructions for AI coding agents
└── test-todo.js          # Optional live Basecamp plumbing check
```

Secrets live here instead:

```
~/.mr-bill/
└── tokens.json
```

---

## If Something Breaks

1. Make sure the environment variables above are set in the shell that runs the tool.
2. Check that `~/.mr-bill/tokens.json` exists and contains valid tokens, or re-run `npm run authorize`.
3. Check the console output — the code has error messages for missing credentials, invalid model output, and failed API calls.

---

## License

Copyright (c) 2026 Lieder Digital. All rights reserved. This repository is public for viewing only; no permission is granted to use, copy, modify, or distribute this code.

How this repository was made is recorded in [COLOPHON.md](COLOPHON.md).
