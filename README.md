# Mr. Bill

A tiny local tool that takes messy bill text (pasted from a renewal email, an account page, whatever) and creates a Basecamp to-do with a due date.

Currently Step 1: OAuth authorization only. Main tool coming in Step 2.

## One-time setup

### 1. Make sure Node is installed

In Terminal:

```
node --version
```

If you see `v18.x` or higher, you're good. If not, install Node from https://nodejs.org (LTS version).

### 2. Install dependencies

From inside the `mr-bill` folder:

```
npm install
```

This installs one tiny package (`dotenv`) into a `node_modules` folder.

### 3. Fill in your Client Secret

Open `.env` in any text editor. Two things to change:

- **BASECAMP_CLIENT_SECRET** — paste the Client Secret from your launchpad.37signals.com page (the value next to the Client ID).
- **USER_AGENT_CONTACT** — put your email address. Basecamp requires this so they can reach you if your integration misbehaves.

Save the file.

### 4. Authorize

```
npm run authorize
```

What happens:
1. A small local web server starts on port 3737.
2. Your browser opens to a Basecamp page asking if you want to let "Mr. Bill" access your account.
3. Click **Yes, I'll allow access**.
4. You'll see a success page. Close the tab.
5. Back in Terminal, you'll see "✓ Authorization successful" and a new file `tokens.json` will appear in the folder.

You're done with Step 1. Do **not** share or commit `tokens.json` — it's already in `.gitignore`.

## What's next

Come back to the chat and tell Claude "authorized." Step 2 adds the actual bill-creation command.
