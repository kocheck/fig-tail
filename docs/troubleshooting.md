# Troubleshooting

## "No Tailwind config yet" in Dev Mode

No document or personal config is loaded (tier **none**). Run **Configure Tailwind…**
(or fig-tail in the design editor), drop a config, Resolve, then Save on file or
Save personal. Until then you get generic arbitrary suggestions only.

## The resolver reported unresolved entries

Each warning includes a `reason`. Typical fixes:

| Reason family | What to do |
|---|---|
| External preset / plugin / local module | Inline the tokens you need, or accept those namespaces as unknown |
| Function-valued theme key | Replace with a static object for tokens you care about |
| Dynamic / conditional / computed key | Use a static shape the resolver can walk |
| Missing `@import` / `@config` file (v4) | Drop the referenced CSS or JS file in setup |
| Version not exact | Supply `package.json` with `tailwindcss` at exact `x.y.z` |

Unresolved parts are never invented as class names — you get labelled raw values.

## Validation errors on drop

- **v3:** use `tailwind.config.js` / `.ts` (or `.cjs` / `.mjs`), not a random CSS file.
- **v4:** drop the CSS entry that contains `@theme`. If it `@config`s a JS file, drop that too.
- Wrong file → re-drop the correct one; raw source is not kept after a failed resolve.

## Classes look wrong / arbitrary values everywhere

Usually a missing, stale, or wrong config — or colours marked unknown because a
*replacing* `theme.colors` could not be read. Re-run setup with the project
config that defines your tokens. Bundled defaults are withheld without exact
version evidence, even within the same major.

## Near colours/spacing never become classes

By design. Near matches are reported in drift notes only — inventing
`bg-brand-500` when the fill is slightly off would silently fail in code.

## The plugin does not appear in Dev Mode's language dropdown

Import/install the plugin first (desktop → Development manifest, or Community).
The **Tailwind CSS** entry comes from the plugin's `codegenLanguages` manifest
field. Confirm you are in **Dev Mode** and looking at the Code section language
dropdown (not a design-mode plugin menu).

## The plugin does not appear in the Inspect panel

fig-tail registers an `inspect` capability separately from codegen. Open Dev Mode
→ Inspect → plugin picker and choose fig-tail. If it is missing, re-import the
manifest or reinstall from Community.

## A second developer cannot see the config

Document save must succeed on an account with edit access. Collaborators need the
**same plugin ID** (Community or shared development mapping). If private document
plugin data does not cross accounts for your plan, use **Save personal** as the
labelled fallback. Community publish requires a documented PASS — see
`docs/release/feature-audit.md`.

## Everything is reported as drift

Usually a mismatched or stale config versus the file's fills/spacing. Re-resolve
and save the correct config, then re-run **Lint drift**.

## Stamping does nothing in Dev Mode

Apply is design-editor only. Run dry-run in either mode; Apply from design.
Confirm the dialog; only local variables are written.

## Bundle / install fails

Require Node 20+, `corepack enable`, and `pnpm@10.33.2` from `packageManager`.
