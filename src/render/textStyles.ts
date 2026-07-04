import type Phaser from 'phaser';
import { PALETTE } from './palette';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/**
 * Single typography pipeline (plan 9, legit-look pass): every add.text in the
 * render layer goes through TS.* so the whole app shares one font family and
 * one outline treatment. Fredoka (loaded up front in main.ts) with a system
 * fallback stack that keeps roughly the same rounded metrics.
 */
const FAMILY = 'Fredoka, "Trebuchet MS", sans-serif';

/** Shared number treatment: semibold, dark midnight outline scaled to size. */
const numberBase = (size: number, color: string): TextStyle => ({
  fontFamily: FAMILY,
  fontSize: `${size}px`,
  fontStyle: '600',
  color,
  stroke: '#141428',
  strokeThickness: Math.max(4, Math.round(size * 0.12)),
});

export const TS = {
  /** HUD counters, prices, panel stats: cream on a dark outline. */
  number: (size: number): TextStyle => numberBase(size, PALETTE.textOnDark),
  /** Gold-accent numbers (gate ops, rewards). */
  numberGold: (size: number): TextStyle => numberBase(size, PALETTE.textGold),
  /** Number treatment in an arbitrary accent color (e.g. blush foe counts). */
  numberTinted: (size: number, color: string): TextStyle => numberBase(size, color),
  /** Big celebratory/display text: white, plum stroke, soft baked shadow. */
  display: (size: number): TextStyle => ({
    fontFamily: FAMILY,
    fontSize: `${size}px`,
    fontStyle: '600',
    color: '#ffffff',
    stroke: '#2a1f3d',
    strokeThickness: Math.round(size * 0.14),
    shadow: {
      offsetX: 0,
      offsetY: Math.max(2, Math.round(size * 0.06)),
      color: '#00000066',
      blur: 6,
      stroke: true,
      fill: true,
    },
  }),
  /** Unstroked glyphs/labels (check marks, remove crosses, track names). */
  glyph: (size: number, color = '#ffffff'): TextStyle => ({
    fontFamily: FAMILY,
    fontSize: `${size}px`,
    fontStyle: '500',
    color,
  }),
} as const;
