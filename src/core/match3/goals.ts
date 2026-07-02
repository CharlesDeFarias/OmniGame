import type { PieceColor } from './types';

export interface CollectGoal {
  type: 'collect';
  color: PieceColor;
  count: number;
}

export interface ClearBoxesGoal {
  type: 'clearBoxes';
  count: number;
}

export interface ClearIceGoal {
  type: 'clearIce';
  count: number;
}

export type Goal = CollectGoal | ClearBoxesGoal | ClearIceGoal;

export interface GoalState {
  goal: Goal;
  collected: number;
}

export function initGoals(goals: Goal[]): GoalState[] {
  return goals.map((goal) => ({ goal, collected: 0 }));
}

export function applyCleared(
  states: GoalState[],
  clearedByColor: Partial<Record<PieceColor, number>>,
): GoalState[] {
  return states.map((s) => {
    if (s.goal.type !== 'collect') return s;
    const gained = clearedByColor[s.goal.color] ?? 0;
    return { goal: s.goal, collected: Math.min(s.goal.count, s.collected + gained) };
  });
}

export function goalsComplete(states: GoalState[]): boolean {
  return states.every((s) => s.collected >= s.goal.count);
}
