# Figma Community listing (draft)

**Name:** fig-tail

**Tagline:** Real Tailwind class names in Dev Mode — from your team's config.

**Description:**

fig-tail resolves your project's Tailwind config inside Figma and shows the
classes developers should paste — `bg-brand-500`, `p-6`, `rounded-lg` — not
arbitrary values that bypass the design system.

Install once. A designer drops `tailwind.config.js` (v3) or `app.css` (v4).
Anyone opening the file in Dev Mode sees matching classes in the Code section
and Inspect panel. Near misses are reported, never silently invented.

Also includes a read-only drift linter, opt-in variable code-syntax stamping,
and subtree className export.

**Privacy:** no network access (`allowedDomains: none`). Nothing leaves Figma.
No telemetry. Config source is resolved locally and discarded after the token
set is saved.

**Support URL:** https://github.com/kocheck/fig-tail/issues

**Category:** Development

**Declared capabilities:** codegen, inspect

**Manifest network:** none

**Assets:** see [`assets/`](assets/) — icon, cover, and product screenshots
(all pending real captures; no placeholder art).

**Do not publish** until `docs/release/feature-audit.md` records cross-account
private storage **PASS** and the owner explicitly approves Community.
