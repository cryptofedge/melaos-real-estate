# Melao's Real Estate Development

Marketing site for Melao's Real Estate Development — a Texas homebuilder of single-family
homes and master-planned residential communities across Austin, Dallas–Fort Worth,
Houston and San Antonio.

**Live site:** https://cryptofedge.github.io/melaos-real-estate/

## What's in here

A single self-contained page — `index.html`. No build step, no dependencies to install.
Open the file in a browser and it runs.

| Section | Notes |
| --- | --- |
| Header | Brand mark + wordmark, primary nav, "Schedule a Tour" CTA, mobile drawer under 1024px |
| Hero | Headline, subhead, trust stats, and a quick filter bar (city / price / beds) |
| Communities | Six master-planned neighborhoods with status badges, lot sizes and amenities |
| Floor plans | **40 homes** across three tabs — 14 single-story, 16 two-story, 10 custom spec |
| Custom builds | Build-on-your-lot pitch and the standard specification list |
| Process | Four-stage build workflow plus warranty and certification callouts |
| About | Company story, homeowner testimonials, energy and warranty certifications |
| Contact | Private tour booking form with client-side validation |
| Site health | Live status panel — runs checks in-browser, shows recent CI runs |

Plus `status.html`, the **resident portal**: unit lookup, live 1-2-10 warranty countdowns,
a seasonal upkeep checklist that persists per unit, service history, and intake for
maintenance requests, complaints and questions (each routed with its own categories and
reference prefix).
| Footer | Equal Housing Opportunity, Texas disclosures, sitemap, social links |

## Interactivity

Everything is vanilla JS in one IIFE at the bottom of the file:

- **Quick filter** — city, price band and bedroom count filter both the community grid and
  all 40 homes at once, with a live `aria-live` result count.
- **Tabs** — full keyboard support (arrow keys, Home, End) with correct `aria-selected` state.
- **Floor plan modal** — each home opens a schematic layout generated from its own bed count,
  garage size and story type. Focus is trapped, Escape closes, focus returns to the trigger.
- **Mobile drawer** — same focus trap and Escape handling, auto-closes at desktop width.
- **Contact form** — inline field errors, `aria-invalid`, focus moves to the first bad field.

## Design system

| Token | Value | Use |
| --- | --- | --- |
| `cloud` | `#F9FAFB` | Page background |
| `ink` | `#111827` | Body text, dark sections |
| `slate7` | `#1F2937` | Secondary text |
| `gold` | `#C5A059` | CTAs, badges, borders |
| `gilt` | `#D4AF37` | Highlights on dark |
| `sand` | `#F3EFE6` | Amenity chips, icon wells |

Type is Plus Jakarta Sans for headings, Inter for body. Tailwind is loaded from the Play CDN
and configured inline in the `<head>`.

## Swapping in real content

**Photography.** Every image slot is a `.ph` block with an inline SVG line drawing. Replace
the `.ph` element with a real image and it inherits the aspect ratio:

```html
<img src="img/cypress-grove.jpg" alt="Cypress Grove model home" class="h-full w-full object-cover" />
```

**Logo.** The brand mark is the `#brandMark` SVG symbol near the top of `<body>`. Swap that
symbol's contents to use the official vector artwork.

**Form.** The contact form validates and confirms client-side only — there is no backend.
Point it at your CRM at the marked `fetch(...)` line near the end of the script.

**Content.** The 40 homes live in the `RAW` array in the script — name, community, story type,
price, beds, baths, square feet, garage, status. Communities are static markup in the
`#communityGrid` section; keep the `data-city`, `data-price` and `data-beds` attributes in
sync so filtering keeps working.

## Before this goes live

Prices, plans, testimonials and certifications on the page are placeholder content written to
show the layout. Replace them with real, substantiated figures — a homebuilder site carries
advertising and Fair Housing obligations, and the TREC and warranty language in the footer
should be reviewed by counsel against the actual entity registration.

## Production notes

For a real deployment, replace the Tailwind Play CDN with a compiled stylesheet
(`npx tailwindcss -i in.css -o dist.css --minify`), self-host the two fonts, and add real
`<meta property="og:*">` tags with a social share image.

## Maintenance

Automated checks run on every push, on pull requests, and daily at 13:00 UTC.
Workflow: [`.github/workflows/maintenance.yml`](.github/workflows/maintenance.yml).

### Browser smoke tests

59 Playwright tests across seven device profiles — 413 runs per pass:

| Profile | Engine |
| --- | --- |
| Desktop Chrome | Chromium |
| Desktop Safari | WebKit |
| iPhone 14 (portrait and landscape) | WebKit |
| Pixel 7 | Chromium |
| iPad (gen 7) | WebKit |
| Galaxy Tab S4 | Chromium |

iPhone and iPad run **WebKit**, the engine behind every browser on iOS. It diverges
from Chromium in ways that matter — this matrix immediately caught a focus bug that
only affected Safari and iOS users.

The tests cover the things that have actually broken here, plus the dependencies the
page cannot render without:

- **Stylesheet loaded.** Asserts computed styles from the custom palette. The Tailwind
  Play CDN is the biggest single fragility — if it fails, every class silently does
  nothing and the page renders as unstyled HTML with no error in the console.
- **No console errors and no request 404s** anywhere on the page.
- **Inventory intact.** 40 homes split 14 / 16 / 10 across the tabs, 6 communities, and
  every card carrying the `data-city` / `data-price` / `data-beds` the filters read.
- **Filters** narrow both grids, report an accurate count, and only show matching cards.
- **Tabs** switch panels and respond to arrow, Home and End keys.
- **Floor plan modal** stays fully hidden when closed (it once leaked as an empty shell),
  opens with populated stats and a generated drawing, renders both floors for two-story
  plans, closes on Escape and returns focus to the trigger.
- **Contact form** rejects empty and malformed input with `aria-invalid`, and confirms a
  valid submission.
- **Layout** never scrolls sideways at 375, 768 or 1280px; the mobile drawer opens and
  closes.
- **Accessibility floor**: one `h1`, every control labelled, every image has `alt`, and
  every internal anchor resolves to a real element.
- **Maintenance panel** runs its checks when scrolled into view and reports healthy.

```bash
npm install
npm run setup
npm test
```

PowerShell has no `&&` operator, so these are three separate commands rather than
one chain. `npm run setup` downloads the Chromium build Playwright drives
(~115 MB, once per machine).

### Live site health

[`scripts/check-live.mjs`](scripts/check-live.mjs) checks the published site — the
failure modes that only appear in production: Pages serving a stale build, an asset
that never got committed, Open Graph tags edited back to relative paths so link
previews break silently, a share card too large for messengers, or an upstream CDN
going down.

```bash
node scripts/check-live.mjs
```

Works as-is in both PowerShell and bash. Point it at any deployment by passing a URL. When the **scheduled** run fails it opens
a GitHub issue labelled `maintenance` (or comments on the open one) so a broken site
surfaces instead of sitting as a red tick in the Actions tab.
