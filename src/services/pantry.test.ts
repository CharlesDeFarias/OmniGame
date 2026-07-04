import { describe, expect, it } from 'vitest';
import type { Recipe } from '../core/cooking/types';
import { RECIPES } from '../core/cooking/recipes';
import type { JournalStorage } from './journal';
import { createPantry, groceryListFor, GROCERY_PRICE } from './pantry';
import { createWallet } from './wallet';

function memStorage(): JournalStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const toast = RECIPES[0]!; // gather: bread, butter
const fruitSalad = RECIPES[1]!; // gather: banana, apple, strawberry, orange

/** Wallet pre-loaded with coins via the runner payout (pure coin credit). */
function richWallet(coins: number): ReturnType<typeof createWallet> {
  const w = createWallet(memStorage());
  w.earnRunner(coins);
  return w;
}

describe('pantry (decision #52)', () => {
  it('starts empty and counts stock added per item', () => {
    const p = createPantry(memStorage());
    expect(p.stockOf('bread')).toBe(0);
    p.addStock(['bread', 'butter', 'bread']);
    expect(p.stockOf('bread')).toBe(2);
    expect(p.stockOf('butter')).toBe(1);
    expect(p.stockOf('egg')).toBe(0);
  });

  it('consumeFor succeeds only when every gather ingredient is stocked, decrementing each by 1', () => {
    const p = createPantry(memStorage());
    p.addStock(['bread', 'bread', 'butter']);
    expect(p.consumeFor(toast)).toBe(true);
    expect(p.stockOf('bread')).toBe(1);
    expect(p.stockOf('butter')).toBe(0);
  });

  it('consumeFor is all-or-nothing: one missing ingredient means no changes at all', () => {
    const p = createPantry(memStorage());
    p.addStock(['bread']); // butter missing
    expect(p.consumeFor(toast)).toBe(false);
    expect(p.stockOf('bread')).toBe(1);
    // Second try after completing the set works.
    p.addStock(['butter']);
    expect(p.consumeFor(toast)).toBe(true);
    expect(p.stockOf('bread')).toBe(0);
    expect(p.stockOf('butter')).toBe(0);
  });

  it('buyItem spends GROCERY_PRICE coins and stocks one unit; a broke wallet buys nothing', () => {
    const p = createPantry(memStorage());
    const w = richWallet(GROCERY_PRICE + 2);
    expect(p.buyItem('milk', w)).toBe(true);
    expect(p.stockOf('milk')).toBe(1);
    expect(w.data().coins).toBe(2);
    expect(p.buyItem('milk', w)).toBe(false); // 2 < 6
    expect(p.stockOf('milk')).toBe(1);
    expect(w.data().coins).toBe(2);
  });

  it('groceryListFor lists unique unstocked gather ingredients, sorted', () => {
    const p = createPantry(memStorage());
    p.addStock(['bread']);
    // toast needs bread+butter, fruit-salad needs banana/apple/strawberry/orange.
    expect(groceryListFor([toast, fruitSalad], p)).toEqual([
      'apple',
      'banana',
      'butter',
      'orange',
      'strawberry',
    ]);
  });

  it('groceryListFor caps at 8 items and stays unique + sorted', () => {
    const p = createPantry(memStorage());
    const list = groceryListFor([...RECIPES], p);
    expect(list.length).toBe(8);
    expect([...list].sort()).toEqual(list);
    expect(new Set(list).size).toBe(list.length);
  });

  it('persists across instances via storage', () => {
    const storage = memStorage();
    const p = createPantry(storage);
    p.addStock(['egg', 'egg', 'milk']);
    const again = createPantry(storage);
    expect(again.stockOf('egg')).toBe(2);
    expect(again.stockOf('milk')).toBe(1);
  });

  it('is corruption-safe: garbage or wrong shapes fall back to empty', () => {
    for (const bad of ['nope', '{"version":9}', '[]', '{"version":1,"stock":[]}', '{"version":1,"stock":{"bread":-1}}', '{"version":1,"stock":{"bread":"x"}}']) {
      const storage = memStorage();
      storage.data.set('omnigame.pantry.v1', bad);
      const p = createPantry(storage);
      expect(p.stockOf('bread')).toBe(0);
    }
  });

  it('consumeFor requires the union of gather steps once each for multi-gather recipes', () => {
    const multi: Recipe = {
      id: 'test-multi',
      icon: 'egg',
      steps: [
        { type: 'gather', ingredients: ['egg', 'milk'] },
        { type: 'sequence', actions: ['stir'] },
        { type: 'gather', ingredients: ['bread', 'egg'] },
      ],
    };
    const p = createPantry(memStorage());
    p.addStock(['egg', 'milk', 'bread']);
    // union = egg, milk, bread — each decremented once (egg appears in both gathers but is one line item).
    expect(p.consumeFor(multi)).toBe(true);
    expect(p.stockOf('egg')).toBe(0);
    expect(p.stockOf('milk')).toBe(0);
    expect(p.stockOf('bread')).toBe(0);
  });
});
