export type PieceColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export const ALL_COLORS: readonly PieceColor[] = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange',
];

export type SpecialKind = 'rocketH' | 'rocketV' | 'tnt' | 'lightball' | 'propeller';

export type Piece =
  | { kind: 'normal'; color: PieceColor }
  | { kind: 'special'; special: SpecialKind };

export interface Coord { x: number; y: number; }

export interface Board {
  width: number;
  height: number;
  /** Row-major: index = y * width + x. null = empty cell awaiting refill. */
  cells: (Piece | null)[];
}
