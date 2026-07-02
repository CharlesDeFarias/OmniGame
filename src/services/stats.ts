import type { JournalEntry } from './journal';

export interface LevelStats {
  plays: number;
  wins: number;
  bestStars: number;
}

export interface Stats {
  levelsPlayed: number;
  wins: number;
  losses: number;
  /** wins / (wins + losses), 0 when no completed levels. */
  winRate: number;
  /** Wins that needed the gift (level_end with won && stars === 1). */
  giftWins: number;
  gifts: number;
  retries: number;
  shuffles: number;
  invalidMoves: number;
  perLevel: Record<string, LevelStats>;
}

/** Aggregate a journal into parent-corner stats. Malformed entries are skipped silently. */
export function summarize(entries: JournalEntry[]): Stats {
  const stats: Stats = {
    levelsPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    giftWins: 0,
    gifts: 0,
    retries: 0,
    shuffles: 0,
    invalidMoves: 0,
    perLevel: {},
  };

  const levelStats = (level: string): LevelStats => {
    let record = stats.perLevel[level];
    if (record === undefined) {
      record = { plays: 0, wins: 0, bestStars: 0 };
      stats.perLevel[level] = record;
    }
    return record;
  };

  for (const entry of entries) {
    const { type, data } = entry;
    switch (type) {
      case 'level_start': {
        const level = data['level'];
        if (typeof level !== 'string') break;
        stats.levelsPlayed += 1;
        levelStats(level).plays += 1;
        const retry = data['retry'];
        if (typeof retry === 'number' && retry > 0) stats.retries += 1;
        break;
      }
      case 'level_end': {
        const level = data['level'];
        const won = data['won'];
        if (typeof level !== 'string' || typeof won !== 'boolean') break;
        if (won) {
          stats.wins += 1;
          const record = levelStats(level);
          record.wins += 1;
          const stars = data['stars'];
          const starCount = typeof stars === 'number' ? stars : 0;
          record.bestStars = Math.max(record.bestStars, starCount);
          if (stars === 1) stats.giftWins += 1;
        } else {
          stats.losses += 1;
          levelStats(level);
        }
        break;
      }
      case 'gift':
        stats.gifts += 1;
        break;
      case 'shuffle':
        stats.shuffles += 1;
        break;
      case 'invalid_move':
        stats.invalidMoves += 1;
        break;
      default:
        break;
    }
  }

  const completed = stats.wins + stats.losses;
  stats.winRate = completed === 0 ? 0 : stats.wins / completed;
  return stats;
}
