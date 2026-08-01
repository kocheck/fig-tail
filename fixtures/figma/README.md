# Figma platform fixture

Disposable nine-node fixture used by plans 000, 002, 004, 006, and 008.

## File

- **URL**: UNVERIFIED — create a disposable Figma file and paste the share URL here after import of `spikes/figma-platform`
- **Purpose**: stable layer names for CSS capture and later class expectations
- **Capture status**: CSS JSON under `css/design` and `css/dev` is seeded from
  documented `getCSSAsync()` shapes. Re-run the spike in Figma desktop and
  replace each file with verbatim sorted captures before Community publish.

## Nodes and expected classes (team-demo matrix)

Expectations assume a default-confirmed Tailwind 3.4.x theme with
`brand-500: #3b82f6` extended (same as plan 002 card fixture). Re-verify in
Figma after loading the team config. Latency: UNVERIFIED (target warm &lt;200 ms
codegen / &lt;250 ms Inspect; cold &lt;1 s).

| Stable name | Expected primary class string (approx) | Notes |
|---|---|---|
| `Card / exact` | `flex flex-col items-start self-stretch gap-4 p-6 rounded-xl border border-gray-200 border-solid bg-white shadow-xs` | Exact fixture string from `@fig-tail/match` card test |
| `Text / exact` | `font-medium text-sm text-gray-900` (or nearest exact tokens) | Inter Medium 14/20 → font-size/weight |
| `Size / fixed` | `w-80 h-11` (if 320×44 on default scale) | May be arbitrary if scale missing |
| `Colour / near` | *(empty primary)* + drift nearest `brand-500` | Near `#3B82F1` — never emit as exact |
| `Spacing / near` | *(empty for padding)* + drift nearest `p-6` | 25 px near 24 |
| `Variable / bound` | Prefer `exact-variable` when WEB syntax + value agree | Else value / name-match |
| `Gradient / unsupported` | `none` / no fill class | Unsupported — report, don't invent |
| `Layout / nested` | Parent layout utilities only for selected node | Hidden children skipped in subtree |
| `Text / mixed` | Partial typography; mixed ranges may be `none` | Document mixed limitation |

## Capture protocol

1. Import `spikes/figma-platform/manifest.json` in Figma desktop.
2. Select each node in design mode → Capture selection CSS → save to `css/design/<slug>.json`.
3. Repeat in Dev Mode → `css/dev/<slug>.json`.
4. Keys must be sorted alphabetically; values verbatim from `getCSSAsync()`.

## Team-demo exit checklist

- [ ] Config saved on demo file (tier document)
- [ ] Codegen shows card expected string
- [ ] Inspect copy matches codegen byte-for-byte for same node
- [ ] Near colour/spacing show drift, not wrong tokens
- [ ] Cold install on a second machine works
