# Security model

RefRescue intentionally exposes a very small read-only surface.

## Controls in v0.1

- Dedicated Chrome profile, separate from your everyday browser profile
- Chrome DevTools bound to loopback only
- RefRescue API bound to loopback only
- High-entropy bearer token required for every `/api/*` request
- Scholarly-domain allowlist by default
- Local/private URLs blocked
- No cookie-export endpoint
- No credential-export endpoint
- No JavaScript supplied by the model is executed
- No arbitrary clicking, form submission, upload, or write action
- Response-size and PDF page-range limits
- Basic per-source rate limiting
- Page content treated as untrusted in the recommended GPT instructions

## Threat model

The main remaining risk is indirect prompt injection from hostile webpage/PDF content. The domain allowlist and read-only API reduce what an injected instruction can do, but no browser automation system should be considered risk-free.

Use a dedicated browser profile containing only MyLOFT/publisher sessions. Do not log into personal email, banking, social media, password managers, or unrelated accounts in that profile.

## Reporting

If you find a security issue, do not include real institutional credentials or session cookies in an issue. Reproduce with a test profile if possible.
