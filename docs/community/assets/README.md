# Community listing assets

All visuals still need real captures — no placeholder art in this folder.

| File | Role | Size | Who |
|---|---|---|---|
| `icon.png` | Plugin icon | 128×128 | **you create** (match product UI) |
| `cover.png` | Listing thumbnail | 1920×1080 | **you create** |
| `devmode-codegen.png` | README + carousel: Code section with real classes | 1920×1080 preferred | **you capture** |
| `inspect.png` | Carousel: Inspect panel parity | 1920×1080 preferred | **you capture** |
| `setup.png` | Carousel: config drop / resolve UI | 1920×1080 preferred | **you capture** |

## Capture checklist (Figma desktop)

1. Import the local plugin from `packages/plugin/manifest.json`.
2. Save a real project config on a demo file (document tier).
3. Dev Mode → Code → **Tailwind CSS** → select a token-backed layer → screenshot → `devmode-codegen.png`.
4. Inspect panel → fig-tail → same layer → `inspect.png`.
5. Design mode → fig-tail setup with resolve UI → `setup.png`.
6. Design icon + cover that match the plugin UI (do not invent unrelated brand art).

After `devmode-codegen.png` lands, embed it at the top of the root README.
