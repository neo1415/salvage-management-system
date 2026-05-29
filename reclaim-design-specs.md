# Reclaim — Design System Specification
> Product: Reclaim — Salvage Auction Platform for Insurance Companies
> Design Language: Derived from Check (wearecheck.co) — adapted for insurance/fintech context
> Version: 1.0
> Format: Agent-readable Markdown. Every value here is implementation-ready.

---

## Table of Contents
1. [Brand & Color System](#1-brand--color-system)
2. [Typography](#2-typography)
3. [Spacing & Layout Grid](#3-spacing--layout-grid)
4. [Page Architecture](#4-page-architecture)
5. [Motion & Animation System](#5-motion--animation-system)
6. [Component Library](#6-component-library)
7. [Interaction Patterns](#7-interaction-patterns)
8. [Aspect Ratio & Sizing Rules](#8-aspect-ratio--sizing-rules)
9. [Tech Notes & Implementation Guide](#9-tech-notes--implementation-guide)

---

## 1. Brand & Color System

### Brand Positioning
Reclaim is a **salvage auction platform for insurance companies**. The design language is editorial, precise, and industrial — adapted from the Check visual system. It signals trust and compliance (insurance context) while remaining bold and modern (tech context).

**Tagline:** "Where total losses become recovered capital."
**Logo mark:** Wordmark "Reclaim" in Syne 800, preceded by a 7px amber dot (color: `#D97706`).

### CSS Custom Properties

```css
:root {
  /* ── Core Palette ───────────────────────── */
  --black:       #0C0C0B;         /* primary dark bg, text on light */
  --white:       #F4F3EE;         /* primary light bg — warm, NOT pure white */
  --off-white:   #ECEAE3;         /* card surfaces, row highlights */
  --warm-gray:   #C6C4BD;         /* the 2px gap color between sections */
  --mid:         #88877F;         /* secondary/muted text, labels */
  --border:      rgba(12,12,11,0.11);    /* hairline borders on light sections */
  --border-dk:   rgba(255,255,255,0.09); /* hairline borders on dark sections */

  /* ── Brand Accents ──────────────────────── */
  --amber:       #D97706;   /* PRIMARY accent — recovery/value, highlights, SVG fills */
  --red:         #DC2F2F;   /* URGENCY accent — LIVE badge, ending-soon timers */

  /* ── Typography ─────────────────────────── */
  --font-d: 'Syne', sans-serif;
  --font-b: 'DM Sans', sans-serif;
  --font-m: 'DM Mono', monospace;

  /* ── Easing ─────────────────────────────── */
  --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-quad: cubic-bezier(0.45, 0, 0.55, 1);
}
```

### Color Usage Matrix

| Context | Heading | Body text | Muted/label | Border |
|---|---|---|---|---|
| **Dark section** (`--black`) | `#F4F3EE` | `rgba(244,243,238,0.5)` | `#88877F` | `rgba(255,255,255,0.09)` |
| **Light section** (`--white`) | `#0C0C0B` | `#0C0C0B` | `#88877F` | `rgba(12,12,11,0.11)` |
| **Card surface** (`--off-white`) | `#0C0C0B` | `#0C0C0B` | `#88877F` | `rgba(12,12,11,0.11)` |
| **Amber accent** | Use for: logo dot, SVG fill highlights, cycler word, stat prefixes | | | |
| **Red accent** | Use for: LIVE badge, urgent timers, damage zone fills at low opacity | | | |

### Section Background Sequence (strict alternation)

```
Section 1 — Loader       → DARK   #0C0C0B
Section 2 — Hero         → DARK   #0C0C0B
Section 3 — About        → LIGHT  #F4F3EE
Section 4 — Services     → LIGHT  #F4F3EE (padding-top: 0, continues from About)
Section 5 — Stats        → DARK   #0C0C0B  (no section padding — cells touch nav/prev)
Section 6 — Cycler/Trust → DARK   #0C0C0B
Section 7 — Auctions     → LIGHT  #F4F3EE
Section 8 — How It Works → DARK   #0C0C0B
Section 9 — Testimonial  → LIGHT  #F4F3EE
Section 10 — CTA         → DARK   #0C0C0B
Section 11 — Footer      → DARK   #0C0C0B  (border-top: .5px solid var(--border-dk))
```

> **Critical:** The gap between every section block is exactly `2px`. The page container uses `display: flex; flex-direction: column; gap: 2px; background: var(--warm-gray)`. The warm-gray bleeds through the gaps creating a thin "slice" line. This is the signature of the design — do not use margin or padding instead.

---

## 2. Typography

### Font Stack

```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```

| Variable | Font | Used For |
|---|---|---|
| `--font-d` | Syne | All headings, hero words, nav logo, button text, stat numbers, card titles |
| `--font-b` | DM Sans | Body paragraphs, descriptions, footer body |
| `--font-m` | DM Mono | Section labels, lot numbers, tags, badges, ticker text, metadata |

### Type Scale

| Token | Font | Size | Weight | Letter-spacing | Line-height | Where |
|---|---|---|---|---|---|---|
| `hero-display` | Syne | `clamp(48px, 7.5vw, 92px)` | 800 | `-0.04em` | `1.0` | Split-text hero words |
| `section-title` | Syne | `clamp(26px, 3.8vw, 46px)` | 800 | `-0.03em` | `1.08` | Section headlines |
| `card-title` | Syne | `26px` | 800 | `-0.03em` | `1.05` | Service card headings |
| `stat-number` | Syne | `clamp(38px, 4.5vw, 64px)` | 800 | `-0.04em` | `1.0` | Stats (2.4B, 12K, 47, 48hr) |
| `lot-name` | Syne | `18px` | 700 | `-0.02em` | `1.1` | Vehicle name in auction card |
| `bid-amount` | Syne | `22px` | 800 | `-0.03em` | `1.0` | Current bid dollar amount |
| `body-large` | DM Sans | `16px` | 300 |`normal` | `1.8` | Main paragraphs |
| `body` | DM Sans | `13–14px` | 300 |`normal` | `1.75` | Card descriptions, footer body |
| `section-label` | DM Mono | `10–11px` | 400 | `0.09–0.11em` | `1.4` | "01 — About Reclaim" labels |
| `lot-number` | DM Mono | `10px` | 400 | `0.08em` | `1` | "Lot RCL-2847" identifiers |
| `badge-text` | DM Mono | `9px` | 400 | `0.08em` | `1` | LIVE / ENDING SOON / condition pills |
| `ticker-text` | DM Mono | `10px` | 400 | `0.10em` | `1` | Live bid ticker in hero |
|`nav-link` | DM Mono | `11px` | 400 | `0.07em` | `1` | Navigation items (uppercase) |

### Key Rules
- Letter-spacing `-0.04em` on Syne 800 — this is non-negotiable for the brand feel
- Body text weight: **300 (light)** — using 400 makes the page feel heavy
- All DM Mono labels are **uppercase** with generous `letter-spacing`
- Numbers in stats use `font-variant-numeric: tabular-nums` for smooth count animations

---

## 3. Spacing & Layout Grid

### Container

```css
.wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 44px;
}
@media (max-width: 900px) { .wrap { padding: 0 20px; } }
```

### Section Padding

```css
section { padding: 96px 0; }

/* Full-bleed sections (stats, loading) */
.section-fullbleed { padding: 0; width: 100%; }

/* CTA exception */
.cta-section { padding: 112px 44px; }
```

### The 2px Gap System

```css
/* Page shell */
.page {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #C6C4BD; /* warm-gray shows through as the gap color */
}
```

All internal grids also use `gap: 2px` for the same sliced-paper effect.

### Grid Patterns

```css
.grid-2    { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.grid-3    { display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; }
.grid-4    { display: grid; grid-template-columns: repeat(4,1fr); gap: 2px; }

/* About section: left copy + right stat rows */
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
}

/* Auction cards */
.auctions-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; }

/* Process/how-it-works */
.process-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 2px; }

/* Stats: full-width 4 cells */
.stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 2px; }

/* Footer */
.footer-top { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 48px; }

@media (max-width: 900px) {
  .grid-2, .grid-3, .grid-4,
  .about-grid, .auctions-grid,
  .process-grid, .stats-grid,
  .footer-top { grid-template-columns: 1fr; }
}
```

---

## 4. Page Architecture

### Complete Section Map

---

#### Section 1: Loading Screen

**Element:** Full-screen `position: fixed; inset: 0; z-index: 9000; background: #0C0C0B`
**Exit:** `opacity: 0; pointer-events: none;` over `0.6s ease` when counter hits 100%.

**Structure:**
```
[3 marquee rows — top of screen]
         ┌─────────────────┐
         │    Reclaim       │  ← Syne 800, clamp(52px→88px), #F4F3EE
         │      0%          │  ← DM Mono 12px, #88877F
         └─────────────────┘
[3 marquee rows — bottom of screen]
```

**Marquee categories (12 total rows):**
```
Top row 1 (→, 14s):  LOADING VEHICLES · LOADING RECLAIM · LOADING SALVAGE · LOADING AUCTION
Top row 2 (←, 11s):  LOADING INSURANCE · LOADING BIDDING · LOADING RECOVERY · LOADING CLAIMS
Top row 3 (→, 18s):  LOADING ADJUSTERS · LOADING TITLES · LOADING LOTS · LOADING PAYOUTS
Bottom row 1 (←, 16s): LOADING PLATFORM · LOADING VALUATION · LOADING INVENTORY · LOADING PAYMENTS
Bottom row 2 (→, 13s): LOADING FLEET · LOADING COMPLIANCE · LOADING ANALYTICS · LOADING REPORTS
Bottom row 3 (←, 20s): LOADING RECLAIM (repeated — brand saturation row)
```

**Highlighted items** (rendered at `rgba(244,243,238,0.85)` vs default `0.22`): "LOADING RECLAIM" in each row.

---

#### Section 2: Navigation

**Position:** `fixed; top: 0; z-index: 800`
**BG:** `transparent` → `#0C0C0B` on scroll > 56px (transition: 0.35s ease)

**Layout (left → center → right):**
```
[Logo: ● Reclaim]    [Platform  Auctions  Insurers  Adjusters  About]    [Sign In (pill btn)]  [Hamburger (2 lines)]
```

**Nav link style:** DM Mono, 11px, uppercase, `letter-spacing: 0.07em`, color `rgba(244,243,238,0.45)`
**Logo:** Syne 800, 16px, `letter-spacing: -0.03em` + amber dot `width: 7px; height: 7px; background: #D97706; border-radius: 50%`
**Hamburger:** 2 lines (not 3), `width: 22px; height: 1px; gap: 5px`

---

#### Section 3: Hero

**Background:** `#0C0C0B`
**Height:** `min-height: 100vh` + `padding-top: 64px` (nav clearance) + bottom padding `52px`
**Layout:** `flex; flex-direction: column; justify-content: flex-end`

**Sub-elements:**

**A. Live Bid Ticker (below fixed nav, above content):**
- `position: absolute; top: 70px` — a horizontal scrolling strip
- Contains: `LOT-ID · VEHICLE NAME · CURRENT BID ↑` pairs
- Font: DM Mono 10px, `letter-spacing: 0.10em`
- Colors: lot+name `rgba(244,243,238,0.2)` | bid amount `#D97706`
- Animation: `marqueeForward 22s linear infinite`
- Border-bottom: `.5px solid rgba(255,255,255,0.09)`

**B. Eyebrow:**
```
[28px line] Salvage Auction Platform for Insurance
```
Font: DM Mono, 11px, uppercase, `#88877F`

**C. Split-Text Headline:**

Three lines, each: `display: flex; align-items: center; padding: 14px 0; border-bottom: .5px solid rgba(255,255,255,0.09)`

```
Re          [Video slot: "Live Auctions"]
claim       [Video slot: "Bid & Win"]         Auction Platform
Value       [Video slot: "Fast Payouts"]      Insurance-Grade
```

Word styles:
- "Re" and "Value": Syne 800, `clamp(48px, 7.5vw, 92px)`, `#F4F3EE`
- "claim": Same size but `color: #D97706` (amber — brand moment)

Video slot (fixed dimensions — never use aspect-ratio here):
```css
.split-vid {
  width: 188px;
  height: 58px;       /* FIXED — no aspect-ratio */
  flex-shrink: 0;
  border-radius: 6px;
  background: rgba(244,243,238,0.06);
  border: .5px solid rgba(255,255,255,0.09);
}
```

Line label (right side):
```css
.split-tag {
  font-family: 'DM Mono';
  font-size: 10px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: #88877F;
  width: 110px;
  text-align: right;
  flex-shrink: 0;
}
```

**D. Hero footer strip (below split lines):**
- Left: subtitle text, DM Sans 300, 15px, `rgba(244,243,238,0.5)`, max-width 420px
- Right: `[Get Started →]` primary pill + `[View Auctions]` ghost pill

---

#### Section 4: About

**Background:** `#F4F3EE`
**Layout:** 2-col grid, 64px gap

**Left column:**
- Section label: "About Reclaim"
- Headline: `We turn *total losses* into recovered capital.` — "total losses" in `--mid`
- Body: DM Sans 300, 16px — explains the platform in 2 short paragraphs

**Right column:** Stack of 4 stat rows (no aspect-ratio, pure padding):
```css
.about-stat-row {
  padding: 20px 24px;
  border: .5px solid var(--border);
  background: var(--off-white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px; /* stacked with 2px between rows */
}
```
Content:
| Number | Label |
|---|---|
| 94% | Average Recovery Rate |
| 48hrs | Average Time to Sale |
| 3,200+ | Registered Buyers |
| ISO 27001 | Certified & Compliant |

Number style: Syne 800, 28px, `letter-spacing: -0.03em`
Label style: DM Mono 11px, uppercase, `#88877F`

**Reveal animation:** Rows slide in from right (`translateX(24px) → 0`), stagger 80ms each.

---

#### Section 5: Services

**Background:** `#F4F3EE` (continuation of About — `padding-top: 0`)
**Layout:** 3-column grid, `gap: 2px`

Three service cards:

| # | Verb | Service | Description |
|---|---|---|---|
| 01 | Listing | Inventory | Add salvage vehicles to live auctions in minutes. Smart intake: photos, condition reports, VIN, reserve pricing — from phone or desktop. |
| 02 | Running | Auctions | Real-time competitive bidding with automatic extensions, reserve management, and live notifications. Timestamped and auditable. |
| 03 | Settling | Claims | Direct payment processing, automated title transfer notifications, claim reconciliation. Funds in 24–72 hours. |

Card structure (content-driven height — no fixed height or aspect-ratio):
```
[Service number: "01" — DM Mono 10px muted]
[SVG icon — 52×52px]
[Service heading — Syne 800, 26px, tight tracking, 2 lines]
[Description — DM Sans 300, 13px]
["Learn More →" link — DM Mono 11px]
```

Card padding: `40px 32px`

---

#### Section 6: Stats Bar

**Background:** `#0C0C0B`
**Padding:** `0` — cells fill wall-to-wall with just `gap: 2px` between them
**Layout:** 4-column grid

| # | Value | Unit | Description |
|---|---|---|---|
| 1 | $2.4B | Recovered | Total value returned to insurers to date |
| 2 | 12K+ | Vehicles Auctioned | Across all asset classes and conditions |
| 3 | 47 | Insurance Partners | Active carriers using the platform |
| 4 | 48hr | Avg. Auction Close | From listing submission to winning bid |

Stat cell padding: `52px 40px`
Number style: Syne 800, `clamp(38px, 4.5vw, 64px)`, `#F4F3EE`, `letter-spacing: -0.04em`
Prefix ($) and suffix (B, K+, hr): `font-size: 0.55–0.6em` relative to the number
Unit label: DM Mono 10px, uppercase, `#88877F`, `margin-top: 10px`
Description: DM Sans 12px, `rgba(244,243,238,0.3)`, `margin-top: 4px`

---

#### Section 7: Cycler + Insurers

**Background:** `#0C0C0B`

**Word Cycler:**
```
We turn your              ← DM Sans 300, 20px, rgba(244,243,238,0.4)
[Losses] into recovered capital.  ← Syne 800, clamp(36px→68px), white + amber word
```
Cycling words: `Losses → Claims → Write-offs`
Amber word container: `overflow: hidden; height: 1.1em` — clips transition

**Insurer Logo Strip (bottom of section):**
- `border-top: .5px solid rgba(255,255,255,0.09)`
- Left: "Trusted by" label in DM Mono 10px muted
- Right: 7 insurer names as text logos — Syne 700 13px, `rgba(244,243,238,0.18)`, `border-left: .5px solid rgba(255,255,255,0.09)`, `padding: 0 28px`
- Hover: `rgba(244,243,238,0.5)`, transition 0.2s
- Names: Allianz / AXA Group / Zurich Re / Aviva PLC / Munich Re / Chubb Ltd / Liberty Mutual

---

#### Section 8: Live Auctions

**Background:** `#F4F3EE`
**Layout:** 3-column grid, `gap: 2px`

**Section header layout:**
```
[Left: Section label "Live Now" + title "Active Auctions"]    [Right: LIVE badge with pulsing dot]
```

**LIVE Badge:**
```css
.live-badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-m); font-size: 10px; letter-spacing: .08em;
  text-transform: uppercase; color: #DC2F2F;
  background: rgba(220,47,47,0.08); border: .5px solid rgba(220,47,47,0.25);
  padding: 5px 12px; border-radius: 100px;
}
.live-badge::before {
  content: ''; width: 6px; height: 6px;
  background: #DC2F2F; border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite; /* opacity+scale */
}
```

**Active lots:**
1. `RCL-2847` — 2022 BMW 5 Series, 530i xDrive — Flood/Total Loss — $8,400 — 14 bids — 2h 14m
2. `RCL-3102` — 2021 Tesla Model 3, LR AWD — Rear Collision/Total Loss — $12,800 — 31 bids — 47m (ENDING SOON)
3. `RCL-1984` — 2023 Toyota Camry, XSE V6 — Side Impact/Structural — $4,200 — 8 bids — 6h 30m

**Lot card structure:**
```
┌──────────────────────────────────┐
│  [Vehicle image — FIXED 192px h] │  ← height: 192px; overflow: hidden; NO aspect-ratio
│  [LIVE badge] [Condition badge]  │  ← position: absolute, top: 12px, left: 12px
├──────────────────────────────────┤
│  Lot RCL-xxxx          ⏱ Xh Xm  │  ← DM Mono 10px + DM Mono 11px timer
│  Vehicle Name                    │  ← Syne 700 18px
│  Trim — Damage type              │  ← DM Sans 300 13px muted
│  ─────────────────────────────── │  ← .5px border
│  Current Bid        [Place Bid→] │
│  $X,XXX                          │  ← Syne 800 22px
│  X bids placed                   │  ← DM Mono 10px muted
└──────────────────────────────────┘
```

**Timer color:** Urgent (`< 1hr`): `color: #DC2F2F`. Normal: `color: #0C0C0B`.
**"Place Bid →" button:** Pill, `background: #0C0C0B; color: #F4F3EE; border-radius: 100px; padding: 11px 20px; font: Syne 600 12px`

**Footer:** Centered ghost button — "View All 248 Active Lots"

---

#### Section 9: How It Works

**Background:** `#0C0C0B`
**Layout:** 4-column process grid

| Step | Title | Body summary |
|---|---|---|
| 01 | Submit Claim | Adjuster logs total-loss vehicle via claims system or intake portal. VIN, photos, condition — under 5 minutes. |
| 02 | Auction Goes Live | Published to 3,200+ buyers within hours. Real-time bidding with auto-extensions. |
| 03 | Bid Closes | Highest qualified bid wins. Buyer credentials verified, funds confirmed, title transfer initiated. |
| 04 | Funds Transferred | Net proceeds in insurer account 24–72hrs. Full audit trail + claim reconciliation report. |

Cell padding: `36px 28px`
Step number: DM Mono 10px, uppercase, `#88877F`
Icon container: `width: 40px; height: 40px; border: .5px solid rgba(255,255,255,0.09); border-radius: 50%` — contains simple SVG
Title: Syne 700, 17px, `#F4F3EE`, `letter-spacing: -0.02em`
Body: DM Sans 300, 13px, `rgba(244,243,238,0.38)`, `line-height: 1.7`

---

#### Section 10: Testimonial

**Background:** `#F4F3EE`
**Layout:** Single centered card, `max-width: 860px; margin: 0 auto`

Card padding: `56px 52px`
Quote: Syne 700, `clamp(18px, 2.4vw, 26px)`, `letter-spacing: -0.025em` — wrapped in `"` `"` using `::before`/`::after` with `color: #88877F`
Byline: `display: flex; gap: 16px; padding-top: 24px; border-top: .5px solid var(--border)`
Avatar: 40px circle, DM Mono initials
Name: Syne 600 14px | Role: DM Mono 11px muted

---

#### Section 11: CTA

**Background:** `#0C0C0B`
**Padding:** `112px 44px`
**Layout:** Centered text + buttons
**Background watermark:** "Reclaim" wordmark in Syne 800, `clamp(80px, 14vw, 180px)`, `rgba(244,243,238,0.03)`, `position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%)`

Content:
- Eyebrow: DM Mono 11px uppercase, "Ready to start?"
- Headline: Syne 800, `clamp(30px, 5vw, 60px)` — primary phrase white, secondary phrase `--mid`
- Buttons: `[Request a Demo →]` primary light + `[Talk to Sales]` ghost light

---

#### Section 12: Footer

**Background:** `#0C0C0B`
**Padding:** `64px 44px 40px`

**Background watermark:** `font-size: clamp(80px, 14vw, 160px)`, Syne 800, `rgba(244,243,238,0.04)` — purely decorative, `pointer-events: none`

**Top grid (3-col, 48px gap):**
- Col 1: Logo + tagline (DM Sans 300, 13px, max-width 240px)
- Col 2: "Platform" links list (5 items)
- Col 3: "Company" links list (5 items)

**Link style:** DM Sans 300, 14px, `rgba(244,243,238,0.5)`, hover `rgba(244,243,238,1)`

**Bottom bar:**
- Left: Copyright — DM Mono 10px, `rgba(244,243,238,0.25)`
- Right: Social/legal links — DM Mono 10px uppercase, `rgba(244,243,238,0.3)`

---

## 5. Motion & Animation System

### A. Loading Screen Counter

```javascript
function runLoader() {
  const pctEl = document.getElementById('loader-pct');
  const loader = document.getElementById('loader');
  let pct = 0;

  const iv = setInterval(() => {
    const remaining = 100 - pct;
    pct += Math.max(1, Math.floor(remaining * 0.09 + Math.random() * 3));
    pct = Math.min(100, pct);
    pctEl.textContent = pct;
    if (pct >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        loader.style.transition = 'opacity .6s ease';
        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
        document.getElementById('page').style.opacity = '1';
        revealHero();
      }, 300);
    }
  }, 55);
}
```

---

### B. Loader Marquee CSS

```css
.mq-track.fwd { animation: mqFwd var(--dur) linear infinite; }
.mq-track.rev { animation: mqRev var(--dur) linear infinite; }

@keyframes mqFwd { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes mqRev { from{transform:translateX(-50%)} to{transform:translateX(0)} }
```

Durations per row: `14s, 11s, 18s, 16s, 13s, 20s`
**Mandatory:** Each row's text content must be duplicated inside `.mq-track` so `translateX(-50%)` creates a seamless loop.

---

### C. Live Bid Ticker (Hero)

```css
.ticker-track { animation: mqFwd 22s linear infinite; }
```

Content pattern: `[LOT ID] [VEHICLE] [AMBER PRICE ↑]` — duplicate all items for seamless loop.

---

### D. Hero Split Lines Reveal

```javascript
function revealHero() {
  const ids = ['sl1', 'sl2', 'sl3'];
  ids.forEach((id, i) => {
    setTimeout(() => {
      document.getElementById(id)?.classList.add('show');
    }, 180 + i * 130); // 130ms stagger
  });
}
```

```css
.split-line {
  opacity: 0;
  transform: translateY(60px);
  transition: opacity .85s cubic-bezier(0.16,1,0.3,1),
              transform .85s cubic-bezier(0.16,1,0.3,1);
}
.split-line.show { opacity: 1; transform: translateY(0); }
```

---

### E. Scroll-Triggered Reveals (IntersectionObserver)

```javascript
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('show');
      io.unobserve(e.target); // one-time trigger
    }
  });
}, {
  threshold: 0.14,
  rootMargin: '0px 0px -32px 0px'
});

// Apply to all reveal targets
document.querySelectorAll(
  '.reveal, .about-stat-row, .svc-card, .lot-card, .process-cell'
).forEach(el => io.observe(el));
```

**Base reveal CSS:**
```css
.reveal-target {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity .7s cubic-bezier(0.16,1,0.3,1),
              transform .7s cubic-bezier(0.16,1,0.3,1);
}
.reveal-target.show { opacity: 1; transform: translateY(0); }
/* Stagger via nth-child */
.reveal-target:nth-child(2) { transition-delay: .10s; }
.reveal-target:nth-child(3) { transition-delay: .20s; }
.reveal-target:nth-child(4) { transition-delay: .30s; }
```

**About stat rows:** Slide from right instead of up: `translateX(24px) → translateX(0)`, same duration/easing.

---

### F. Counting Stats Animation

```javascript
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

function animCount(el, target, duration, decimals = 0) {
  let startTime = null;
  (function step(ts) {
    if (!startTime) startTime = ts;
    const p = Math.min((ts - startTime) / duration, 1);
    const v = easeOutExpo(p) * target;
    el.textContent = decimals ? v.toFixed(decimals) : Math.round(v);
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

// Trigger values
animCount(el_st1, 2.4,  1800, 1);  // "$2.4B"
animCount(el_st2, 12,   1800, 0);  // "12K+"
animCount(el_st3, 47,   1800, 0);  // "47"
animCount(el_st4, 48,   1800, 0);  // "48hr"
```

---

### G. Word Cycler

```javascript
const words = ['Losses', 'Claims', 'Write-offs'];
let idx = 0;
const el = document.getElementById('cycler-word');

setInterval(() => {
  idx = (idx + 1) % words.length;

  // Exit up
  el.style.transition = 'none';
  el.style.transform = 'translateY(100%)';
  el.style.opacity = '0';

  setTimeout(() => {
    el.textContent = words[idx];
    el.style.transition = 'transform .42s cubic-bezier(0.16,1,0.3,1), opacity .3s ease';
    el.style.transform = 'translateY(0)';
    el.style.opacity = '1';
  }, 80);
}, 2200);
```

```css
.cycler-slot {
  overflow: hidden;    /* clips exit/enter */
  height: 1.1em;
  position: relative;
  min-width: 260px;
}
.cycler-word {
  position: absolute;
  top: 0; left: 0;
  color: #D97706; /* amber */
}
```

---

### H. Custom Cursor

```javascript
const ring = document.getElementById('cur-ring');
const dot  = document.getElementById('cur-dot');
let mx=0, my=0, rx=0, ry=0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  dot.style.transform = `translate(${mx}px,${my}px)`;
});

// Lerp ring (factor 0.10 = slight lag)
(function lerp() {
  rx += (mx - rx) * 0.10;
  ry += (my - ry) * 0.10;
  ring.style.transform = `translate(${rx}px,${ry}px)`;
  requestAnimationFrame(lerp);
})();

// Ring expands on hover
document.querySelectorAll('a, button, .lot-card, .svc-card').forEach(el => {
  el.addEventListener('mouseenter', () => ring.classList.add('big'));
  el.addEventListener('mouseleave', () => ring.classList.remove('big'));
});
```

```css
body { cursor: none; }
#cur-ring {
  position: fixed; top: -20px; left: -20px;
  width: 38px; height: 38px;
  border: 1px solid rgba(244,243,238,0.45);
  border-radius: 50%; pointer-events: none; z-index: 10000;
  transition: width .28s ease, height .28s ease, top .28s ease, left .28s ease;
}
#cur-ring.big { width: 72px; height: 72px; top: -36px; left: -36px; }
/* On light sections */
#cur-ring.light-sec { border-color: rgba(12,12,11,0.35); }
#cur-dot {
  position: fixed; top: -3px; left: -3px;
  width: 5px; height: 5px;
  background: #F4F3EE; border-radius: 50%;
  pointer-events: none; z-index: 10001;
}
#cur-dot.light-sec { background: #0C0C0B; }
```

---

### I. LIVE Badge Pulse

```css
.live-badge::before {
  content: ''; width: 6px; height: 6px;
  background: #DC2F2F; border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(0.7); }
}
```

---

### J. Easing Reference

| Name | Value | Where |
|---|---|---|
| Expo Out | `cubic-bezier(0.16, 1, 0.3, 1)` | All scroll reveals, hero lines, cycler enter |
| Quad In-Out | `cubic-bezier(0.45, 0, 0.55, 1)` | Word cycler exit only |
| Ease | `ease` | Hover micros (buttons, scale), nav bg transition |
| Linear | `linear` | All marquee/ticker animations — must be linear |

---

## 6. Component Library

### Section Label

```html
<div class="sec-label">About Reclaim</div>
```
```css
.sec-label {
  font-family: 'DM Mono', monospace;
  font-size: 10px; letter-spacing: .11em; text-transform: uppercase;
  color: #88877F; margin-bottom: 52px;
  display: flex; align-items: center; gap: 12px;
}
.sec-label::before {
  content: ''; display: block;
  width: 28px; height: .5px; background: #88877F;
}
```

---

### Buttons

```css
/* ── Primary on dark sections ── */
.btn-primary-light {
  font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px;
  letter-spacing: -.01em; padding: 15px 32px; border-radius: 100px;
  background: #F4F3EE; color: #0C0C0B; border: none; cursor: none;
  transition: transform .2s ease;
}
.btn-primary-light:hover { transform: scale(1.03); }
.btn-primary-light::after { content: ' →'; font-size: 16px; }

/* ── Primary on light sections ── */
.btn-primary-dark {
  background: #0C0C0B; color: #F4F3EE;
  /* all other values same as above */
}

/* ── Ghost on dark ── */
.btn-ghost-light {
  background: transparent; color: #F4F3EE;
  border: .5px solid rgba(244,243,238,0.25);
  /* transitions to higher border opacity on hover */
}
.btn-ghost-light:hover { border-color: rgba(244,243,238,0.6); }

/* ── Ghost on light ── */
.btn-ghost-dark {
  background: transparent; color: #0C0C0B;
  border: .5px solid rgba(12,12,11,0.35);
}
.btn-ghost-dark:hover { background: #0C0C0B; color: #F4F3EE; }

/* ── Lot card bid button ── */
.btn-bid {
  font-family: 'Syne', sans-serif; font-weight: 600; font-size: 12px;
  padding: 11px 20px; border-radius: 100px;
  background: #0C0C0B; color: #F4F3EE; border: none;
  display: inline-flex; align-items: center; gap: 6px;
  transition: transform .2s ease;
}
.btn-bid::after { content: '→'; }
.btn-bid:hover { transform: scale(1.04); }

/* ── Nav CTA ── */
.nav-cta {
  font-family: 'Syne', sans-serif; font-weight: 600; font-size: 12px;
  padding: 9px 20px; border-radius: 100px;
  background: #F4F3EE; color: #0C0C0B; border: none;
  transition: transform .2s ease;
}
.nav-cta:hover { transform: scale(1.04); }
```

---

### Lot Card

Full structure:
```html
<div class="lot-card">
  <div class="lot-img"> <!-- height: 192px; overflow: hidden; NO aspect-ratio -->
    <div class="lot-badges">
      <span class="badge badge-live">Live</span>
      <span class="badge badge-condition">Flood Damage</span>
    </div>
    <!-- SVG vehicle illustration or <img> with object-fit: cover -->
  </div>
  <div class="lot-body"> <!-- padding: 24px; flex-direction: column; gap: 16px -->
    <div class="lot-meta">
      <span class="lot-num">Lot RCL-2847</span>
      <span class="lot-timer">⏱ 2h 14m left</span>
      <!-- urgent: class="lot-timer urgent" → color: #DC2F2F -->
    </div>
    <div>
      <div class="lot-name">2022 BMW 5 Series</div>
      <div class="lot-damage">530i xDrive — Flood / Total Loss</div>
    </div>
    <div class="lot-bid-row"> <!-- border-top: .5px solid var(--border) -->
      <div>
        <div class="lot-bid-label">Current Bid</div>
        <div class="lot-bid-amount">$8,400</div>
        <div class="lot-bid-count">14 bids placed</div>
      </div>
      <button class="btn-bid">Place Bid</button>
    </div>
  </div>
</div>
```

---

### Badge Variants

```css
.badge {
  font-family: 'DM Mono', monospace; font-size: 9px;
  letter-spacing: .08em; text-transform: uppercase;
  padding: 4px 9px; border-radius: 100px;
}
.badge-live     { background: #DC2F2F; color: #fff; }
.badge-ending   { background: #D97706; color: #fff; }
.badge-condition {
  background: rgba(12,12,11,0.08);
  color: #88877F;
  border: .5px solid rgba(12,12,11,0.11);
}
```

---

### Testimonial Card

```css
.testimonial-block {
  background: #ECEAE3; border: .5px solid var(--border);
  padding: 56px 52px; max-width: 860px; margin: 0 auto;
}
.testimonial-quote {
  font-family: 'Syne', sans-serif; font-weight: 700;
  font-size: clamp(18px, 2.4vw, 26px); letter-spacing: -.025em;
  line-height: 1.35; color: #0C0C0B; margin-bottom: 32px;
}
.testimonial-quote::before { content: '"'; color: #88877F; }
.testimonial-quote::after  { content: '"'; color: #88877F; }
```

---

## 7. Interaction Patterns

| Trigger | Target | Effect | Duration | Easing |
|---|---|---|---|---|
| Page load | Loader overlay | Marquees run + counter 0→100%, overlay fades out | ~3s total | `ease` for fade |
| After loader | Hero split lines | `translateY(60px)→0` + opacity reveal, 3 lines stagger 130ms | 850ms each | `expo-out` |
| Scroll 56px | Nav | `background: transparent → #0C0C0B` | 350ms | `ease` |
| Scroll enter | `.svc-card`, `.lot-card`, `.process-cell` | `translateY(28px)→0` + opacity 0→1, stagger 100ms | 700ms | `expo-out` |
| Scroll enter | `.about-stat-row` | `translateX(24px)→0` + opacity 0→1, stagger 80ms | 700ms | `expo-out` |
| Scroll enter | Stats grid | Counts animate: 0→target | 1800ms | easeOutExpo |
| `mousemove` | `#cur-ring` | Lerp toward mouse at 0.10 factor (trailing lag) | Continuous RAF | Linear lerp |
| Hover on `a, button, .lot-card` | `#cur-ring` | Expand 38px→72px | 280ms | `ease` |
| Hover `.lot-card` | Card | `scale(1.02)` on card; no explicit zoom | 250ms | `ease` |
| Hover `.btn-primary/inverted` | Button | `scale(1.03)` | 200ms | `ease` |
| Hover `.btn-ghost-dark` | Ghost button | `background: #0C0C0B; color: #F4F3EE` | 200ms | `ease` |
| Hover `.svc-link` | Arrow gap | `gap: 8px → 14px` | 200ms | `ease` |
| Auto interval 2.2s | Word cycler | Up-exit + down-enter, amber word | 300ms + 420ms | quad-out / expo-out |
| Hover `.insurer-logo` | Logo text | `rgba(0.18) → rgba(0.5)` | 200ms | `ease` |

---

## 8. Aspect Ratio & Sizing Rules

> This section documents what NOT to do as much as what to do.

### Rules

**Rule 1 — Never use `aspect-ratio` on fluid-width image containers.**
If a card is in a 3-column grid at full viewport width, `aspect-ratio: 4/5` produces ~300px height — reasonable. But on narrow viewports with 1-column grid, the same card is full-width and 4/5 becomes 500px+ — stretched and broken.

**Rule 2 — Use fixed pixel heights for image zones.**
```css
/* ✅ CORRECT */
.lot-img { height: 192px; overflow: hidden; }

/* ❌ WRONG */
.lot-img { aspect-ratio: 4/5; }
```

**Rule 3 — Use `object-fit: cover` on all `<img>` tags.**
```css
img { width: 100%; height: 100%; object-fit: cover; display: block; }
```

**Rule 4 — Fixed-dimension video/media slots in hero.**
```css
/* ✅ CORRECT */
.split-vid { width: 188px; height: 58px; flex-shrink: 0; }

/* ❌ WRONG */
.split-vid { width: 30%; aspect-ratio: 3/1; }
```

**Rule 5 — Stat cells use padding, not height.**
```css
.stat-cell { padding: 52px 40px; } /* content-driven height */
```

**Rule 6 — Service cards are content-driven.**
```css
.svc-card { padding: 40px 32px; } /* no fixed height, no aspect-ratio */
```

### Correct Sizing Summary

| Element | Sizing Method | Value |
|---|---|---|
| Lot card image area | Fixed height | `192px` |
| Hero video slots | Fixed width + height | `188px × 58px` |
| Service cards | Padding only | `40px 32px` |
| Stat cells | Padding only | `52px 40px` |
| Process cells | Padding only | `36px 28px` |
| Testimonial card | Max-width + padding | `max-width: 860px; padding: 56px 52px` |
| About stat rows | Padding only | `20px 24px` |
| SVG icons (services) | Fixed square | `52px × 52px` |
| Logo dot | Fixed | `7px × 7px` |
| Cursor ring (normal) | Fixed | `38px × 38px` |
| Cursor ring (hover) | Fixed | `72px × 72px` |

---

## 9. Tech Notes & Implementation Guide

### Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js / Nuxt.js | Either works; SSR preferred for SEO on auction listings |
| Animation | GSAP ScrollTrigger OR vanilla IntersectionObserver | IntersectionObserver sufficient for this scope |
| Fonts | Google Fonts | Syne + DM Mono + DM Sans |
| Icons | Custom SVG inline | No icon library — all icons are bespoke sketch-style SVGs |
| Real-time bids | WebSocket or SSE | Ticker and bid amounts should update live |
| Data | REST API / GraphQL | Auction lots, bids, insurer data |

---

### Adapting Brand Tokens

To deploy Reclaim for a different insurer or white-label it, change **only these tokens**:

```css
/* ── Swap these per brand ── */
--black:  #0C0C0B;   /* → brand dark color */
--white:  #F4F3EE;   /* → brand light/background */
--mid:    #88877F;   /* → brand muted text */
--amber:  #D97706;   /* → brand primary accent */
--red:    #DC2F2F;   /* → brand urgency/alert color */
--font-d: 'Syne';    /* → brand display font */

/* ── Keep these unchanged — they are system-level ── */
--border:    rgba(12,12,11,0.11);
--border-dk: rgba(255,255,255,0.09);
/* gap: 2px — always */
/* Syne 800, letter-spacing: -0.04em — always for display text */
/* DM Mono for all labels/metadata — always */
/* DM Sans 300 for body — always */
```

---

### File Structure (recommended)

```
/reclaim
  /components
    Loader.vue (or .jsx)
    Nav.vue
    HeroSplit.vue
    SvcCard.vue
    LotCard.vue
    StatBar.vue
    WordCycler.vue
    ProcessStep.vue
    CTA.vue
    Footer.vue
  /styles
    tokens.css        ← all :root CSS variables
    base.css          ← reset, body, cursor
    typography.css    ← all type scale rules
    animations.css    ← keyframes, reveal classes
    grid.css          ← page, wrap, grid-N
    components.css    ← all component styles
  /pages
    index.vue (or page.jsx)
  /public
    fonts/            ← optionally self-hosted
```

---

### Critical Design Decisions — Do Not Change

1. `gap: 2px` on `.page` — the paper-cut signature
2. Dark/light alternation — strictly follow the sequence in Section 1
3. `border-width: .5px` everywhere — hairline is intentional
4. Syne 800 at `-0.04em` letter-spacing — the brand's visual anchor
5. DM Sans weight 300 for body — using 400 makes it feel generic
6. Cursor ring lerp factor 0.10 — lower = more premium lag
7. Loader is a brand moment — don't skip or reduce it to < 2 seconds
8. Footer bg watermark at `opacity: 0.04` — barely visible is the point
9. Amber on "claim" in hero split — this is the only colored word on the page; it must stay
10. LIVE badge pulse is real-time signal — keep it visible and animated on auction pages

---

*End of Reclaim Design Specification. Version 1.0.*