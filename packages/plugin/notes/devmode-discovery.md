# Dev Mode discovery — plan 005

Answers gathered from the plugin's code paths (`manifest.json`, `src/mode-dev.ts`)
and Figma's published platform docs, dated 2026-07-31. No Figma desktop session
was available in this environment, so anything not derivable from code or docs
is marked **UNVERIFIED** rather than guessed — see plan 005 Step 1 for the
in-product test this note should be re-run against.

## 1. How does a first-time developer discover codegen?

They open a file in Dev Mode, select a node, open the **Code** section, and
choose **"Tailwind CSS"** from Figma's native language dropdown at the top
right of that section — the same dropdown used for Figma's own CSS/iOS/Android
output. Reaching it requires the plugin to already be added to the file (via
"Plugins → fig-tail" or an org pin, see Q4); the dropdown entry itself comes
from this manifest's `codegenLanguages` declaration, not from anything the
plugin renders. — [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins)
· [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode)

**In-product UNVERIFIED**: the exact wording/position Figma renders for a
third-party codegen language in the dropdown.

## 2. How do they discover Inspect?

`manifest.capabilities` declares `"inspect"` alongside `"codegen"`, so fig-tail
also appears as a full-height panel option in Dev Mode's **Inspect** panel,
independent of the Code section's language dropdown — a developer finds it by
opening the Inspect panel's plugin picker (or via the org pin described in
Q4) rather than by any in-canvas hint from this plugin. `src/mode-dev.ts` calls
`figma.showUI(__html__, { width: 320, height: 480, title: 'fig-tail' })` for
this route, distinct from the invisible UI codegen uses. —
[Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode)

**In-product UNVERIFIED**: whether the Inspect panel entry point is obvious to
someone who has never opened it before, versus requiring them to already know
plugins can appear there.

## 3. Does language selection persist?

**No public documentation states this either way**, and no second Figma
account was available in this environment to test it directly (plan 005 Step 1's
documented fallback). Figma does document that a plugin can be **saved** to a
user's account (the ribbon icon) for access across files —
[Use plugins in files](https://help.figma.com/hc/en-us/articles/360042532714-Use-plugins-in-files)
— but that governs whether the *plugin* is available, not whether "Tailwind CSS"
stays selected in the Code section's language dropdown across files or restarts.

**In-product UNVERIFIED.** Treat persistence as unproven; this is exactly why
plan 005 ships the Inspect panel as a second, dropdown-independent surface —
see Q2.

## 4. Can org pin?

Yes. **Organization/Enterprise admins** can pin a Dev Mode plugin so it appears
automatically in the Inspect panel for every developer in the org, and can set
a default code language — both are Organization-tier features, confirmed in
Figma's own admin documentation. The repo owner's account is not on an
Organization plan, so this could not be exercised directly here, but it is not
gated behind anything this plugin controls. —
[Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization)

## 5. What must a first-time developer do?

**Install fig-tail from Community, open a file that already has a Tailwind
config saved (or save one via "Configure Tailwind config…"), then either pick
"Tailwind CSS" from the Code section's language dropdown or open fig-tail in
the Inspect panel — both surfaces read the same config and produce identical
class output.**

---

Both surfaces share `src/pipeline.ts` (`runPipeline`, `createResolutionContext`,
`resolveNodes`) so class output cannot drift between them — see
`pipeline.consistency.test.ts` and `single-pipeline.test.ts` for the tests that
enforce it.
