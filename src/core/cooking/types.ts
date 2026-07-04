/** Cooking game core types (plan 8, decisions #44/#48). Pure data — zero Phaser. */

export type IngredientId =
  | 'bread'
  | 'butter'
  | 'banana'
  | 'apple'
  | 'strawberry'
  | 'orange'
  | 'yogurt'
  | 'egg'
  | 'milk'
  | 'cheese'
  | 'ham'
  | 'lettuce'
  | 'tomato'
  | 'pasta'
  | 'sauce'
  | 'tortilla'
  | 'flour'
  | 'sugar'
  | 'carrot'
  | 'potato'
  | 'onion'
  | 'dough'
  | 'oil'
  | 'salt';

export type ActionId = 'chop' | 'stir' | 'pour' | 'flip' | 'spread' | 'blend' | 'cook';

export type Step =
  | { type: 'gather'; ingredients: IngredientId[] }
  | { type: 'sequence'; actions: ActionId[] }
  | { type: 'assemble'; layers: IngredientId[] };

export interface Recipe {
  id: string;
  icon: IngredientId;
  steps: Step[];
}

export type CookInput =
  | { kind: 'ingredient'; id: IngredientId }
  | { kind: 'action'; id: ActionId };

export interface CookingState {
  recipe: Recipe;
  stepIndex: number;
  /** gather: set of gathered ids; sequence/assemble: count done in order */
  gathered: IngredientId[];
  seqDone: number;
  mistakes: number;
  done: boolean;
}

export type CookEvent =
  | { type: 'gathered'; id: IngredientId }
  | { type: 'acted'; id: ActionId }
  | { type: 'layered'; id: IngredientId }
  | { type: 'wrong' }
  | { type: 'stepDone'; stepIndex: number }
  | { type: 'recipeDone'; stars: 1 | 2 | 3; mistakes: number };
