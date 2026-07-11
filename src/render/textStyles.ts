import type Phaser from 'phaser';
import { PALETTE } from './palette';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/**
 * Single typography pipeline (plan 9, legit-look pass): every add.text in the
 * render layer goes through TS.* so the whole app shares one font family and
 * one outline treatment. Two faces since the RM-feel pass (both loaded up
 * front in main.ts): Lilita One -- the chunky match-3 display type -- for big
 * numbers and celebratory text, Fredoka for small/body/parent text. Shared
 * system fallback stack keeps roughly the same rounded metrics.
 */
const FAMILY = 'Fredoka, "Trebuchet MS", sans-serif';
/** Chunky display face (weight 400 only; styles below stay at 400 so the real
 *  face renders instead of a synthesized bold). */
const DISPLAY_FAMILY = '\'Lilita One\', Fredoka, "Trebuchet MS", sans-serif';

/** Shared number treatment: semibold, dark midnight outline scaled to size. */
const numberBase = (size: number, color: string): TextStyle => ({
  fontFamily: DISPLAY_FAMILY,
  fontSize: `${size}px`,
  fontStyle: '400',
  color,
  stroke: '#0e1e3d',
  strokeThickness: Math.max(4, Math.round(size * 0.12)),
});

export const TS = {
  /** HUD counters, prices, panel stats: cream on a dark outline. */
  number: (size: number): TextStyle => numberBase(size, PALETTE.textOnDark),
  /** Gold-accent numbers (gate ops, rewards). */
  numberGold: (size: number): TextStyle => numberBase(size, PALETTE.textGold),
  /** Number treatment in an arbitrary accent color (e.g. blush foe counts). */
  numberTinted: (size: number, color: string): TextStyle => numberBase(size, color),
  /** Big celebratory/display text: white, royal-blue stroke, soft baked shadow. */
  display: (size: number): TextStyle => ({
    fontFamily: DISPLAY_FAMILY,
    fontSize: `${size}px`,
    fontStyle: '400',
    color: '#ffffff',
    stroke: '#16305e',
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
  /** Hero numbers on LIGHT panels (the picker's big level number): chunky
   *  display face, dark ink, NO stroke — strokes turn to mud on cream. */
  numberOnLight: (size: number): TextStyle => ({
    fontFamily: DISPLAY_FAMILY,
    fontSize: `${size}px`,
    fontStyle: '400',
    color: '#1d2a44',
  }),
  /** Dense text/numbers on LIGHT panels (stats, parent panel, picker counts):
   *  Fredoka semibold dark ink, no stroke — the display face gets clumpy at
   *  list sizes, and cream-with-stroke (the old bug) was unreadable here. */
  onLight: (size: number): TextStyle => ({
    fontFamily: FAMILY,
    fontSize: `${size}px`,
    fontStyle: '600',
    color: '#22304d',
  }),
  /** Short helper words (textTier 'minimal'): small, friendly, readable on dark. */
  label: (size: number): TextStyle => ({
    fontFamily: FAMILY,
    fontSize: `${size}px`,
    fontStyle: '600',
    color: '#fff4e0',
    stroke: '#0e1e3d',
    strokeThickness: Math.max(3, Math.round(size * 0.1)),
  }),
} as const;
