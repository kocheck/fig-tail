# Figma platform fixture

Disposable nine-node fixture used by plans 000, 002, 004, 006, and 008.

## File

- **URL**: UNVERIFIED — create a disposable Figma file and paste the share URL here after import of `spikes/figma-platform`
- **Purpose**: stable layer names for CSS capture and later class expectations
- **Capture status**: CSS JSON under `css/design` and `css/dev` is seeded from
  documented `getCSSAsync()` shapes (plan docs + Figma plugin API) so plan 002
  can build without inventing fixtures. Re-run the spike in Figma desktop and
  replace each file with verbatim sorted captures before treating them as
  production evidence.

## Nodes

| Stable name | Construction |
|---|---|
| `Card / exact` | Auto-layout frame, padding 24, gap 16, radius 12, fill `#FFFFFF`, border `1px #E5E7EB`, shadow `0 1px 2px rgba(16,24,40,0.05)` |
| `Text / exact` | Text Inter Medium 14 / 20, fill `#111827` |
| `Size / fixed` | Rectangle 320×44 |
| `Colour / near` | Solid fill `#3B82F1` (near `#3B82F6`) |
| `Spacing / near` | Padding 25 px (near token 24) |
| `Variable / bound` | Fill + spacing bound to local variables |
| `Gradient / unsupported` | Linear gradient background |
| `Layout / nested` | Nested auto-layout, group, one hidden child |
| `Text / mixed` | Text with mixed weight/size ranges |

## Capture protocol

1. Import `spikes/figma-platform/manifest.json` in Figma desktop.
2. Select each node in design mode → Capture selection CSS → save to `css/design/<slug>.json`.
3. Repeat in Dev Mode → `css/dev/<slug>.json`.
4. Keys must be sorted alphabetically; values verbatim from `getCSSAsync()`.
