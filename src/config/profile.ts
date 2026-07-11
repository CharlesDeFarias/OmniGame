/** THE personal-layer file (decisions #8/#49/#54). A generic/public build swaps ONLY this file
 *  (plus public/icon-*.png regeneration). Everything Luana-specific lives here. */
export const PROFILE = {
  identity: { name: 'Luana Studio', shortName: 'Luana', themeColor: '#0e1e3d' },
  avatar: { outfitColors: [0x9b59b6, 0x2ecc71, 0xe67e22] as const, hair: 'brown' as const },
  features: {
    tutorialHand: true,
    danceBreaks: true,
    danceBreakEveryWins: 5,
    adaptiveDifficulty: true,
    managerTasks: true,
    playlistMusic: true,
    /** Shows the haptics toggle in the pause sheet; vibration itself also honors the toggle. */
    haptics: true,
  },
  // 'none' | 'minimal' | 'full' (#8). Charles 2026-07-10: pure-icon UI overshot
  // into confusing — 'minimal' adds short helper words at decision points.
  textTier: 'minimal' as 'none' | 'minimal' | 'full',
} as const;
