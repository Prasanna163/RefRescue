# RefRescue

**Institutional access as a pass, not a search engine.**

RefRescue gives an AI research workflow one narrowly scoped capability: open or download a *specific* scholarly URL using the user's existing institutional entitlement. MyLOFT is the first provider.

Normal literature discovery stays normal. ChatGPT searches the web, identifies useful papers and follows citations as usual. Only when a particular paper needs subscription access does it call RefRescue.

```text
ChatGPT research
  ├─ normal web / DOI / publisher discovery
  └─ paywalled paper selected
          │
          ▼
     RefRescue MCP
          │
          ▼
 short-lived cloud Chrome
 + persisted MyLOFT profile
 + MyLOFT extension
          │
          ▼
 authenticated publisher
          │
          ├─ full text → ChatGPT
          └─ PDF / SI → saved file URL
```

## Three tools

- `entitlement_status`
- `open_with_entitlement(url)`
- `download_with_entitlement(url)`

There is intentionally **no MyLOFT search tool**.

## Device independence

The browser state lives in a persisted cloud profile. Your laptop can be off. RefRescue launches a browser only for the duration of an entitlement request and then releases it.

## v0.2 quick start

```bash
npm install
cp .env.cloud.example .env
npm run token
# configure STEEL_API_KEY + official MyLOFT Chrome Web Store URL
npm run bootstrap:myloft
# add the returned profile + extension IDs to .env
npm start
```

See [`docs/CLOUD-ARCHITECTURE.md`](docs/CLOUD-ARCHITECTURE.md).

## Security boundary

RefRescue does not expose cookies, passwords, browser storage, arbitrary clicks, arbitrary JavaScript, forms, uploads or general web browsing. The MCP server accepts only scholarly URLs on its allowlist and only returns requested page/PDF content.

The MyLOFT password is entered by the user directly into the remote browser during bootstrap and is never passed to ChatGPT or committed to this repository.

## Legacy local bridge

The v0.1 laptop bridge is still available with `npm run start:local`; it is retained only as a development fallback. v0.2 is the device-independent cloud path.
