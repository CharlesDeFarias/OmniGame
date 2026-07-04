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
| In-level HUD | goals panel + moves badge top | goals top-left, moves badge top-right | RM puts moves circle INSIDE goal panel left — mirroring this pass |
| Pre-level boosters | pick boosters before start | added this pass (coins, optional) | RM monetizes; ours costs coins only |
| Win streak reward | streak chest/boosters | streak >=3 grants free start booster (this pass) | simplified |
| Palette | royal blue bg, cream panels, gold/green CTAs | switching from plum to RM-blue scheme (this pass) | profile-swappable |
