# Elucify Chrome Extension

Adds an Elucify panel to every arXiv abstract page, letting you jump straight to AI-powered analysis with one click.

## What it does

On any `arxiv.org/abs/...` page the extension injects a panel below the abstract showing Elucify's 9 analysis sections and an **Analyze in Elucify** button. Clicking the button opens Elucify with that paper's arXiv URL already filled in.

## How to install (unpacked, for local use)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder
5. Visit any arXiv abstract page — the Elucify panel appears automatically

## File structure

```
chrome-extension/
  manifest.json     Extension config
  content.js        Injected into arxiv.org/abs/* pages
  content.css       Panel styles
  icons/
    icon16.png
    icon48.png
    icon128.png
```

## Updating the Elucify URL

If you move to a custom domain, update the `ELUCIFY_URL` constant at the top of `content.js`.
