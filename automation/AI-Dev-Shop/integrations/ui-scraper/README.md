# ui-scraper

Crawl a website and capture its pages (structure, styles, assets) so the UI can be reproduced later.

## Purpose

Given a target URL, spider the site and collect per-page snapshots:
- Full DOM structure
- Computed styles / CSS
- Asset references (images, fonts, icons)
- Route/page inventory

The output feeds into a later step that reconstructs the UI in a target framework.

## Setup

Requires Node.js 18+.

```bash
cd integrations/ui-scraper
npm init -y
npm install crawlee playwright
```

Playwright browsers (Chromium etc.) install automatically with Crawlee's PlaywrightCrawler, or run:

```bash
npx playwright install chromium
```

## Usage

TBD — crawler entry point and config will be added after setup.
