import { FINALE_COINS_PER_ROCKET } from '../core/match3/finale';
import type { JournalStorage } from './journal';

export interface WalletData {
  version: 1;
  coins: number;
  followers: number;
  hearts: number;
  xp: number;
}

export interface Wallet {
  data(): WalletData;
  /** Win payout: 20 + 10*stars coins plus a flat per-chapter bonus (kitchen = 0). */
  earnWin(stars: 0 | 1 | 2 | 3, bonus?: number): void;
  /** Video payout scaled by the chapter's payoutMultiplier (kitchen = 1), rounded per currency. */
  earnVideo(perf: 0 | 1 | 2, multiplier?: number): void;
  /** Cooking payout (plan 8): 30 + 10*stars coins, stars*10 xp. Shared economy, decision #35. */
  earnCooking(stars: 1 | 2 | 3): void;
  /** Manager-task payout (decision #50): flat 20 hearts + 50 xp per completed real-world task. */
  earnTask(): void;
  /** Gate-runner payout (queue #20): coins already computed by coinsForScore; xp = min(30, floor(coins/2)). */
  earnRunner(coins: number): void;
  /** Win-finale payout (RM moves-to-rockets): flat 3 coins per auto-fired rocket. */
  earnFinale(rockets: number): void;
  spend(cost: number): boolean;
  level(): number;
}

const KEY = 'omnigame.wallet.v1';

const DEFAULT: WalletData = { version: 1, coins: 0, followers: 0, hearts: 0, xp: 0 };

/** Cumulative-xp thresholds for influencer levels 1..7; +1200 xp per level beyond. */
const LEVEL_THRESHOLDS = [0, 150, 400, 800, 1150, 2000, 3000];
const XP_PER_LATE_LEVEL = 1200;

export function levelFor(xp: number): number {
  const top = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] ?? 0;
  if (xp >= top) {
    return LEVEL_THRESHOLDS.length + Math.floor((xp - top) / XP_PER_LATE_LEVEL);
  }
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, i) => {
    if (i > 0 && xp >= threshold) level = i + 1;
  });
  return level;
}

function isNonNegInt(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0;
}

function load(storage: JournalStorage): WalletData {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return { ...DEFAULT };
    const w = JSON.parse(raw) as Partial<WalletData> | null;
    if (
      w === null ||
      typeof w !== 'object' ||
      w.version !== 1 ||
      !isNonNegInt(w.coins) ||
      !isNonNegInt(w.followers) ||
      !isNonNegInt(w.hearts) ||
      !isNonNegInt(w.xp)
    ) {
      return { ...DEFAULT };
    }
    return { version: 1, coins: w.coins, followers: w.followers, hearts: w.hearts, xp: w.xp };
  } catch {
    return { ...DEFAULT };
  }
}

export function createWallet(storage: JournalStorage): Wallet {
  const state = load(storage);
  const save = (): void => storage.setItem(KEY, JSON.stringify(state));
  return {
    data: () => ({ ...state }),
    earnWin(stars, bonus = 0) {
      state.coins += 20 + 10 * stars + bonus;
      if (stars === 3) state.hearts += 3;
      state.xp += stars * 10;
      save();
    },
    earnVideo(perf, multiplier = 1) {
      state.followers += Math.round((25 + 5 * perf) * multiplier);
      state.hearts += Math.round(15 * multiplier);
      state.xp += Math.round(100 * multiplier);
      save();
    },
    earnCooking(stars) {
      state.coins += 30 + 10 * stars;
      state.xp += stars * 10;
      save();
    },
    earnTask() {
      state.hearts += 20;
      state.xp += 50;
      save();
    },
    earnRunner(coins) {
      state.coins += coins;
      state.xp += Math.min(30, Math.floor(coins / 2));
      save();
    },
    earnFinale(rockets) {
      state.coins += FINALE_COINS_PER_ROCKET * rockets;
      save();
    },
    spend(cost) {
      if (state.coins < cost) return false;
      state.coins -= cost;
      save();
      return true;
    },
    level: () => levelFor(state.xp),
  };
}
