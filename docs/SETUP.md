# Setup: MyLOFT → RefRescue → ChatGPT Plus

## 1. Requirements

- Node.js 22 or newer
- Google Chrome or Microsoft Edge
- Your existing MyLOFT account and institutional entitlement
- The MyLOFT browser extension
- An ngrok account/CLI, or another trusted HTTPS tunnel with a stable hostname
- Optional: Poppler `pdftotext` for the best PDF extraction. RefRescue attempts Chrome accessibility extraction as a fallback.

## 2. Configure RefRescue

Clone the repository and enter it.

```bash
git clone https://github.com/Prasanna163/RefRescue.git
cd RefRescue
```

Create `.env` from `.env.example`.

Generate a bearer token:

```bash
npm run token
```

Paste the generated token into:

```text
REFRESCUE_TOKEN=...
```

Do not commit `.env`.

## 3. Start the dedicated research browser

In terminal 1:

```bash
npm run chrome
```

RefRescue launches Chrome/Edge with a separate profile and remote debugging restricted to loopback. Chrome 136+ requires a non-default user-data directory for remote debugging, so the dedicated profile is intentional.

In that browser profile:

1. Install the official MyLOFT extension.
2. Log into MyLOFT normally yourself.
3. Open one subscribed publisher resource manually to verify entitlement works.
4. Keep this browser open when using RefRescue.

Do not use this profile for unrelated personal accounts.

## 4. Start RefRescue

In terminal 2:

```bash
npm start
```

Check locally:

```text
http://127.0.0.1:8787/
```

The API remains on loopback. Do not expose port `9222`.

## 5. Give the API a stable HTTPS URL

With ngrok configured for your account:

```bash
ngrok http 8787
```

The free ngrok plan provides one account-specific development domain. Record the HTTPS URL, for example:

```text
https://your-assigned-domain.ngrok-free.app
```

Open:

```text
https://your-assigned-domain.ngrok-free.app/openapi.json
```

The schema should report the ngrok HTTPS URL under `servers`.

## 6. Create the private GPT

On ChatGPT web:

1. Create a new GPT.
2. Name it something like `RefRescue Research`.
3. Enable Web Search.
4. In **Actions**, create a new action.
5. Set authentication to **API key → Bearer**.
6. Use the same value as `REFRESCUE_TOKEN`.
7. Import or paste the OpenAPI schema from `/openapi.json`.
8. Paste the contents of `gpt-instructions.md` into the GPT instructions.
9. Test `getBridgeStatus` in Preview.
10. Keep the GPT **Private / Only me**.

Do not publish or share a GPT carrying the bearer token for your personal institutional browser session.

## 7. First real test

Ask the private GPT:

> Use web search to find the DOI for a paper I name, then use RefRescue to read its experimental section. Tell me whether full text was actually accessible through my browser session.

A successful flow is:

```text
ChatGPT web search
      ↓ DOI / publisher URL
RefRescue Action over HTTPS
      ↓ bearer token
localhost:8787
      ↓ CDP on localhost only
Dedicated Chrome + MyLOFT extension
      ↓
Publisher content allowed by your account
      ↓
Extracted text only
      ↓
ChatGPT analysis
```

## 8. Publisher domains

RefRescue ships with a conservative scholarly-domain allowlist. If a legitimate publisher or supplementary-data host is blocked, set `REFRESCUE_ALLOWED_HOSTS` in `.env` to a comma-separated list and restart RefRescue.

Important: setting this variable replaces the built-in defaults, so include every host suffix you still need.

## 9. Stop access

Close any of the following to cut the connection:

- ngrok
- RefRescue (`Ctrl+C`)
- the dedicated Chrome profile

Deleting `~/.refrescue/chrome-profile` removes the dedicated local browser profile and its saved session data.
