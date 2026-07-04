# Building a generic (public-layer) app

Decision #54: the personal layer is ONE file. To ship a build that is not
Luana's, you swap `src/config/profile.ts` and regenerate the icons. Nothing
else.

## What swapping `src/config/profile.ts` changes

- **`identity`** — app name, PWA install short name, browser-chrome color.
  Flows into the PWA manifest (`vite.config.ts`), the Phaser canvas background
  (`src/render/main.ts`), the document title and the `theme-color` meta (set at
  boot by `main.ts`). `src/config/appIdentity.ts` is only a re-export shim kept
  for those imports.
- **`avatar.outfitColors`** — the three procedural avatar outfits
  (`src/render/theme.ts`). `avatar.hair` is declared for the future illustrated
  pass; the procedural avatar's hair color is currently fixed.
- **`features`** — per-player switches, all wired with the current build's
  behavior when `true`:
  - `tutorialHand` — zero-text hand loop on the very first level.
  - `danceBreaks` + `danceBreakEveryWins` — dance break offered after every
    Nth win (Luana: 5).
  - `adaptiveDifficulty` — the ±2 tier system; `false` plays every level
    exactly as calibrated in its JSON.
  - `managerTasks` — career-screen clipboard + task payout, and the task
    sections of the hub's hidden parent panel.
  - `playlistMusic` — the parent panel's playlist section and playlist
    playback during dance breaks (procedural beat stays).
- **`textTier`** — reserved (decision #8). Only `'none'` (zero-text UI) is
  implemented; `'minimal'`/`'full'` are future work.

## What it does NOT change

- **Game design constants**: star rules, economy prices/coin bonuses, room
  costs, level calibration, adaptive tier math, recipes. Those are the game,
  not the profile — they live in `src/core/`, `src/meta/` and the level JSONs.
- **Storage keys**: `omnigame.*.v1` keys stay as they are (some intentionally
  carry v2 payloads — migration artifact, see project ledger). A rebrand on
  the same device keeps existing saves; do not rename keys per profile.
- **Theme/palette**: the studio-glam look (`src/render/palette.ts`) is shared.
  Theme packs are a future public-layer feature.

## Icon regeneration

Icons are generated, not drawn: `npx tsx scripts/make-icons.ts` writes
`public/icon-192.png` and `public/icon-512.png`. The icon colors (plum/gold/
blush) are constants at the top of `scripts/make-icons.ts` — edit them there
for a rebrand (they mirror `src/render/palette.ts`).

## index.html caveat (review-queue #8 — resolved)

`index.html` used to hardcode two brand values: the `<title>` ("Luana Studio")
and the `theme-color`/background color (`#141428`). Now:

- the static `<title>` is a neutral **OmniGame** (avoids flashing the wrong
  brand before JS runs) and `main.ts` sets `document.title` from the profile;
- `main.ts` also rewrites the `theme-color` meta from
  `PROFILE.identity.themeColor`. The static `#141428` in the meta tag and the
  inline `body` background remain as pre-JS dark fallbacks — only worth
  touching if a profile ever ships a non-dark chrome color;
- the **splash screen** (plan 9) follows the same pattern: `index.html` ships
  the `#splash` overlay with a neutral 'OmniGame' title, and `main.ts` swaps
  in `APP_IDENTITY.name` synchronously at boot (this is the splash text swap
  point — no per-profile edit to `index.html` needed). The splash's heart and
  spinner colors are hardcoded palette values in `index.html`'s inline CSS;
  edit them there only if a rebrand changes the palette.

## Checklist

1. Replace `src/config/profile.ts`.
2. Edit the color constants in `scripts/make-icons.ts` if the brand colors
   change, then `npx tsx scripts/make-icons.ts`.
3. `npm test && npm run build` — `src/config/profile.test.ts` guards the
   profile shape and the appIdentity shim.
