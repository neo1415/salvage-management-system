# White-Label Homepage Template Specs

These are the editable public-facing templates for the salvage platform. They are scoped to the homepage, splash/loading treatment, login, registration, and public error surfaces. Dashboard/product UI remains operational and unchanged.

## 1. Salvage Bridge Editorial

Default product identity. Based on `salvage-bridge-design-specs.md`.

- Mood: industrial editorial, premium recovery, precise insurance compliance.
- Themes: night default, day supported.
- Motion: splash marquee, live bid ticker, split hero reveal, subtle stat/process reveals.
- Best for: the base product brand and high-polish sales demos.
- Editable policy fields: brand name, legal name, logo, favicon, colors, hero copy, trust line, three stats, CTA labels, auth headline/subtitle, splash toggle.

## 2. NEM Salvage Classic

Preserves the current NEM animated salvage homepage as a selectable white-label template.

- Mood: familiar, animated, vendor-facing, conversion-oriented.
- Themes: night/default gradient, day via brand color changes.
- Motion: existing hero carousel and below-fold animation system.
- Best for: retaining current NEM behavior while Salvage Bridge becomes the product default.
- Editable policy fields: existing hero copy, brand colors, logo, favicon, CTA labels.

## 3. Recovery Command

Command-center design for operations-heavy insurance teams.

- Mood: enterprise dashboard, claims command room, operational confidence.
- Themes: day default with night support.
- Motion: live recovery board, stat cards, restrained transitions.
- Best for: insurers that want the product to feel like an internal recovery operations center.
- Editable policy fields: hero copy, trust line, three KPI cards, brand colors, auth copy.

## 4. Claims Orbit

Carousel-led recovery journey. The claim, review, auction, and settlement states orbit around the main value proposition.

- Mood: connected network, modern B2B SaaS, guided workflow.
- Themes: night default with day support.
- Motion: orbit cards, timed carousel, process reveals.
- Best for: clients who want a more expressive sales homepage without losing enterprise seriousness.
- Editable policy fields: hero copy, trust line, KPI copy, auth copy, colors.

## 5. Executive Terminal

Private, minimal, login-forward design for white-label deployments that do not want a large marketing homepage.

- Mood: quiet, secure, executive, low-noise.
- Themes: day default with night support.
- Motion: minimal; no splash by default if the client chooses login-first mode.
- Best for: enterprise customers who want staff and vendors to get into the platform quickly.
- Editable policy fields: hero/auth copy, CTA labels, brand colors, support contact.

## Implementation Standards

- Template selection must not expose private provider configuration.
- Public policy can contain branding, display copy, enabled public modules, and public feature labels only.
- Auth pages inherit the selected template tone, but only login/register are restyled. The dashboard is not redesigned by homepage templates.
- Public error, privacy, cookie, terms, and NDPR pages should use the configured brand name, logo, colors, and support email.
- Splash screens are public landing-page decoration. Login-first deployments skip them.
- Existing saved policies using legacy IDs are mapped internally:
  - `salvage_showcase` -> `nem_salvage`
  - `auction_marketplace` -> `recovery_command`
  - `minimal_private` -> `executive_terminal`

## Future Enterprise Setup Wizard

The branding and template controls should eventually move into a guided enterprise setup flow, similar to WordPress-style onboarding:

1. Brand identity: name, legal name, logo, favicon, colors, support contacts.
2. Homepage/auth template: select one of the five templates, choose day/night/auto mode, edit homepage copy and stats.
3. Legal/compliance copy: configure cookie, privacy, terms, NDPR, document templates, and footer contacts.
4. Onboarding policy: choose vendor KYC/registration/payment order and enabled asset types.
5. Review and publish: validate public-safe config, private config, policy versions, and publish with audit logging.

## Design Research Notes

2026 SaaS/B2B landing-page patterns favor clear product narratives, dark/light theme support, restrained motion, in-page product demonstrations, and interactive but purposeful animation. The templates intentionally avoid generic neon SaaS tropes and keep the product workflow visible.
