import type { Dish, DishFamily, Ingredient } from './types';

/**
 * Launch content (spec 2026-07-10): three families, each with variants of
 * growing stack height. Within a shift, customer i gets a variant no shorter
 * than customer i-1's — the gentle in-shift difficulty ramp.
 */
export const DISHES: readonly Dish[] = [
  { id: 'burger-plain', family: 'burger', stack: ['bun-bottom', 'patty', 'bun-top'] },
  { id: 'burger-cheese', family: 'burger', stack: ['bun-bottom', 'patty', 'cheese', 'bun-top'] },
  { id: 'burger-garden', family: 'burger', stack: ['bun-bottom', 'patty', 'cheese', 'lettuce', 'tomato', 'bun-top'] },
  { id: 'pancakes-short', family: 'breakfast', stack: ['plate', 'pancake', 'butter'] },
  { id: 'pancakes-tall', family: 'breakfast', stack: ['plate', 'pancake', 'pancake', 'butter', 'syrup'] },
  { id: 'juice', family: 'drink', stack: ['cup', 'juice', 'straw'] },
] as const;

/** All ingredients a family's counter offers (the tappable buttons). */
export function counterFor(family: DishFamily): readonly Ingredient[] {
  switch (family) {
    case 'burger': return ['bun-bottom', 'patty', 'cheese', 'lettuce', 'tomato', 'bun-top'];
    case 'breakfast': return ['plate', 'pancake', 'butter', 'syrup'];
    case 'drink': return ['cup', 'juice', 'straw'];
  }
}

export function dishById(id: string): Dish {
  const dish = DISHES.find((d) => d.id === id);
  if (dish === undefined) throw new Error(`unknown dish: ${id}`);
  return dish;
}
