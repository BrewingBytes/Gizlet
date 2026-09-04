# Gizlet Design System

Version: 1.1  
Brand owner: BrewingBytes  
Product: Gizlet  
Tagline: **A little tool for everything.**

---

## 1. Brand idea

Gizlet is a collection of small, useful internet tools.

The brand should feel like a useful independent website made by people who care about details — not a generic SaaS dashboard and not an AI-generated startup template.

The visual personality is:

- practical
- human
- fast
- slightly playful
- trustworthy
- tool-like
- editorial rather than corporate
- simple without feeling sterile

A Gizlet should feel like something you bookmark because it solves an annoying problem properly.

### Core promise

**Useful internet things, without the nonsense.**

Supporting language:

- No signup.
- No upload queue when local processing is possible.
- No Gizlet held back behind a tier.
- Ads pay for it.
- Most tools should work in the browser.

---

## 2. Logo

### Primary logo

Use `gizlet-logo.svg`.

The primary mark combines:

1. the amber Gizlet icon
2. the lowercase `gizlet` wordmark

The wordmark is intentionally lowercase. It makes the brand feel friendlier and less corporate.

### Icon

Use `gizlet-icon.svg`.

The icon consists of:

- amber rounded square
- dark navy/ink `G`
- three small activation rays

The rays suggest a small tool switching on, an idea, or something being fixed.

### Favicon

Preferred:

- `favicon.svg`
- fallback: `favicon.ico`

Additional exports:

- `gizlet-16.png`
- `gizlet-32.png`
- `gizlet-48.png`
- `gizlet-64.png`
- `gizlet-180.png`
- `gizlet-192.png`
- `gizlet-512.png`

### Clear space

Keep at least **0.5× the icon width** of clear space around the primary logo.

Do not:

- add gradients to the logo
- put the mark in a pill
- add drop shadows to the logo
- stretch the icon
- recolor the amber unless creating a documented campaign variation

---

## 3. Color system

### Core colors

| Token | Hex | Role |
|---|---|---|
| Gizlet Amber | `#F6A500` | Primary brand accent |
| Ink | `#0F172A` | Main dark color |
| Paper | `#F3EFE6` | Warm background |
| Surface | `#FFFDFC` | Tool surfaces |
| Slate | `#6F685E` | Secondary text |
| Soft | `#E7DFD2` | Dividers and low-emphasis areas |

### Functional colors

| Token | Hex | Role |
|---|---|---|
| Blue | `#315FA8` | Links / informational |
| Green | `#257A4E` | Success / local processing |
| Red | `#C8443A` | Error |
| Warning | `#A35F00` | Warning |

### Accent rule

Amber is the **brand color**, not decoration.

Use it for:

- icon
- primary highlight
- occasional important action
- thin accents
- stamps / badges

Do not flood the page with amber.

---

## 4. Typography

Gizlet deliberately mixes editorial and utility typography.

### Display / headings

Preferred style:

- Georgia
- Times New Roman fallback

Characteristics:

- large
- low line-height
- slightly tight tracking
- sentence case

This prevents the product from looking like a generic modern SaaS template.

### UI / body

Preferred:

- Arial
- Helvetica
- system sans-serif fallback

### Utility / metadata

Preferred:

- ui-monospace
- SFMono-Regular
- Menlo
- Consolas

Use monospace for:

- tool numbers
- labels
- file metadata
- badges
- keyboard shortcuts
- technical properties

---

## 5. Voice

Gizlet should sound like a useful person, not enterprise software.

### Good

- `Compress it`
- `Drop a file here`
- `Put PDFs together. That's it.`
- `Nothing to upload.`
- `82% smaller. Nice.`
- `Try another one`
- `A small tool that does one annoying thing properly.`

### Avoid

- `Unlock the power of...`
- `Supercharge your workflow`
- `Revolutionary`
- `AI-powered` unless AI is actually the core feature
- `Seamless`
- `Elevate`
- `Next-generation`
- `Operation completed successfully`

Humor should be subtle and occasional.

### Where humor is not allowed

None at all in:

- a kill-criterion line
- the won't-build table

Wit within a sentence of “we would stop building this” reads as a pre-emptive apology for the decision. These are the lines a reader tests the product's honesty against, so they are written flat: what would make us stop, and what we are not going to build.

---

## 6. Layout

### Desktop container

Maximum width: approximately `1180px`.

### Core spacing

Prefer a restrained 8px-ish rhythm:

- 8
- 12
- 16
- 24
- 32
- 48
- 72

### Geometry

Use:

- straight edges
- thin rules
- occasional dashed upload borders
- restrained rounded corners only where functionally useful

Avoid:

- excessive 20–30px radius cards
- floating glass panels
- pill-heavy navigation
- gradient blobs
- soft purple shadows
- oversized icon cards

### Document pages

`/roadmap`, `/about` and `/privacy` are a fourth layout type, alongside the homepage, a tool page and the Gizlet index. A page whose job is to be read rather than used gets:

- a `38rem` measure
- Georgia headings
- mono uppercase labels in a left column, prose in the column beside them
- 2px rules for section breaks
- no cards
- no sidebar
- no rail

It should read as a document, not as a dashboard with paragraphs in it.

Today `/about`, `/privacy` and `/terms` render through `LegalPageLayout.astro` at a `48rem` measure with 1px rules. That is a deviation from this pattern rather than an exemption from it: those pages move to the document pattern when they are next touched.

---

## 7. Homepage

The homepage should prioritize finding a tool.

Order:

1. navigation
2. brand statement
3. search
4. top ad slot
5. popular Gizlets
6. categories
7. footer

### Homepage search

Primary prompt:

`I need to…`

Example placeholder:

`compress a photo, merge a PDF, make JSON-LD…`

Search should understand intent, not just exact tool names.

---

## 8. Tool pages

Every Gizlet should follow the same basic structure:

1. breadcrumb
2. tool title
3. one-line description
4. local-processing status
5. workspace
6. ad inventory
7. result
8. related Gizlets

The tool must be usable before any marketing copy.

### Tool rule

**One primary job per page.**

Advanced settings should be hidden or de-emphasized until needed.

---

## 9. Status badges

Locality and availability are two different questions, and a badge answers exactly one of them. Whether a Gizlet runs on the device says nothing about whether it exists yet, and a Gizlet that does not exist yet has no locality to report. Do not give the two axes the same shape.

### Local processing

When a tool runs fully on-device:

`● LOCAL PROCESSING`
`Your file stays on this device.`

Use green as the status color, and keep the leading dot.

Do not claim local processing if the tool sends data to the server.

### Availability

A Gizlet that is not published says so in its own form: mono, uppercase, no dot, never green.

- `PLANNED` — a Gizlet the roadmap commits to
- `WON'T BUILD` — a Gizlet deliberately declined

Set both in slate, the same muted color as the rest of the mono metadata. Amber is the brand color and green means local, so neither is available here. Warning is reserved for kill-criterion lines, which are a claim about the product rather than a status on a row.

A planned Gizlet carries no local-processing badge. There is no processing to describe yet, and the green badge is a promise about a file the visitor cannot hand over.

---

## 10. Ads

Ads are how Gizlet pays for itself, and they must be designed into the layout from day one.

There is one Gizlet: every tool, the same processing quality, the same limits, no account, ads visible. There is no paid tier. If an ad-free tier is ever built it earns its own design work and its own place in this document, and until then nothing in the product may describe one.

### Reserved desktop placements

Homepage:

- top content banner: `970×90` responsive

Tool page:

- right rail: `300×250` or `300×600`
- post-tool/result banner: `728×90` responsive

SEO / long-form tools:

- top banner
- right rail

### Pages that carry no ads

Some pages exist to be believed rather than to earn:

- `/privacy`
- `/roadmap`
- a planned Gizlet's placeholder page

None of them carries an ad, in any placement. A page whose content is “here is how we would know to quit” loses its argument the moment an ad rail sits beside it, and it is the page most likely to be screenshotted and quoted. Commercial intent on these routes is near zero and their credibility value is disproportionate, so the trade is not close.

Stated honestly, this is an addition rather than a correction. The placements above reserve inventory for the homepage, tool pages, and SEO long-form tools, and have never said anything about these routes. `/privacy`, `/about` and `/terms` already carry no ad; this makes that a rule instead of an accident, and settles `/roadmap` and placeholder pages before either ships.

### Ad UX rules

Never place an ad:

- inside a file drop area
- between input and primary action
- disguised as a download button
- directly adjacent to the primary Download CTA
- between form fields
- where accidental clicks are likely

Ads must visually say `Advertisement`.

Mobile ad positions must collapse into normal content flow.

---

## 11. Components

### Buttons

Primary button:

- dark ink background
- paper text
- square or very slightly rounded
- 2px border

Hover may use a tiny physical offset / hard shadow.

Avoid glowing CTA buttons.

### Inputs

Inputs should look like tools:

- simple
- strong baseline
- no giant floating container
- clear focus state

### Tool index row

Popular Gizlets should often be shown as rows, not generic cards.

Pattern:

`001   Compress Image   Shrink photos without turning them into soup.   LOCAL   IMAGE`

This creates a recognizable Gizlet identity.

The leading number is the Gizlet's registry id, zero-padded to three digits. It is a shipped-Gizlet credential, so the rendering **withholds** it from a planned entry and prints an em dash in its place. Every entry has an id — the registry requires the field and a test asserts the ids are unique — so this is a rule about what a row shows, not about what the data holds.

The Gizlet index at `/tools/` prints no number today. The pattern says “often”, so that stays within the rule, but a row that does print a number prints it this way.

### Category navigation

Categories:

- Images
- PDF
- SEO
- Developer
- Text
- Generators
- Video
- Audio
- Security
- Calculators

---

## 12. SEO / JSON-LD tool style

The JSON-LD Generator is a flagship tool.

It should use:

1. schema type selection
2. friendly form
3. live JSON preview
4. validation
5. copy JSON-LD
6. copy `<script>`
7. Google-oriented recommendations where applicable

The interface should clearly distinguish:

- valid Schema.org markup
- Google rich-result eligibility

Do not imply that structured data guarantees ranking improvements.

---

## 13. Dark mode

Dark mode should preserve the human/editorial feel.

Do not turn dark mode into a neon developer dashboard.

Preferred:

- dark warm background
- off-white text
- same amber accent
- muted warm borders

---

## 14. Mobile

Mobile is first-class.

Rules:

- one-column workspace
- minimum 44px touch targets
- tool action visible without horizontal scrolling
- right-rail ads collapse into inline ads
- avoid tiny desktop controls
- retain search access
- keep page title concise

---

## 15. Accessibility

Minimum expectations:

- semantic headings
- keyboard usable tools
- visible focus states
- sufficient text contrast
- labels for all inputs
- no color-only status communication
- alt text where images convey information
- reduced-motion friendly interactions

---

## 16. Motion

Motion should be scarce and useful.

Acceptable:

- subtle tool-row hover
- small button press
- result reveal
- progress movement

Avoid:

- floating background objects
- animated gradients
- constant pulsing
- excessive spring animations

---

## 17. Asset list

Brand files:

- `gizlet-logo.svg`
- `gizlet-icon.svg`
- `favicon.svg`
- `favicon.ico`
- `gizlet-16.png`
- `gizlet-32.png`
- `gizlet-48.png`
- `gizlet-64.png`
- `gizlet-180.png`
- `gizlet-192.png`
- `gizlet-512.png`
- `brand-board.png`

Social preview cards, 1200x630, drawn by `scripts/generate-social-images.mjs` from the tool registry:

- `social/<gizlet-slug>.png` — one per available Gizlet
- `social/gizlets.png` — the Gizlet index

A page without a card of its own previews with `brand-board.png`.

Mockups:

- `index.html`
- `compress-image.html`
- `json-ld.html`
- `styles.css`
- `app.js`

---

## 18. Brand test

Before approving a new Gizlet page, ask:

1. Can someone start the job in under five seconds?
2. Does this look like Gizlet, or could it be any SaaS template?
3. Is the most important action obvious?
4. Are we wasting space on marketing instead of the tool?
5. Is local processing described accurately?
6. Are ads visible but non-obstructive?
7. Does the copy sound like a person?
8. Does it work well on mobile?
9. Does it remain useful without an account?
10. Would someone bookmark this page?

If the answer to #2 is “this could be any AI startup,” redesign it.
