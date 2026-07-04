import type { Wallet } from './wallet';

/** Coin prices for pre-level boosters (RM models this with hard currency; ours is
 *  coins only, decision in docs/RM-PARITY.md). Keys are the buyable SpecialKinds. */
export const BOOSTER_PRICES = {
  rocketH: 40,
  tnt: 60,
  lightball: 90,
} as const;

export type ShopBoosterKind = keyof typeof BOOSTER_PRICES;

/** Spend coins for one booster. No inventory: a successful buy applies to the NEXT
 *  startLevel only — the renderer passes bought kinds through StartOptions. */
export function buy(kind: ShopBoosterKind, wallet: Wallet): boolean {
  return wallet.spend(BOOSTER_PRICES[kind]);
}
