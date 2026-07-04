# Royal Match parity tracker

Charles's direction (2026-07-04): temporarily model the game's style, color scheme, button layout, and mechanics/powerups on Royal Match, tracking every RM-modeled element here for later replacement/iteration. Boundary held throughout: NO Royal Match asset files or pixel-close replicas of their specific artwork/characters — mechanics, layouts, palettes, and style direction only (not protectable expression). All art remains CC0 (see public/assets/packs/MANIFEST.md).

| Element | RM model | Our implementation | Replace-later notes |
|---|---|---|---|
| Booster: rocket (h/v) | 4-match line clear | striped candy art, line clear | identical mechanic; art is CC0 candy |
| Booster: TNT | 5 L/T-match area blast | bomb art, 3x3 (5x5 combo) | RM radius conventions |
| Booster: light ball | 5-line color clear + combos | lollipop art, same combos | |
| Booster: propeller | 2x2 match, flies to target | being upgraded to goal-targeted flight (this pass) | |
| Booster combos | rocket+rocket cross, TNT+TNT 5x5, ball+ball board, mixed | all implemented (plan 1) | |
| Move gift | out-of-moves rescue | +5 gift once/level | RM sells extra moves; ours is free (non-exploitative) |
| Saga map home | level path + areas | MapScene, candyland bg, 10/page | RM scrolls continuously (queue #33) |
| Rooms/decorate meta | castle rooms, tasks | career rooms + furnishing | our influencer skin on top |
| In-level HUD | one goals panel top-center, moves circle inside it (left) | DONE (v2): unified panel centred (360,150), width 420-520 by goal count; white moves circle r54 with big dark number on panel left; goal icons+counts right; gold streak spark + count on badge shoulder at streak>=3 | RM adds level number + score bar in panel; ours stays icon-only |
| In-level booster bar | 3 tappable booster slots under the board | DONE (simplified): 3 INERT slots at (240/360/480, 1215) — dimmed rocket/tnt/lightball icons + grey lock ring + lock badge. Our boosters are pre-level purchases consumed at level start, so the in-level bar is visual parity only; interactive in-level boosters = future pass |
| Pre-level boosters | pick boosters before start | added this pass (coins, optional) | RM monetizes; ours costs coins only |
| Win streak reward | streak chest/boosters | streak >=3 grants free start booster (this pass) | simplified |
| Palette | royal blue bg, cream panels, gold/green CTAs | DONE: bgDeep 0x0e1e3d, bgPlum->blue 0x16305e (names kept, bgBlue alias), bgPlumLight->0x1f4178, panel 0x102a52, gold 0xf5c542 (kept), blush 0xfd79a8 (kept), cream 0xfff4e0, ctaGreen 0x54b842, ctaRed 0xd8402e; fade curtain/splash/themeColor/icons -> #0e1e3d; text strokes #0e1e3d / #16305e; cooking warm top 0x3e3055, runner cool top 0x123c5f, play bottom 0x081527, career kitchen wall 0x2e4a78 | profile-swappable |
