# Why AI-built games look amateur — and what $25 of asset planning actually buys

**Deep-research report, 2026-07-10.** 21 sources fetched, 90 claims extracted, top 25 adversarially verified by 3-vote panels: 22 confirmed, 3 refuted. Prices are live-market snapshots from 2026-07-10 and will drift. Written for OmniGame (Royal Match-style match-3 PWA, Phaser 3, public GitHub repo, ~$25 asset budget).

---

## TL;DR

1. **The amateur look is asset incoherence, not asset quality.** Mixed rendering styles, packs from unrelated artists, no single visual system. Practitioners consistently name *coherence* — not beauty — as what separates "asset-flip cheap" from "cohesive pro." Individual gorgeous assets that don't fit one picture read worse than modest assets that do.
2. **Code-polish passes are a symptom, not a cure.** The one directly-relevant solo-dev postmortem (Wordsum, Game Developer) describes exactly our pattern: draining asset hunts for things that "followed a common theme," the UI rebuilt **four times**, and the dev's own conclusion that upfront art direction would have prevented it all. OmniGame's history — three "make it look legit" code passes that helped less than one art-pack swap — is the same story.
3. **The fix is the art-bible discipline at hobbyist scale: lock ONE style-matched pack family from ONE vendor *before* building**, instead of curating disparate packs after the fact. For a solo dev this doesn't mean writing a document; it means the pack family *is* the art bible.
4. **$25 is genuinely enough** — verified live: complete match-3 GUI kits from $2–6, coordinated single-vendor families ~$11.50, 28 match-3 packs at ≤$15 on itch.io alone.
5. **But there's a trap: almost no paid pack can legally live in a public GitHub repo.** "Royalty-free" only means no per-use payments. Every major vendor checked (CraftPix, Envato/GraphicRiver, itch.io's default paid license, Synty/TurboSquid-class) allows shipping assets *inside the compiled game* but forbids redistributing the *raw files* — which committing PNGs to a public repo does. The standard community workaround: gitignore the paid assets and keep them in a private submodule or inject them at build time.
6. **Kenney (CC0) is the only verified fully repo-safe ecosystem** — which is why OmniGame's current stack is legally clean. The catch: Kenney has no candy/match-3 family, and the claim that his 60k assets share one unified style was *refuted* — style curation is needed even within Kenney.

---

## 1. The diagnosis (confidence: medium)

Games assembled from AI-generated or randomly-sourced assets read as amateur chiefly because the assets **lack thematic/stylistic coherence** — the canonical example being a photorealistic element inside a cartoony scene, or packs with different outline/lighting conventions sharing a screen. Stitching assets together "without any artistic rhyme or reason" is the asset-flip signature; complete visual unity *in any style* beats beautiful assets that don't fit one picture. (3-0; drillimation.com 2025, corroborated by asset-flip literature and indie art-direction guides.)

**Refuted nuance:** the specific claim that *palette* coherence is THE decisive amateur/pro separator failed verification (1-2). Palette locking survives as one ingredient of the discipline, not the whole answer. Likewise the neat mechanistic story of *why* AI image generations style-drift (prompts not locking production constraints) was refuted as stated — the drift is real, the tidy explanation wasn't supported.

**OmniGame implication:** our board reads well because the candy piece set is one artist's family. The seams are where ecosystems meet: FGG GUI + Kenney fx + procedural textures + candy pieces are four visual systems on one screen. That seam-count — not any individual asset — is the remaining "amateur" signal.

## 2. The planning discipline (confidence: medium)

The professional tool is the **art bible**: a pre-production document specifying exactly what style, palette, character, and environment standards every asset must match, created *before* assets are made (Polycount wiki; Room 8 Studio via Game Developer; recommended even for small indies). For a solo dev buying packs, the discipline translates to: **choose the complete pack family first, verify it covers every surface you'll need (GUI + pieces + boosters + backgrounds + map), and only then build screens against it.** (3-0 and 2-1 merged; the solo-dev translation is verifier inference, flagged as such.)

The Wordsum postmortem is the direct evidence that skipping this costs more than it saves: reactive asset hunting → four UI rebuilds → "work with an artist next time." (3-0, verbatim quotes; caveats: n=1, from 2015, word game not match-3.)

## 3. The $25 market (confidence: high — all prices fetched live 2026-07-10)

Verified available, with prices and contents confirmed on-page:

| Item | Price | What's in it | Notes |
|---|---|---|---|
| CraftPix **Match 3 GUI** | $6.00 (seen at $0.60 in a 90%-off itch sale) | Home screen, level select, win/lose/pause/try-again windows, stars, buttons, coins, lives — 61 PNGs + vector source | 2017-era art; may read dated vs 2025 RM |
| CraftPix **Monsters Match 3** + free backgrounds | $5.50 | 25 monster sprites in 5 colors, explosions, blocks, obstacles | Monster-themed, not candy — fit risk for the RM look |
| → CraftPix coordinated family (all three) | **~$11.50** | GUI + pieces + backgrounds from one vendor, curated as a set | "Style-matched" is CraftPix's own framing |
| monixxy **Kawaii Match-3** packs | $15 | Pieces + specials + vanish animations + 35 buttons + HUD + level map | Closest candy-themed complete candidate; license not verified end-to-end |
| monixxy **Candy Loot Pack** | $5 | 114 candy illustrations in 7 color variants, marketed for match-3 pieces | |
| orabon candy-gloss icons + matching UI kit | $5 + $3.99 | 70 icons + same-style UI kit | |
| DeviStudio **Jelly Quest UI Kit** | $2 | 50+ elements, 5 premade screens, Figma source | **Tagged AI-assisted; no license text on page — repo-safety unverified** |
| itch.io match-3 tag, ≤$15 filter | — | 28 packs total | Some piece-only/background-only; counts drift |

(All 3-0 votes; itch.io tag page and individual product pages fetched live.)

**What verification did NOT establish:** whether any of these actually *look* Royal Match-class. Sources prove price, contents, and license — perceived quality is a judgment call that needs eyeballs on the store pages.

## 4. The public-repo licensing trap (confidence: high)

This is the sharpest finding, verified against six primary license texts (6× 3-0):

- **"Royalty-free" ≠ redistributable.** It means only that no ongoing per-use payments are owed.
- **The universal split:** compiled-game-yes / raw-files-no. CraftPix's license states you can NOT resell the source files and forbids distribution "that would make some or all of the art files useable to another end user" — which a public GitHub repo does by definition. Envato additionally forbids letting end users "extract the Item." itch.io's default General Paid Asset License (2025-04-21) has the same shape. Same for Synty/TurboSquid/CGTrader.
- **The trap is invisible at purchase:** CraftPix product pages and its itch.io mirror show *no license text inline* — the restriction lives on a separate file-licenses page buyers routinely miss.
- **The standard workaround** (from itch.io open-source threads): exclude paid assets from the repo — `.gitignore` + a private asset submodule, or build-time injection. The game ships with them; the source tree doesn't contain them.
- itch.io sellers *can* attach custom licenses including CC0, so **per-pack license verification stays mandatory** there.

**OmniGame implication:** any paid pack means restructuring to a `public/assets/paid/` gitignored layer (deploy would need the assets injected at build — our GitHub Actions Pages deploy would need a private submodule + token, or a manually-uploaded release asset). That's real plumbing to weigh against the $11.50.

## 5. Free tier and AI assets (confidence: high on what's below; big gaps — see §7)

- **Kenney is confirmed CC0** ("unlimited commercial projects, no attribution") — raw files may legally sit in a public repo, the defining difference from every paid vendor above. The $19.95 all-in-one bundle buys packaging convenience, not extra rights; the same assets are free individually. (3-0.)
- **Refuted:** "Kenney's 60k assets share one unified style" (1-2). His catalog spans multiple styles; the one-family discipline applies *within* Kenney too. And he has **no candy/match-3 family** — the genre gap is why OmniGame's board pieces come from elsewhere.
- **AI-generated packs:** itch.io has made generative-AI disclosure mandatory since Nov 2024 (still enforced 2025-26) — untagged AI packs get de-indexed. Their stated rationale is the point that matters for us: unresolved legal provenance ("anyone who uses your asset should have the full ability to trace the source of every piece... in case they need to defend their work legally"). The AI tag is filterable metadata, not a visible badge, and enforcement is imperfect — the $2 Jelly Quest kit is itself AI-assisted. (3-0.) For a public repo, AI-generated assets add provenance risk precisely where we've been most careful (the no-RM-assets DMCA line).

## 6. What this means for OmniGame — the verdict

The evidence supports a clear read of our history: **runs 7/9/10 (code polish) under-delivered because the problem was never polish — it was four visual systems sharing a screen.** The single biggest verified lever left is reducing seam count by adopting one coherent family for the GUI layer, which is exactly where RM's "premium" read lives.

Three honest paths, in order of evidence-backed appeal:

1. **Candy-first paid family (~$15–20): monixxy Kawaii + Candy Loot** — the only candy-themed near-complete candidate found. Requires: end-to-end license check first, then the private-asset-layer plumbing (§4). Best genre fit; unverified license is the open risk.
2. **CraftPix family (~$11.50)** — verified price/contents/license, single vendor, but monster pieces + 2017 GUI are genuine fit risks against the RM look. Same repo plumbing needed.
3. **Stay CC0, curate harder (free)** — legally frictionless, but the research half-confirmed a ceiling: no CC0 candy/GUI family surfaced at all (§7). This path means living with seams or commissioning.

Either paid path also buys the discipline going forward: the pack family becomes the art bible — every future screen gets built *from* it, never alongside it.

## 7. What the research could NOT answer (flagged honestly)

- **The perceived-quality hierarchy (research Q6)** — whether GUI kit > piece art > backgrounds > fonts > SFX for perception — produced **zero surviving verified claims**. The "GUI layer first" allocation above is inference from the coherence findings, not measured consensus.
- **The free-tier ceiling (Q4) is half-answered:** Kenney's CC0 status is proven, but where good CC0 curation tops out for a candy look — and whether any CC0 candy family exists at all — remains unverified.
- **AI generation workflows (Q5)** — Midjourney/SDXL set-consistency, LoRA style-locking, AI SFX tools — yielded only the itch.io policy findings. The how-to and quality-ceiling questions are unanswered, and the one mechanistic style-drift claim was refuted.
- **Aesthetic fit** of every named pack is unverified by design — needs human eyes.

## Sources (21 fetched; key ones)

- itch.io match-3 ≤$15 tag + product pages (primary, live 2026-07-10) — market/prices
- craftpix.net product, set, and file-licenses pages (primary) — family + license
- kenney.itch.io / kenney.nl (primary) — CC0 verification
- itch.io generative-AI disclosure announcement + quality guidelines (primary) — AI policy
- itch.io open-source-with-paid-art threads ×3 (forum) — the gitignore/private-submodule practice
- Game Developer: Wordsum postmortem (first-person) — planning-failure evidence
- Polycount wiki: Art Bible (secondary) — the discipline
- Kongregate + Cinevva license guides (secondary) — royalty-free vs redistribution
- wayline.io, drillimation.com, vsquad.art, Hacker News Kenney thread (blog/forum) — practitioner diagnosis
