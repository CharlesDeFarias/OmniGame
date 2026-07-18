# Match-3 look + feel plan (runs 8-9)

**Charles's direction (2026-07-17):** the match-3 layer is "very far" from Luana-ready. The gaps
that matter are LOOK/ART QUALITY and FEEL/JUICE — not content depth, not onboarding (both
explicitly deprioritized this pass). Art stays Kenney/CC0, squeezed harder — no purchases, no AI
generation. Execution = long autonomous runs (adversarial review per block, Charles judges the
deployed batch at the end). The Luana-device gate and smoke protocol are DEFERRED until he says
otherwise.

## Why this shape

Everything here stays inside decision #60's one-family rule (docs/ART-BIBLE.md). The asset hunt
(docs/research/2026-07-10) already verified the CC0 sources this plan leans on; nothing below
requires a license call or a purchase. The RM inventory (docs/research/2026-07-11) supplies the
feel benchmarks. The obstacle-variety recommendation from that research is PARKED, not dead — it
returns after Charles judges these two runs.

---

## RUN 8 — Look tier 2 (art quality, all CC0)

Ordered by screen-time exposure. One reviewed block each.

**8a. Specials art gets REAL art (the "I hate the powerup icons" fix).**
The procedural rockets/TNT/color-ball are the weakest visuals left. Verified CC0 replacements:
- Rocket H/V: a Kenney **Space Shooter Redux** missile (295+ sprites, CC0), recolored/finned to
  the family palette; H = rotated V.
- TNT: **Physics Assets** (CC0, 215 files) TNT/crate block art, or its dynamite element if
  present on inspection; fallback = current bundle redrawn over the pack's crate texture.
- Color ball: keep the six-wedge concept but bake it with the family's gloss/bevel treatment +
  a white ring + star sparkle from the fx pack (concept is right, execution is flat).
- Propeller: redrawn to match whichever style the above lands on.
Same art everywhere the specials appear: board, booster bar, picker, finale.

**8b. Piece presence pass.**
Bake per-piece soft drop shadows + consistent outline weight into the composites; nudge face
scale/positioning per shape after seeing them at cell size; verify the 6 pieces read instantly
at play speed on a phone. No mechanic changes.

**8c. Board + in-level backdrop composition.**
Inner shadow ring where the navy well meets the Adventure frame; subtle Kenney **Pattern Pack**
(CC0) texture inside the well at low alpha; per-chapter in-level backdrops from **Background
Elements** (CC0, 110 flat vector scenery pieces) tinted to each chapter's accent — replaces the
bare gradient behind the board.

**8d. HUD + screen composition.**
Goals panel and coin strip alignment/spacing pass; booster-bar chips restyled to match 8a's
specials; win overlay composition (banner/stars/button hierarchy + coin count-up area); picker
layout breathing room. No new features — arrangement, sizing, consistency.

**8e. Review + deploy checkpoint.**
Holistic adversarial review (the dimensional-coupling class from run 5 is the known trap when
art sources change size), gates, merge, deploy. Charles judges the batch on his phone.

## RUN 9 — Juice deep pass (feel)

**9a. Piece-interaction feel.** Swap squash-and-stretch, landing squash on falls, neighbor
jiggle radius on booster blasts, tightened board-shake hierarchy (small/medium/big moments).

**9b. Booster anticipation + payoff.** Pre-fire beats: rocket wiggle-then-launch, TNT fuse spark
trail, lightball beam lines to each target (not just flashes at destination); combo versions
escalate visibly. Cascade escalation: existing pitch ramp + starburst "callout" at wave 3+ and a
screen-edge glow at big chains (no text).

**9c. Win/lose ceremony.** Win: dim -> banner sweep -> star pops with blooms -> coin COUNT-UP
ticker to the wallet total -> button reveal, all on a timed beat. Lose: softened, quick,
retry-forward. Finale rockets inherit 9b's rocket feel.

**9d. Sound pass.** Volume/ducking mix across the 16 SFX; add the missing beats (swap whoosh,
distinct button tap, star ding variants); evaluate Kenney **Music Jingles** (CC0) for a win
jingle sting. Ambient in-level music = Charles's call, queue item (playlist infra exists).

**9e. Streak escalation (feel-adjacent mechanic, optional block).** Butler's-Gift-style staging
verified in the RM inventory: stack start-boosters by stage (streak 3 -> +1, 5 -> +2, 7 -> +3,
hold at max until a loss resets) instead of the single free pick. Small core change + picker UI.

**9f. Review + deploy checkpoint.** Same protocol as 8e. After this, Charles decides: another
look/feel round, or re-open the smoke-protocol -> Luana gate, or pivot to content depth.

## Explicit non-goals (parked)

Obstacle/goal variety and new levels; onboarding/tutorial work; diner/jetpack anything;
persistence debt (queue #49); town backgrounds (CC-BY call); wardrobe-on-toon (#46); paid or
AI-generated art.

## Operational prerequisites

- **Push auth changed (2026-07-17 token hygiene):** the old `.secrets/github-token` is deleted.
  First push prompts a one-time Windows Credential Manager browser sign-in — needs Charles at
  the keyboard, OR he mints a fine-grained token (OmniGame-only, contents:write, 90-day expiry)
  per his standing token rule. Resolve before run 8 starts.
- Working clone unchanged: C:\Users\charl\code\OmniGame; gates = typecheck/test/build; every
  block adversarially reviewed; ledger upkeep per merge as always.

## Definition of done for these runs

Charles looks at the deployed build and says the look and feel are no longer the blockers.
That verdict — not this plan — reopens the MVP gate conversation.
