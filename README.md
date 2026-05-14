# Mr. Bill

A small local Node.js tool for interacting with Basecamp (OAuth + bill parsing automation).

Originally built as a quick internal utility. Over time it was cleaned up for better security and maintainability.

---

## Project History & What Changed

### Original Setup (Before May 2026)

- Secrets (API keys, tokens) were stored in a local `.env` file and `tokens.json` inside the project folder.
- Used the `dotenv` package to load environment variables from `.env`.
- Tokens were read/written directly from a `tokens.json` file in the project root.
- This worked, but was not ideal from a security or best-practice standpoint.

### Current Setup (May 2026+)

We moved to a cleaner and more secure architecture:

- **No more local `.env` file** in the project.
- **Client credentials** (Client ID, Client Secret, Account ID, etc.) are now loaded from your shell environment (`~/.zshrc`).
- **OAuth tokens** are stored in a dedicated location outside the project: `~/.mr-bill/tokens.json`.
- The `dotenv` package is no longer used.
- All sensitive data is now either in your shell profile or in `~/.mr-bill/`.

This makes the project safer to share, backup, or hand off to someone else.

---

## Current Architecture

| Secret Type          | Where It's Stored                     | How It's Loaded          |
|----------------------|---------------------------------------|--------------------------|
| Client credentials   | `~/.zshrc` (environment variables)    | `process.env`            |
| OAuth tokens         | `~/.mr-bill/tokens.json`              | Custom `loadTokens()`    |
| Code                 | `~/Developer/mr-bill/`                | Normal project files     |

---

## Setup Instructions (Clean Way)

### 1. Prerequisites

Make sure you have Node.js installed:

```bash
node --version
```

You should see v18 or higher.

### 2. Install Dependencies

From inside the `mr-bill` folder:

```bash
npm install
```

This installs the required packages (no `dotenv` anymore).

### 3. Add Your Basecamp Credentials to Your Shell

Open your shell configuration file:

```bash
open ~/.zshrc
```

Add the following lines at the bottom (replace the values with your real ones):

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

Save the file, then reload your shell:

```bash
source ~/.zshrc
```

### 4. Set Up Your Tokens File

Create the config directory and tokens file:

```bash
mkdir -p ~/.mr-bill
touch ~/.mr-bill/tokens.json
```

The first time you run the authorization flow, the tool will populate this file.

### 5. Run the Authorization Flow

```bash
npm run authorize
```

This will:
- Open your browser to Basecamp’s OAuth page
- Let you grant access to “Mr. Bill”
- Save the resulting access + refresh tokens to `~/.mr-bill/tokens.json`

You should see a success message.

---

## How to Use

After setup, you can run the various scripts (e.g. `bill.js`, `test-todo.js`, etc.) directly with Node. The tool will automatically use the credentials from your environment and the tokens from `~/.mr-bill/tokens.json`.

Example:

```bash
node bill.js
```

---

## Security Notes

- Never commit `.env`, `tokens.json`, or any file containing real credentials.
- The `.gitignore` in this project is configured to ignore these files.
- Keeping secrets in `~/.mr-bill/` (outside the project) makes the repository safe to share or publish.
- If you ever need to rotate tokens, simply delete `~/.mr-bill/tokens.json` and re-run `npm run authorize`.

---

## Project Structure

```
mr-bill/
├── authorize.js          # One-time OAuth flow
├── basecamp.js           # Shared Basecamp API helpers
├── bill.js               # Main bill parsing logic
├── package.json
├── README.md             # This file
└── test-todo.js
```

Secrets live here instead:

```
~/.mr-bill/
└── tokens.json
```

---

## If Something Breaks

1. Make sure your environment variables are set in `~/.zshrc` and that you ran `source ~/.zshrc`.
2. Check that `~/.mr-bill/tokens.json` exists and contains valid tokens.
3. Re-run `npm run authorize` if your tokens have expired.
4. Check the console output — the code has decent error messages for missing credentials.

If you're still stuck, the original planning and thinking behind this tool is documented in the historical `lotflow` repository.
