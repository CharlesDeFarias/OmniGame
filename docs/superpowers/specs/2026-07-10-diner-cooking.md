# Diner cooking game — spec (decision #62)

Replaces the gather/act/assemble recipe flow as THE cooking game. Design modeled on Burger Party's
customer/order-stack/serve loop (GPL project used as DESIGN REFERENCE ONLY — zero code or assets
copied; mechanics are not copyrightable). The old recipe flow (CookingScene, recipes.ts, serving.ts)
is PRESERVED unrouted for future reuse per Charles.

## The loop (one "shift")

1. A customer walks to the counter with an ORDER BUBBLE: a vertical stack of ingredient icons
   (bottom-to-top, 3-6 layers by difficulty). Pictures only; textTier 'minimal' adds a couple of
   helper words (screen title, Serve!).
2. The player taps ingredient buttons on the counter; each correct tap stacks that ingredient onto
   the build plate with a bounce. The NEXT ingredient needed is always the lowest unbuilt layer —
   order matters, exactly like stacking a real burger.
3. Wrong tap: the ingredient wobbles and hops off the plate (gentle sfx, mistake counted, nothing
   lost — the build never resets). Never-strand: there is NO way to ruin an order.
4. When the stack matches the order, tap the bell (or the customer) to serve: cheer, coins fly,
   patience meter converts to a tip.
5. Patience: a slowly draining smile meter per customer. It NEVER fails the order — at zero the
   customer just stops tipping (base pay stands). Relaxed but alive.
6. A shift = 5 customers. Stars by total mistakes (0 → 3 stars, 1-2 → 2, 3+ → 1) — same shape as
   the recipe stars so the economy reads identically.

## Economy hooks (unchanged surfaces)

- Payout: wallet.earnCooking(stars) at shift end — same coins/xp as before (decision #35 economy).
- Pantry shield (grocery system): if the pantry has stock for the shift's dish family, the first
  mistake is absorbed (shield heart in the header) and one stock is consumed — same rule as today.
- Journal events: diner_shift_start, diner_serve {mistakes, tipped}, diner_shift_end {stars, coins}.

## Content

- Dishes are ingredient stacks defined as data (src/core/diner/dishes.ts): burger family
  (bun-bottom, patty, cheese, lettuce, tomato, bun-top), breakfast family (plate, pancake, butter,
  syrup), drink family (cup, juice, straw). 3 families at launch, each with 2-3 dish variants of
  growing height. Difficulty ramps within a shift: customer 1 gets the shortest variant, customer 5
  the tallest.
- Order generation: seeded RNG (deterministic core rule) — shift seed → customer dishes.

## Art (ART-BIBLE compliant)

Ingredients drawn procedurally in the flat Kenney style (rounded shapes, thick outlines) — no new
packs needed; burger/pancake/cup layers are simple silhouettes that match the family. Customers are
Kenney toon characters (already staged). Counter/HUD reuse the kenney2 GUI keys.

## Architecture

- src/core/diner/: types.ts, dishes.ts, engine.ts — pure TS, zero Phaser, TDD. Engine holds
  ShiftState (customers, current order, build progress, mistakes, patience ticks as externally
  driven time steps) and returns events (ingredient-added, rejected, served, shift-end).
- src/render/DinerScene.ts — thin renderer over the event stream, same pattern as PlayScene.
- Old CookingScene stays in the codebase but the hub Cooking card routes to 'diner'.

## Out of scope (this run)

Multiple simultaneous customers, stations/processing (chop/cook timers), moving the serving mode,
recipe-flow reuse decisions (queue item), dish unlock meta beyond the 3 families.
