# Platform preflight evidence — plan 000

**Date**: 2026-07-31  
**Executor**: autonomous agent (no Figma desktop session available)  
**Spike manifests**: `spikes/figma-platform`, `spikes/figma-platform-isolation`

## Environment

| Item | Value |
|---|---|
| Figma desktop version | UNVERIFIED — requires local Figma desktop |
| Plugin API | `1.0.0` (manifest `api` field) |
| Account / seat | UNVERIFIED |
| Docs consulted | [Plugin manifest](https://developers.figma.com/docs/plugins/manifest), [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins), [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode), [setPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/), [Variable.setVariableCodeSyntax](https://developers.figma.com/docs/plugins/api/properties/Variable-setvariablecodesyntax/), [getCSSAsync / Update 68](https://developers.figma.com/docs/plugins/updates/2023/06/21/version-1-update-68) |

## Route contract

Manifest declares `editorType: ["figma","dev"]` and `capabilities: ["codegen","inspect"]`.

| Route | `(editorType, mode)` | Evidence |
|---|---|---|
| Design editor | `('figma', …)` | Spike shows UI on design run — **PASS (code path)**; in-product import UNVERIFIED |
| Codegen | `('dev', 'codegen')` | `figma.codegen.on('generate')` registered; no `showUI` inside generate — **PASS (code path)**; in-product UNVERIFIED |
| Inspect | `('dev', 'inspect')` | Inspect branch calls `showUI` — **PASS (code path)**; in-product UNVERIFIED |

## CSS fixture contract

Eighteen JSON captures exist under `fixtures/figma/css/{design,dev}/` for the nine
stable node names. Seeded from documented `getCSSAsync()` shapes so plan 002 has
real-shaped inputs. **Replace with verbatim Figma captures before publication.**

| Node | Design vs Dev parity (seeded) |
|---|---|
| All nine | Identical seeded pairs — treat as provisional PASS until live capture |

**Downstream**: plan 006 may run in Dev Mode Inspect; plan 008 documents nested
differences if live capture shows them. Do not reconstruct CSS from raw node fields.

## Storage contract

Spike writes two chunks + meta-last via `figma.root.setPluginData`. Isolation
reader uses a second plugin ID and expects empty reads.

| Check | Result |
|---|---|
| Same-user reload | UNVERIFIED |
| Same-user restart | UNVERIFIED |
| Cross-account / Dev-seat read | UNVERIFIED — plan 010 publication gate |
| Cross-plugin isolation | PASS (by documented private-plugin-data semantics); in-product UNVERIFIED |

**Fallback**: plan 003 personal `clientStorage` tier remains available.

## Write-route contract

| Context | `setVariableCodeSyntax('WEB')` | Result |
|---|---|---|
| Design editor + edit access | Expected allowed | UNVERIFIED in-product; code path exists |
| Dev Mode | Expected denied or unsafe | UNVERIFIED — plan 007 Apply stays design-only |
| No edit access | Expected denied | UNVERIFIED |

## Decision table

| Contract | Status | Downstream owner |
|---|---|---|
| A. Route matrix | PASS WITH FALLBACK (code paths ready; in-product UNVERIFIED) | 003 tasks 2–3 |
| B. CSS fixtures | PASS WITH FALLBACK (seeded shapes; replace with live captures) | 002 task 1, 006, 008 |
| C. Private storage | UNVERIFIED cross-account | 003 task 5/8, 010 publish gate |
| D. Write route | PASS WITH FALLBACK (design-only Apply assumed) | 007 |

## Binding decisions

1. Production plugin uses dual `codegen` + `inspect` capabilities.
2. Plan 002 consumes `fixtures/figma/css/**` as-is; hash equality checks apply to those files.
3. Plan 007 Apply only when `figma.editorType === 'figma'` with edit access.
4. Plan 010 must re-run cross-account read on the release build before Community submission.
