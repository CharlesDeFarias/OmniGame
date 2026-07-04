import { describe, expect, it } from 'vitest';
import type { CookEvent, Recipe, Step } from './types';
import { ALL_ACTIONS, ALL_INGREDIENTS, RECIPES } from './recipes';
import { applyInput, expectedNext, startRecipe } from './engine';

function inputCount(recipe: Recipe): number {
  return recipe.steps.reduce((sum, step) => {
    if (step.type === 'gather') return sum + step.ingredients.length;
    if (step.type === 'sequence') return sum + step.actions.length;
    return sum + step.layers.length;
  }, 0);
}

describe('recipe dataset', () => {
  it('holds exactly 10 recipes with unique ids in the fixed order', () => {
    expect(RECIPES).toHaveLength(10);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(10);
    expect(RECIPES.map((r) => r.id)).toEqual([
      'toast',
      'fruit-salad',
      'sandwich',
      'scrambled-eggs',
      'smoothie',
      'pancakes',
      'pasta-sauce',
      'quesadilla',
      'veggie-soup',
      'mini-pizza',
    ]);
  });

  it('uses only vocabulary ingredients and actions (runtime check)', () => {
    const ingredients = new Set<string>(ALL_INGREDIENTS);
    const actions = new Set<string>(ALL_ACTIONS);
    for (const recipe of RECIPES) {
      expect(ingredients.has(recipe.icon)).toBe(true);
      for (const step of recipe.steps) {
        if (step.type === 'gather') step.ingredients.forEach((i) => expect(ingredients.has(i)).toBe(true));
        if (step.type === 'sequence') step.actions.forEach((a) => expect(actions.has(a)).toBe(true));
        if (step.type === 'assemble') step.layers.forEach((l) => expect(ingredients.has(l)).toBe(true));
      }
    }
  });

  it('keeps every step well-formed: gather 2-6 items, no empty sequences/assemblies', () => {
    const sizeOf = (step: Step): number =>
      step.type === 'gather' ? step.ingredients.length : step.type === 'sequence' ? step.actions.length : step.layers.length;
    for (const recipe of RECIPES) {
      expect(recipe.steps.length).toBeGreaterThanOrEqual(2);
      for (const step of recipe.steps) {
        expect(sizeOf(step)).toBeGreaterThan(0);
        if (step.type === 'gather') {
          expect(step.ingredients.length).toBeGreaterThanOrEqual(2);
          expect(step.ingredients.length).toBeLessThanOrEqual(6);
          expect(new Set(step.ingredients).size).toBe(step.ingredients.length);
        }
      }
    }
  });

  it('escalates softly: total input count never drops more than the sandwich-outlier slack', () => {
    // Fixed order is normative (decision #48); sandwich's 6-layer assemble (11 inputs at
    // slot 3) is an early spike, so the soft-monotone slack is 4 rather than the ideal 1.
    for (let i = 1; i < RECIPES.length; i += 1) {
      const prev = RECIPES[i - 1];
      const curr = RECIPES[i];
      if (prev === undefined || curr === undefined) throw new Error('unreachable');
      expect(inputCount(curr)).toBeGreaterThanOrEqual(inputCount(prev) - 4);
    }
    const first = RECIPES[0];
    const last = RECIPES[RECIPES.length - 1];
    if (first === undefined || last === undefined) throw new Error('unreachable');
    expect(inputCount(last)).toBeGreaterThan(inputCount(first));
    expect(last.steps.length).toBeGreaterThan(first.steps.length);
  });

  it('every recipe plays through via expectedNext to done with 0 mistakes and 3 stars', () => {
    for (const recipe of RECIPES) {
      let state = startRecipe(recipe);
      const events: CookEvent[] = [];
      let guard = 0;
      while (!state.done) {
        guard += 1;
        if (guard > 100) throw new Error(`runaway playthrough for ${recipe.id}`);
        const next = expectedNext(state)[0];
        if (next === undefined) throw new Error(`no expected input for ${recipe.id}`);
        const r = applyInput(state, next);
        expect(r.correct).toBe(true);
        events.push(...r.events);
        state = r.state;
      }
      expect(state.mistakes).toBe(0);
      expect(events[events.length - 1]).toEqual({ type: 'recipeDone', stars: 3, mistakes: 0 });
    }
  });
});
