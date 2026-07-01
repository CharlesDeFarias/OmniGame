# OmniGame — Match-3 MVP Design

Date: 2026-07-01
Status: approved pending user review
Author: Charles + Claude (brainstorming session)

## Vision

OmniGame is a personal omnibus of casual games, free of ads and exploitative monetization. The first MVP is a match-3 game (Royal Match model) for Charles's sister **Luana**, who has Down syndrome. Long-term, the project may go public to demonstrate that games can be lucrative without being exploitative; private use comes first, and nothing in the core may ever depend on monetization.

**Theme anchor:** for Luana-focused games (match-3, later cooking), the theme is *an adult living their life, being an adult, and leveling up* — subtle, constant nudges toward independence. Fun and playability always outrank the message.

**Luana's personal narrative (her profile's story skin):** she is becoming a famous influencer, managed by her brother Charles. Adult-life progression is framed through that career — her apartment doubles as her studio, milestones become influencer beats (filming a cooking video in her new kitchen), and side games she likes are themed around learning, improving, and performing as an influencer. This narrative lives in her personal profile/theme layer; the generic public layer keeps the plain adult-life framing.

## MVP scope

Match-3 only, playable on Luana's Android phone (and tablet) as an installable web app (PWA). Hub shell exists but may open directly into match-3.

**MVP cut:** chapter one only — kitchen-themed levels plus one furnishable room — shipped to Luana early. Every later chapter is content, not code. Performance target: recent/mid-range Android (2022+), steady 60fps.

## Architecture

One repeated pattern per game, plugged into a shared shell:

- **App shell (hub):** game picker, install/update handling, profiles. MVP boots straight into match-3 but the picker slot exists.
- **Game module = logic core + presentation layer.**
  - *Logic core:* pure TypeScript, zero Phaser imports. Board state, match detection, boosters, cascades, goals, scoring, difficulty math. Fully unit-tested (TDD). **Deterministic:** all randomness flows through a seeded RNG — same seed, same board, same cascades. This makes tests reproducible, bugs replayable, and powers the level simulator.
  - *Presentation layer:* Phaser 3 scenes — drawing, animation, sound, input. Swappable if we ever outgrow Phaser (~30% of code, not a rewrite).
- **Shared services:** saves/progress (on-device), settings, difficulty, audio, celebration effects. Built once, reused by every game.
- **Content packs + profiles (key system):** the engine never hardcodes content or tone. It reads:
  - *Theme pack:* art + sounds for pieces, board, meta-layer. MVP ships the classic gems/candies pack; the everyday-adult-objects pack (groceries, coins, keys, socks, coffee cups) is built progressively underneath as the second pack. Users can eventually switch themes.
  - *Text tier:* none / minimal / full. Luana's build runs at near-zero text (she reads at ~2nd-grade level, strong comprehension once read). Textier tiers are built underneath for other users.
  - *Profile:* name, personal details, avatar, difficulty, narrative skin. Luana's build is deeply personal: her name, tailored details, an avatar growing into a famous influencer managed by her brother. A generic public-facing profile layer (plain adult-life framing) is built in parallel.
  - Luana's version = a configuration (gems pack + no-text tier + personal profile + forgiving difficulty), not a fork.

## Match-3 game design

**Core play (Royal Match model):** ~7×9 grid; swap adjacent pieces to match 3+. Special pieces: 4-in-a-row → rocket (clears a line); 5 in L/T → TNT (area blast); 5-in-a-row → light ball (clears one color); 2×2 → propeller. Boosters combine when swapped together. Cascades chain automatically with juicy animation and sound — the dopamine engine.

**Levels and goals:** visual goals shown as icon + counter (e.g. collect 20 blue gems, clear boxes) plus a move counter.

**Fail states — "losing makes winning fun":** gentle goals, forgiving limits. Running out of moves auto-grants +5 moves once per level, then a cheerful, no-shame retry. No lives, no timers, no ads, no interruptions. Difficulty later becomes a profile setting (move counts, board generosity, gift frequency), from more forgiving to less.

**Meta-progression:** stars earned from levels furnish an apartment room by room, organized into life-milestone chapters (kitchen → cooking-themed levels, laundry, job, etc.). Furnishing = tap one of three choices, fully visual. This is where the independence theme lives: she is the adult assembling her own home.

**Tutorials:** zero text. A pointing hand demonstrates the first swap of each new mechanic (Royal Match pattern, minus words).

**Level design as data + simulator:** levels are JSON files (board layout, goals, move budget, piece mix). A headless simulator auto-plays each level thousands of runs (using the deterministic core) to measure win rate, cascade frequency, and average moves-to-win before Luana ever sees it. "Losing makes winning fun" requires *calibrated* losing; the simulator is the calibration tool.

**Motor accessibility:** board size is a difficulty/profile lever (start ~7×7; touch targets stay large on a phone). Both drag-to-swap and tap-tap-to-swap are supported. Haptic feedback (vibration) on matches and boosters.

**Private stats (local only, never uploaded):** the game records plays, retries, and level outcomes on-device, viewable in a hidden parent/dev corner of the app. Purpose: spot where Luana struggles and seed future difficulty tuning.

## Technical plan

- **Stack:** TypeScript, Vite, Phaser 3, Vitest.
- **Structure:**
  - `src/core/` — pure logic per game (`match3/` first)
  - `src/render/` — Phaser scenes
  - `src/shell/` — hub
  - `src/services/` — saves, settings, audio