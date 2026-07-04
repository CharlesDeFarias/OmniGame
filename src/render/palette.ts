/**
 * Royal-blue palette (RM-parity pass, docs/RM-PARITY.md): deep royal-blue
 * backgrounds, gold-framed UI, blush + cream accents, green/red CTAs.
 * Property names kept from the studio-glam era (bgPlum*) to avoid a rename
 * ripple across scenes — the VALUES are now the blue family; bgBlue* aliases
 * point at the same colors for new code.
 */
export const PALETTE = {
  bgDeep: 0x0e1e3d, bgPlum: 0x16305e, bgPlumLight: 0x1f4178,
  /** Aliases for the blue era (same values as bgPlum / bgPlumLight). */
  bgBlue: 0x16305e, bgBlueLight: 0x1f4178,
  gold: 0xf5c542, goldDark: 0xb8860b, blush: 0xfd79a8,
  cream: 0xfff4e0, panel: 0x102a52, panelBorder: 0xf5c542,
  /** Genre-standard CTAs: green = go/play, red = accent/cancel. */
  ctaGreen: 0x54b842, ctaRed: 0xd8402e,
  textOnDark: '#fff4e0', textGold: '#f5c542',
} as const;
