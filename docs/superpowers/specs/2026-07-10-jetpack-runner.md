# Jetpack runner — spec (decision #62)

Replaces the lane-swipe gate-runner as THE runner. Design/stack reference: Ourcade's MIT
infinite-runner template (jetpack-joyride-style hold-to-fly) — referenced for feel and Phaser
patterns; the core is our own pure-TS implementation. The old RunnerScene + gaterunner core stay
in the codebase unrouted (same preservation rule as the recipe flow).

## The loop

- One input: HOLD anywhere to thrust up, release to fall. The whole screen is the button.
- Runs are FIXED-LENGTH levels, not endless death (forgiving-by-design for Luana): fly to the
  finish flag. 3 levels, longer + busier each.
- Coins float in lines and arcs; collecting them is the score.
- Obstacles (zap bars): touching one costs one heart of 3 and grants ~1.5s of blinking
  invincibility. Hearts at zero = the run ends EARLY at that distance with 1 star — never a
  fail screen, always progress (never-strand).
- Stars: finish with 3 hearts = 3 stars gate, else coins decide: >=80% of the level's coins = 3,
  >=50% = 2, else 1. Simple, legible.
- Payout: wallet.earnRunner(coins collected -> coinsForScore-like soft cap) — reuse the existing
  runner payout shape (20-60 coins/run target).

## Core (src/core/jetpack/, pure TS, TDD)

- types.ts: JetLevelDef {id, seed, length, coinTarget}, JetState {y, vy, dist, coins, hearts,
  invincibleFor, status}, JetEvent (coin | hit | finish | expired).
- level.ts: deterministic segment generation from seed: obstacle gates (gap positions) +
  coin runs between them. Same seeded-RNG discipline as everything else.
- engine.ts: step(state, dtSeconds, holding) -> {state, events}. Constants: GRAVITY, THRUST,
  MAX_VY, SPEED (px/s equivalent in world units), ceiling/floor clamp.

## Renderer (src/render/JetpackScene.ts)

- Player: Luana toon sprite with a procedural jetpack flame; slight tilt by vy.
- World: parallax bg (existing haze/bokeh idioms), obstacles = tinted rounded bars, coins =
  kenney2 coin, finish = flag. HUD: hearts, coin count, progress bar to the finish.
- Level select: reuse the 3-card pattern from the old runner select screen.
- Hub Runner card routes here; journal events jet_run_start / jet_hit / jet_run_end.

## Out of scope

Endless mode, powerups, vehicles, the old gate-runner's squad-count mechanic.
