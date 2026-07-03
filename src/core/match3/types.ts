export type PieceColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export const ALL_COLORS: readonly PieceColor[] = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange',
];

export type SpecialKind = 'rocketH' | 'rocketV' | 'tnt' | 'lightball' | 'propeller';

export type Piece =
  | { kind: 'normal'; color: PieceColor }
  | { kind: 'special'; special: SpecialKind }
  /** Box obstacle: not matchable or swappable, blocks gravity; loses 1 hp per wave from adjacent clears or booster hits. */
  | { kind: 'blocker'; hp: number };

export interface Coord { x: number; y: number; }

export interface Board {
  width: number;
  height: number;
  /** Row-major: index = y * width + x. null = empty cell awaiting refill. */
  cells: (Piece | null)[];
  /** Row-major, parallel to cells: true = ice plate under that cell (terrain; breaks when the piece above clears). */
  ice: boolean[];
}
