# RefRescue v0.2: entitlement gateway

RefRescue is deliberately **not a literature search engine**. Discovery, relevance ranking, citation chasing and scientific reasoning remain in ChatGPT's normal research workflow.

RefRescue receives a specific publisher/DOI URL only when institutional entitlement is needed.

## Tool contract

- `entitlement_status()`
- `open_with_entitlement(url)`
- `download_with_entitlement(url)`

No search tool is exposed.

## MyLOFT model

MyLOFT is the first entitlement provider. Its browser extension is loaded into an on-demand cloud Chrome session. A persisted cloud browser profile stores the authenticated MyLOFT state between runs.

The browser does not need to remain running. A new short-lived browser is created when a tool is called, using the persisted profile, and released after the requested paper has been read/downloaded.

## One-time bootstrap

1. Create a Steel account/API key.
2. Set `MYLOFT_CHROME_WEBSTORE_URL` to the official MyLOFT extension listing.
3. Run `npm run bootstrap:myloft`.
4. Open the returned secure session viewer.
5. Sign into MyLOFT yourself and verify one subscribed publisher page.
6. Return to the terminal and press Enter.
7. Save the returned `STEEL_PROFILE_ID` and `STEEL_MYLOFT_EXTENSION_ID` as server-side secrets.

No MyLOFT password is stored in RefRescue configuration.

## ChatGPT integration

The `/mcp` endpoint is a read-only remote MCP server. It is protected by `REFRESCUE_TOKEN` in the single-user MVP.

For a Canva-like production experience, the same three tools should be wrapped in the Apps SDK distribution/authentication flow and submitted for plugin-directory review. The entitlement backend does not need to change.

## PDF storage

`download_with_entitlement` stores authorized PDFs through the configured file store and returns a download URL. Vercel Blob is supported when its credentials/OIDC are available; otherwise the Node server uses a private local directory with signed links.
