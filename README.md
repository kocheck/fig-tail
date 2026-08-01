# fig-tail

Tailwind class names in Figma Dev Mode, resolved against your real Tailwind config.

Unlike generic CSS exporters, fig-tail does not invent arbitrary values like
`bg-[#3b82f6]` when your design system already has `bg-brand-500`. A designer
drops the team's `tailwind.config.js` (v3) or CSS entry (v4) once; developers
install the plugin and read real classes in Dev Mode.

## For developers

Under two minutes once the plugin is installed and a config is on the file.

1. Install fig-tail (from the [Figma Community](https://www.figma.com/community)
   when published, or [from source](docs/setup.md) for a team demo).
2. Open the file in **Dev Mode**.
3. Select a layer, then either:
   - **Code section** — choose **Tailwind CSS** in Figma's language dropdown, or
   - **Inspect panel** — open fig-tail from the Inspect plugin picker.
4. Copy the class string. Near-misses appear as notes — never as invented token names.

## For designers / setting it up

1. Run **fig-tail** in the design editor, or choose **Configure Tailwind…** from
   the codegen preferences menu in Dev Mode.
2. Drop `tailwind.config.js` / `.ts` (v3) or your CSS entry with `@theme` (v4).
3. Optionally drop `package.json` so an exact `tailwindcss` version (`x.y.z`) can
   confirm bundled defaults. Ranges and same-major guesses are rejected.
4. Click **Resolve**, review warnings, then **Save on file** (shared) or
   **Save personal** (per-user; no edit access required).

Raw source is processed locally and discarded. Only the resolved token set is stored.
There is no CLI step for normal setup.

## If you can't save to the file

| Tier | When | What you see |
|---|---|---|
| **Document** | Shared private plugin data on the file | Using the config saved on this file |
| **Personal** | Your `clientStorage` copy — ordinary option for view-only seats | Using your personal config — this file has no shared one |
| **None** | No config yet | Generic arbitrary suggestions + prompt to add a config |

## Confidence and raw values

fig-tail only emits a named class when the config confirms it:

| Outcome | Meaning |
|---|---|
| Exact (variable or value) | Class is safe to paste |
| Nearest | Close to a token — reported as a note, **not** emitted as that token |
| Unsupported / none | No match — arbitrary value or a clear gap |

If part of your config could not be read (function-valued theme keys, external
presets/plugins, dynamic expressions), fig-tail shows labelled raw values such as
`bg-[#3b82f6]` instead of guessing a token name. Wrong class names are worse than
honest arbitrary values.

## Drift linter and stamping

- **Lint drift** (read-only) — scans the selection or page for nearest,
  off-system, unbound, and related findings. Export a Markdown table from Tools
  for reviews.
- **Code-syntax stamping** — opt-in. Writes `WEB` code syntax on **local**
  variables only after an explicit confirm in the design editor. Never runs
  silently; undo via Figma. Dry-run works in Dev Mode; **Apply** is design-editor only.
- **Subtree export** — HTML / JSX / outline skeletons with classNames (codegen preference).

## Privacy

No network access (`allowedDomains: ["none"]`). Nothing leaves Figma. No
telemetry. Config source is resolved in-plugin and discarded after the token set
is saved.

## Limitations

- Does not generate components, assets, or responsive variants.
- Tailwind **v3** (JS/TS theme) and **v4** (`@theme` CSS) only.
- Does not evaluate function-valued theme keys, external presets/plugins, or
  dynamic expressions — those are reported, not guessed.
- Unreadable *replacing* `theme.colors` marks colours unknown; unreadable
  *extend* keeps confirmed defaults only when an exact Tailwind version was supplied.

Longer setup and resolver details: [docs/setup.md](docs/setup.md).  
Symptom-keyed fixes: [docs/troubleshooting.md](docs/troubleshooting.md).

## Packages

| Package | Role |
|---|---|
| `@fig-tail/theme` | In-browser Tailwind theme resolver |
| `@fig-tail/match` | CSS → class matching + confidence ladder |
| `@fig-tail/plugin` | Figma plugin (not published to npm) |

## Development

```bash
corepack enable
pnpm install
pnpm check   # typecheck + lint + build + test
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE) © 2026 Kyle Kochanek
