# Royal Match / Royal Kingdom feature inventory + gap analysis

**Deep-research salvage, 2026-07-11.** 23 sources fetched, 111 claims extracted, top 25 sent to
3-vote adversarial verification. The run was cut short by an account session limit: **11 claims
confirmed (all 3-0 or 2-0), 0 refuted, 14 unverified** (their verifier votes errored — NOT
rejections; all 14 cite official Dream Games help-center pages, so treat as high-confidence but
unverified). Synthesis step also died; this document is the hand-written synthesis.

Purpose: feature-gap analysis for the match-3 MVP. Mechanics only.

---

## Verified inventory (what Royal Match actually has)

### 1. Obstacle catalog — ~100 board elements (we have 2)
The official Game Elements catalog lists roughly one hundred distinct elements. Verified families
with implementable rules:

- **Spreading / anti-goal** (3-0): Grass (cleared by 2 matches ON its tile), Bush (spreads grass
  into 16 tiles after 5 adjacent matches), Grass Bomb (spreads grass board-wide after 9 hits),
  Honey + Honey Pot (adjacent-match cleared / spreads when broken), Jelly (INVERTED goal: the
  player must spread it over the whole board by matching on top of it).
- **Power-up-only obstacles** (3-0) — immune to plain matches, each with a hit count: Owl Statue
  (1), Stone (3), Piggy Helmet (3), Monument (4), Safe (5), Clock Tower (6), Jelly Bomb (7),
  Power Cube (3 on one cube breaks all connected), Metal Tube (shortens per hit), Rock (reveals a
  collectible gem), Giant Piggy (3 hits → releases 3 Piggy Helmets).
- **Generators / multi-stage** (3-0): Cupboard → Plates per adjacent match; Mailbox → Mail;
  Magic Hat → Gems per 3 matches; Birdhouse (5 matches) → releases 3 Birds that must REACH THE
  BOTTOM of the board; Frog (bottom-collect, reacts when not moved down); Gummy Maker, Igloo,
  Chocolate Maker, Space Shuttle (bottom-activated capsule generator).
- **Board topology / timing** (3-0): Conveyor Belt (carries jam jars, rotates one step per move),
  Purple Borders (uncleared, SHIFT part of the board one tile per move), Blinds/Metal Plate
  (reveal one hidden row/column per hit), Vending Machine / Bow Tie (containers that open and
  close on alternating moves), Curtain (opens after collecting N colored items).

### 2. Power-ups and boosters
- **In-level boosters** (3-0): Royal Hammer (one tile/one layer), **Arrow (row)**, **Cannon
  (column — we lack the column one)**, Jester Hat (shuffle). Using one does not consume a move
  (matches our implementation).
- **Pre-level boosters** (3-0): exactly Rocket, TNT, Light Ball — placed at RANDOM board
  positions (ours place center-adjacent; arguably friendlier — keep ours).
- **Butler's Gift** (3-0): win-streak start-booster system, unlocks level 32, three stages
  (1: Rocket+Propeller → 2: +TNT → 3: +Light Ball), holds at max until a level FAILS, then full
  reset. Ours is a single free booster at streak 3/5/7 — close, less escalation.
- **Super Light Ball** (3-0): unlocks level 292; after 10 straight wins the Light Ball's effect
  DOUBLES; resets on failure.

### 3. Difficulty & lives
- **Level tiers** (2-0): Normal / Hard / Super Hard / Extremely Hard — badged tiers with bigger
  rewards. We use invisible adaptive difficulty instead; tier BADGES are a presentation feature.
- **Lives** (3-0): 5 max (8 with pass), one per failed level, 30-min regen, teammates send lives,
  requests blocked above 10 banked. **Deliberately NOT wanted for us** — never-strand design.

### 4. Live-ops
- (2-0) At least 18 recurring coin-rewarding events (Propeller Madness, Book of Treasure, Team
  Battle/Treasure/Tournament, Dragon Nest, Train Journey, Ocean Odyssey, Puzzle Break, Magic
  Cauldron, Mission Control, Mission Pursuit, Archery Arena, Balloon Rise, Pinata Party, Lava
  Quest, Hidden Temple, Royal League). Single-player personal build: out of scope, but "event"
  reskins (a weekend Propeller Madness-style modifier) are cheap future flavor.

## Unverified (official help-center sources; verification errored, not refuted)

Teams/life-sharing flows (unlock at level 20, Help-button chat loop, coin reward for helping);
out-of-moves = coin-buy flow (no ad option mentioned); stars-as-task-currency for area renovation
(matches what we already built); **Royal Kingdom deltas**: Spinner power-up (replaces propeller,
distinct combo table incl. Spinner+Spinner = 3 spinners), Battle Ram/Drill/Wizard Hat/Bomber Plane
in-level boosters, Kingdom/Dark-Kingdom BATTLE levels (destroy buildings/enemies with health bars,
multi-stage boards), Magic Pots 5-stage streak (culminating 2xDynamite+Rocket+Spinner+ElectroBall
+ x2 event rewards), Super Electro Ball at level 300, Potions second currency for district tasks.

## Gap analysis → what matters for OUR match-3 MVP

Ranked by MVP value for Luana's game (forgiving, readable, personal):

1. **Obstacle variety is the real gap.** 50 levels ride on 2 obstacle types; RM sustains interest
   with ~100. Best first adds (simple rules, verified): **Grass** (2 matches on-tile; skip
   spreading at first), **Cupboard→Plates** (adjacent-match generator = new collect goal),
   **Curtain or Chain** (reveal/unlock flavor). Each is a small core mechanic + calibration pass.
2. **Cannon (column assist)** — trivially cheap: our applyAssist already generalizes row→column.
3. **Butler's-Gift-style escalation** for the win streak (stack boosters by stage instead of one
   pick) — small change to the existing streak system.
4. **Tier badges** ("Hard level!" crown on map nodes) — presentation only, pairs well with the
   adaptive system we already have.
5. Skip: lives, teams, events, Royal Kingdom battle levels — wrong fit for a personal never-strand
   game, or big-scope for later.

Sources: Dream Games official help center (game-elements catalog, gameplay guide, boosters FAQ,
teams section, Royal Kingdom guide), royalmatch.fandom.com, plus deconstruction articles — full
URL list in the workflow output. Session-limit failures logged; re-run the unverified cluster if
any of it becomes load-bearing.
