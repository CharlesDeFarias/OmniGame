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
  },
  textTier: 'none' as const, // 'none' | 'minimal' | 'full' — reserved (#8); only 'none' implemented
} as const;
