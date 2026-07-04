# Review queue — judgment calls awaiting Charles's confirmation

Made during the autonomous run (decision #45). Newest last. Format: what I decided, why, what to check in the build.

| # | Area | Decision made | Why | Check |
|---|------|---------------|-----|-------|
| 1 | Identity | App name set to 'Luana Studio' (short name 'Luana') | You chose personal naming, left the exact name to me | Icon + install banner on her phone |
| 2 | Avatar | Default look: brown shoulder-length hair, warm skin, pink-gold outfit | Designer's-choice personalization | Career screen + video moments |
| 3 | Palette | Plum/midnight base (#2a1f3d/#141428), gold accents (#f5c542), blush pink (#fd79a8) | Royal-Kingdom-glam translated to influencer warmth | Whole app look |
| 4 | Design | Glossy gem treatment: rim stroke + double highlight + inner bottom shade; specials on cream badge with gold ring | Royal-Kingdom gloss, procedurally | Any level board |
| 5 | Design | Gym wall stayed greenish (0x2f4a45) while others went plum; goal check mark stays green | Hue identity / completion clarity for Luana | Career gym room; goal HUD |
| 6 | Design | Win banner sweeps in behind stars; swaps overshoot slightly (Back ease); falls bounce; camera shakes on booster swaps; >=6-cell clears flash rings | Juice pass | Feel of any level; flag anything that reads too busy |
| 7 | Identity | Icon: plum bg, gold ring, blush heart + gold flash dot; app installs as 'Luana Studio' | Decisions #47/#49 | Re-install prompt / home-screen icon on her phone |
| 8 | Hygiene | index.html still hardcodes title/colors (rebrand = 2 files not 1); attemptSwap duplicates core index math | Reviewer notes, deferred | none — code only |
| 9 | Cooking | 10 everyday recipes, relaxed assembly, wrong taps only wiggle (no sound), 3-star scoring by mistakes (<=1/<=3) | Decisions #44/#48; gentle by design | Play toast + sandwich + quesadilla |
| 10 | Economy | Cooking pays ~2-5x coins/minute vs match-3 (intended shared economy; softens grind gates) | Reviewer flagged; I judged acceptable + non-exploitative | Does match-3 feel underpaid? |
| 11 | Hub | App now boots to a hub with two game cards + 2 locked teasers; career/cooking have home buttons | Omnibus front door | First screen on launch |
| 12 | Cooking | Action buttons sit on cream badges (tappable affordance), ingredients plain; pan-card icon has a fried egg | Icon-language judgment calls | Cooking play view |
| 13 | Manager | Manager panel live: 5 taps top-left ON THE HUB opens your panel (stats row + assign tasks by icon: dance/exercise/makeup/cooking/star + toggle done + remove). Luana sees pending tasks via a pulsing clipboard on the career screen; completing (you toggle) pays her 20 hearts + 50 xp with a celebration | Decision #50; icon set from #32 | Assign yourself a task, toggle it, watch her career screen |
| 14 | Bugfix | The parent stats corner in match-3 was UNOPENABLE on the live build since the July-2 overlay fix (instant-close regression) — found by the manager-panel review's harness, fixed everywhere | Reviewer's Phaser harness reproduced it empirically | 5-tap corners now open and stay open |
| 15 | Manager | Makeup task icon reuses the heart (same as hearts currency) — mild symbol collision | No dedicated makeup icon yet | Plan-7 art pass will give makeup its own icon |

