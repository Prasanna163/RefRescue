# Privacy

RefRescue is designed as a personal, read-only bridge.

## What stays on your computer

- MyLOFT username/password or institutional SSO credentials
- MyLOFT extension session
- Publisher cookies and browser storage
- The dedicated Chrome profile

RefRescue talks to Chrome through the local Chrome DevTools Protocol endpoint on `127.0.0.1:9222`. The public tunnel should expose only RefRescue's HTTP API on port `8787`, never the Chrome debugging port.

## What leaves your computer

When you ask the GPT to read a paper, RefRescue returns extracted text and metadata for that specific request through your HTTPS tunnel. That returned content is sent to ChatGPT and is governed by your ChatGPT/OpenAI account and data-control settings.

The bridge does not intentionally return browser cookies, passwords, local storage, authentication headers, or the MyLOFT session token.

## Logging

RefRescue does not log paper text by default. It logs startup information and errors to the local terminal.

## Sharing

Keep the Custom GPT private. Anyone who can invoke a GPT configured with your RefRescue action could cause requests to be made through your personal institutional browser session while your bridge is online.
