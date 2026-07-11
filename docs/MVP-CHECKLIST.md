# Match-3 MVP checklist (Charles's directive, 2026-07-11)

Goal: the match-3 PATH (hub → map → picker → level → win → map) is polished, readable, and
stable enough to hand to Luana. Everything else (diner/jetpack polish, town backgrounds,
persistence debt #49, wardrobe-on-toon #46) explicitly WAITS until this ships.

## Definition of done

- [x] Mechanics complete: 50 calibrated levels, boosters/combos/assists, adaptive ±2, finale,
      picker, pause, haptics (runs 1-6).
- [x] One coherent art family (decision #60) with board frame + grid (run 5 + rounds).
- [x] Typography actually works: Lilita One loads (fixed 2026-07-11 — a duplicate CSS @font-face
      left the canvas face unmatched since run 3), dark unstroked ink on every light panel.
- [x] Flat ribbon banner on win screen + chapter banner; map horizon backdrop (MVP 7b).
- [ ] Charles smoke-passes the protocol below on the DEPLOYED build.
- [ ] No open Charles-flagged visual defects on the match-3 path.
- [ ] PWA installs and plays on Luana's tablet (Charles installs it).
- [ ] THE GATE: Luana plays levels 1-5 with Charles watching. Notes go to REVIEW-QUEUE.

## Charles's 2-minute smoke protocol (deployed build, phone)

1. Cold-open the PWA. Hub: cards read as Puzzle/Cooking/runner; title crisp and chunky (that's
   Lilita — if it looks like a plain default font, tell me).
2. Tap Puzzle → map: sky gradient into a sharp horizon strip (not a blurry zoom); chapter ribbon
   is a red banner shape; PLAY pill says "Play N".
3. PLAY → picker popup: all text should now be crisp dark-on-cream, zero ghost/outline letters.
   This was your twice-reported complaint — verdict here matters most.
4. Play level 1 to the win screen: banner sweeps in as a red ribbon; stars big; numbers chunky.
5. Five quick taps top-left of the hub → the parent panel: the stats text was the OTHER ghost-text
   popup — confirm it reads.
6. Report anything that still looks bad, per screen. One line each is enough.

## Explicitly deferred (do not touch until the gate passes)

Diner/jetpack visual polish beyond function; CC-BY town backgrounds (needs the license call);
queue #49 persistence stores; wardrobe rebuild on toon parts; tower/city/racing layers.
