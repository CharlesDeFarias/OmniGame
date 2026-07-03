/** Fashion wardrobe catalog (plan 6.5 coin sink, decision #36): 6 outfits beyond the 3 base avatar colors. */

export interface WardrobeItem {
  id: string;
  /** Avatar torso/arm tint; must stay distinct from theme.ts base OUTFITS (purple/green/orange). */
  outfitColor: number;
  price: number;
}

export const WARDROBE: WardrobeItem[] = [
  { id: 'denim', outfitColor: 0x3498db, price: 80 },
  { id: 'scarlet', outfitColor: 0xe74c3c, price: 100 },
  { id: 'sunshine', outfitColor: 0xf1c40f, price: 120 },
  { id: 'mint', outfitColor: 0x1abc9c, price: 150 },
  { id: 'rose', outfitColor: 0xfd79a8, price: 180 },
  { id: 'midnight', outfitColor: 0x2c3e50, price: 220 },
];
