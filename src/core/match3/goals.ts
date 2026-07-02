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
  clearedBoxes = 0,
  clearedIce = 0,
): GoalState[] {
  return states.map((s) => {
    const gained =
      s.goal.type === 'collect' ? (clearedByColor[s.goal.color] ?? 0)
      : s.goal.type === 'clearBoxes' ? clearedBoxes
      : clearedIce;
    return { goal: s.goal, collected: Math.min(s.goal.count, s.collected + gained) };
  });
}

export function goalsComplete(states: GoalState[]): boolean {
  return states.every((s) => s.collected >= s.goal.count);
}
