# Art bible — the Kenney family (decision #60)

One rule: **every visible asset comes from this family or is procedurally drawn to match it.** No new ecosystems. This file is the pre-build checklist the research report (docs/research/2026-07-10-asset-planning-deep-dive.md) says we were missing: the pack family IS the art bible.

## The family (all CC0, all public-repo-safe)

| Layer | Source pack | What we use | Where it lives |
|---|---|---|---|
| GUI (buttons, panels, bars, sliders, icons) | **Kenney UI Pack v2** (430 elements) | Blue theme primary (royal-blue palette match), Yellow for gold/CTA accents, Grey for disabled | public/assets/packs/kenney2/ui/ |
| Match-3 pieces | **Kenney Shape Characters** | 6 colors (blue/green/pink/purple/red/yellow; pink serves the core's 'orange' slot) x 4 body shapes + faces, composited per piece so each color has a distinct shape+face identity | packs/kenney2/shape/ |
| Sibling avatars | **Kenney Toon Characters** | Female person = Luana (influencer), Male person = brother (mayor/manager); Poses PNGs + Parts for outfit variants | packs/kenney2/toon/ |
| Particles/fx | Kenney Particle Pack (already in repo) + Starter-Kit-Match-3 sparkle | keep current keys | packs/fx/ (existing) |
| SFX | Kenney CC0 oggs (run 3) + Starter-Kit-Match-3 tile sounds | keep current keys | assets/audio/ (existing) |
| Fonts | Fredoka + Lilita One (OFL) | unchanged | fonts/ (existing) |

## Style rules

- Palette stays the royal-blue system from decision #57 (bgDeep 0x0e1e3d etc.) — RM's LAYOUT and PALETTE survive; RM's glossy-rendered art style does not (decision #60).
- Flat, rounded, thick-outline Kenney look everywhere. No gradients baked into new procedural textures beyond what matches UI Pack v2's soft bevels.
- Near-zero text unchanged: icons + numbers only in Luana-facing views.
- Piece identity is triple-coded: color + body shape + face. Shape assignment: red=circle, blue=square, green=rhombus, yellow=squircle, purple=circle+distinct face, pink('orange')=square+distinct face.
- Every asset added to the repo gets a row in public/assets/packs/MANIFEST.md and LICENSES.md. CC0 only; anything non-CC0 is rejected at this gate.

## Source zips (not committed; re-downloadable)

- https://kenney.nl/assets/ui-pack (v2.0)
- https://kenney.nl/assets/shape-characters
- https://kenney.nl/assets/toon-characters
- https://github.com/KenneyNL/Starter-Kit-Match-3 (sounds + sparkle; MIT code not used)
