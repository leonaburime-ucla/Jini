# Integration Ideas

## Bright Data (brightdata/skills on GitHub)

Claude Code plugin with MCP server integration — web scraping infrastructure as a service with native AI agent support.

Sources:
- https://docs.brightdata.com/scraping-automation/introduction
- https://docs.brightdata.com/ai/mcp-server/tools
- https://github.com/brightdata/brightdata-mcp
- https://github.com/brightdata/cli
- https://github.com/brightdata/skills

**What it gives us over WebFetch/WebSearch:**

- Bypasses anti-bot, CAPTCHAs, JS rendering automatically — WebFetch fails on all of these
- Structured JSON extraction from 40+ platforms (LinkedIn, Amazon, Instagram, TikTok, YouTube, Reddit, Zillow, etc.) — no DIY parsing
- 4 proxy network types (datacenter, ISP, residential, mobile) with IP rotation — we have nothing like this
- 60+ MCP tools that plug directly into Claude Code agents
- CLI tool (`bdata`) that pipes into shell workflows

**Web access product surface:**

- Unlocker API — unblocks protected pages with retries, sessions, CAPTCHA handling, browser fingerprinting, and proxy rotation
- Search/SERP API — structured search engine results without building custom SERP scrapers
- Browser API — remote browser automation for JS-heavy pages and anti-bot flows
- Crawl API — managed crawling for multi-page sites instead of one-off fetches
- Easy Scraper / Scraper APIs — prebuilt structured extraction paths for common targets
- Bright Shield — protection/risk controls around automated web access

**MCP tool groups beyond generic scraping:**

- Ecommerce data
- Social media data
- Browser automation
- Business intelligence
- Finance and market data
- Research workflows
- App store data
- Travel data
- Advanced scraping utilities
- GEO / LLM visibility checks
- Code and package intelligence

**Code/package intelligence for agents:**

- npm and PyPI package metadata
- Package versions and release information
- README/package details
- Dependency/package lookup useful for current-library research

This is directly relevant to Programmer, Software Architect, Code Review, and
Security agents when they need current dependency facts instead of model memory.

**GEO / LLM visibility:**

- Query AI-answer surfaces such as ChatGPT, Grok, and Perplexity-style outputs
- Track whether a product, brand, competitor, or concept appears in AI-generated answers
- Useful for market research, positioning, SEO/GEO analysis, and launch audits

**CLI workflow surface (`bdata`):**

- `scrape`, `search`, and target discovery workflows
- scraper create/run/heal/approve lifecycle
- pipelines for many common platforms
- browser automation controls
- proxy zone and budget management
- skill installation helpers
- MCP config installation helpers

**Skills repo surface:**

- MCP usage skill
- CLI usage skill
- proxy code-generation guidance
- Python SDK best practices
- Scraper Studio guidance
- Bright Data operational best practices

**Competitive intelligence modules (replaces $15K–$50K/year enterprise tools):**

- Competitor snapshots
- Pricing intelligence
- Review mining
- Hiring signal analysis
- Content & SEO battles
- Market landscape mapping

**AI scraper builder:**

- Describe a target in natural language, it builds the extractor
- Handles pagination (7 strategies), async/sync modes, automatic fallback
- Self-healing scraper workflow via CLI/Scraper Studio should be evaluated for long-lived research pipelines

**Why it matters for our agents:**

- Research/discovery agents get reliable access to live web data behind protections
- Structured output feeds directly into agent pipelines without parsing glue
- The MCP integration means our agents could call it natively — no custom wrappers needed
- Competitive intelligence skills could power a dedicated market-research agent
- Code/package intelligence could reduce hallucinated dependency guidance
- Browser/Crawl APIs could support QA, Docs, and Security agents when a site needs JS-rendered or multi-page inspection
- GEO/LLM visibility could support product, launch, and market-positioning workflows

**Trade-offs:**

- Paid per request — cost scales with usage
- Dependency on a third-party service for core data access
- MIT-licensed plugin, but requires Bright Data account + API key
- Bright Data access may cross legal/compliance boundaries depending on site terms, jurisdiction, and data type
- Needs strict budget, rate, and credential controls before becoming default agent behavior
