# RefRescue

**Your institutional library access, readable by your AI research workflow without handing over your password or cookies.**

RefRescue is a local, read-only bridge between ChatGPT and a dedicated Chrome/Edge profile in which **you** are already logged into MyLOFT. It lets a private Custom GPT open DOI/publisher links through that browser and receive extracted article/PDF text for analysis.

It does not log into MyLOFT for you, bypass publisher access controls, export cookies, or create a cloud copy of your browser profile.

> Status: v0.1 MVP. Personal research use. Not affiliated with MyLOFT, OpenAI, ngrok, or any publisher.

## Why this architecture

MyLOFT's web workflow uses its browser extension for remote access to institution-subscribed e-resources. RefRescue therefore controls a **dedicated authenticated browser session** rather than copying credentials into an AI service.

Chrome 136+ also requires remote debugging to use a non-default user-data directory. RefRescue embraces that restriction and creates a separate research-only profile.

```text
Private Custom GPT
       │ HTTPS Action + bearer token
       ▼
   ngrok tunnel
       │
       ▼
127.0.0.1:8787  RefRescue
       │ CDP, loopback only
       ▼
127.0.0.1:9222  Dedicated Chrome/Edge profile
       │
       ├─ MyLOFT extension + your login
       └─ publisher pages / PDFs you are entitled to open
```

## What the GPT can do

- Check whether the research browser is online
- Resolve/read a DOI through the browser
- Open a publisher or supporting-information URL
- Extract visible HTML article text, headings, metadata, and links
- Extract PDF text in bounded page ranges
- Find a phrase inside the currently open article

## What it cannot do

- Read or export your browser cookies
- Return your MyLOFT password or SSO token
- Click arbitrary buttons or submit forms
- Upload files to publisher sites
- Modify your library account
- Circumvent a paper your institution does not permit you to access
- Bulk-mirror a publisher database

## Quick start

```bash
git clone https://github.com/Prasanna163/RefRescue.git
cd RefRescue
cp .env.example .env
npm run token        # put the output in REFRESCUE_TOKEN inside .env
npm run chrome       # terminal 1: install/login to MyLOFT in this dedicated profile once
npm start            # terminal 2
ngrok http 8787      # terminal 3
```

Then create a **private Custom GPT** on ChatGPT web, add an Action with **API key → Bearer** authentication, use your `REFRESCUE_TOKEN`, and import the schema from:

```text
https://YOUR-NGROK-DOMAIN/openapi.json
```

Paste [`gpt-instructions.md`](./gpt-instructions.md) into its instructions.

See **[docs/SETUP.md](./docs/SETUP.md)** for the full setup.

## Example

Ask:

> Find papers on TCPP-COOH coupling to amine-functionalized carbon dots. Use web search for discovery, then use RefRescue to read the experimental sections and supporting information of the most relevant papers I can access. Compare EDC/NHS conditions, solvent, stoichiometry, purification, and how metallation could affect electronic coupling.

The GPT can discover papers publicly, then invoke RefRescue only when it needs the actual full text behind your existing entitlement.

## Security

The tunnel exposes **port 8787 only**. Never expose Chrome's debugging port `9222` to the internet.

Keep the GPT private. Its action carries a bearer token that authorizes use of your personal RefRescue bridge while it is online.

RefRescue uses a scholarly-domain allowlist, blocks local/private URLs, limits response sizes, and offers no write/click endpoints. Still, browser-connected AI tools have prompt-injection risk, so use only the dedicated research profile.

Read [SECURITY.md](./SECURITY.md) and [PRIVACY.md](./PRIVACY.md).

## Access and publisher rules

RefRescue is intended only to automate **reading that your own account is already permitted to do**. Your institution and publishers may impose terms on automated access, downloading, or high-volume retrieval. Use targeted, human-scale research requests and follow those terms.

If the browser receives a paywall or access-denied page, RefRescue should report the page it actually received. It is not an access-control bypass.

## License

MIT.
