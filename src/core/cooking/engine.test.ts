import { describe, expect, it } from 'vitest';
import type { CookEvent, Recipe } from './types';
import { applyInput, currentStep, expectedNext, startRecipe, starsForMistakes } from './engine';

/** Small 3-step recipe exercising all step types. */
const TEST_RECIPE: Recipe = {
  id: 'test-dish',
  icon: 'bread',
  steps: [
    { type: 'gather', ingredients: ['bread', 'cheese'] },
    { type: 'sequence', actions: ['chop', 'cook'] },
    { type: 'assemble', layers: ['bread', 'cheese', 'bread'] },
  ],
};

describe('cooking engine', () => {
  it('startRecipe yields a fresh state on step 0', () => {
    const s = startRecipe(TEST_RECIPE);
    expect(s).toEqual({
      recipe: TEST_RECIPE,
      stepIndex: 0,
      gathered: [],
      seqDone: 0,
      mistakes: 0,
      done: false,
    });
    expect(currentStep(s)).toEqual(TEST_RECIPE.steps[0]);
  });

  it('happy path emits the full event sequence and finishes with 3 stars', () => {
    let s = startRecipe(TEST_RECIPE);
    const events: CookEvent[] = [];
    const feed = (input: Parameters<typeof applyInput>[1]): void => {
      const r = applyInput(s, input);
      expect(r.correct).toBe(true);
      events.push(...r.events);
      s = r.state;
    };
    feed({ kind: 'ingredient', id: 'bread' });
    feed({ kind: 'ingredient', id: 'cheese' });
    feed({ kind: 'action', id: 'chop' });
    feed({ kind: 'action', id: 'cook' });
    feed({ kind: 'ingredient', id: 'bread' });
    feed({ kind: 'ingredient', id: 'cheese' });
    feed({ kind: 'ingredient', id: 'bread' });
    expect(events).toEqual([
      { type: 'gathered', id: 'bread' },
      { type: 'gathered', id: 'cheese' },
      { type: 'stepDone', stepIndex: 0 },
      { type: 'acted', id: 'chop' },
      { type: 'acted', id: 'cook' },
      { type: 'stepDone', stepIndex: 1 },
      { type: 'layered', id: 'bread' },
      { type: 'layered', id: 'cheese' },
      { type: 'layered', id: 'bread' },
      { type: 'stepDone', stepIndex: 2 },
      { type: 'recipeDone', stars: 3, mistakes: 0 },
    ]);
    expect(s.done).toBe(true);
    expect(currentStep(s)).toBeNull();
    expect(expectedNext(s)).toEqual([]);
  });

  it('gather is order-free', () => {
    let s = startRecipe(TEST_RECIPE);
    const r1 = applyInput(s, { kind: 'ingredient', id: 'cheese' });
    expect(r1.correct).toBe(true);
    s = r1.state;
    const r2 = applyInput(s, { kind: 'ingredient', id: 'bread' });
    expect(r2.correct).toBe(true);
    expect(r2.events).toContainEqual({ type: 'stepDone', stepIndex: 0 });
    expect(r2.state.stepIndex).toBe(1);
  });

  it('expectedNext lists all remaining gather ingredients, then exactly one sequence/assemble input', () => {
    let s = startRecipe(TEST_RECIPE);
    expect(expectedNext(s)).toEqual([
      { kind: 'ingredient', id: 'bread' },
      { kind: 'ingredient', id: 'cheese' },
    ]);
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    expect(expectedNext(s)).toEqual([{ kind: 'ingredient', id: 'cheese' }]);
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    expect(expectedNext(s)).toEqual([{ kind: 'action', id: 'chop' }]);
    s = applyInput(s, { kind: 'action', id: 'chop' }).state;
    s = applyInput(s, { kind: 'action', id: 'cook' }).state;
    expect(expectedNext(s)).toEqual([{ kind: 'ingredient', id: 'bread' }]);
  });

  it('duplicate gather counts as wrong and increments mistakes', () => {
    let s = startRecipe(TEST_RECIPE);
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    const r = applyInput(s, { kind: 'ingredient', id: 'bread' });
    expect(r.correct).toBe(false);
    expect(r.events).toEqual([{ type: 'wrong' }]);
    expect(r.state.mistakes).toBe(1);
    expect(r.state.gathered).toEqual(['bread']);
  });

  it('non-required ingredient (distractor) during gather is wrong', () => {
    const s = startRecipe(TEST_RECIPE);
    const r = applyInput(s, { kind: 'ingredient', id: 'banana' });
    expect(r.correct).toBe(false);
    expect(r.state.mistakes).toBe(1);
  });

  it('sequence enforces exact order', () => {
    let s = startRecipe(TEST_RECIPE);
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    const wrong = applyInput(s, { kind: 'action', id: 'cook' });
    expect(wrong.correct).toBe(false);
    expect(wrong.state.mistakes).toBe(1);
    expect(wrong.state.seqDone).toBe(0);
    const right = applyInput(wrong.state, { kind: 'action', id: 'chop' });
    expect(right.correct).toBe(true);
    expect(right.state.seqDone).toBe(1);
  });

  it('assemble enforces exact layer order', () => {
    let s = startRecipe(TEST_RECIPE);
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    s = applyInput(s, { kind: 'action', id: 'chop' }).state;
    s = applyInput(s, { kind: 'action', id: 'cook' }).state;
    const wrong = applyInput(s, { kind: 'ingredient', id: 'cheese' });
    expect(wrong.correct).toBe(false);
    expect(wrong.state.mistakes).toBe(1);
    const right = applyInput(wrong.state, { kind: 'ingredient', id: 'bread' });
    expect(right.correct).toBe(true);
    expect(right.events).toEqual([{ type: 'layered', id: 'bread' }]);
  });

  it('starsForMistakes boundaries: <=1 three, <=3 two, else one', () => {
    expect(starsForMistakes(0)).toBe(3);
    expect(starsForMistakes(1)).toBe(3);
    expect(starsForMistakes(2)).toBe(2);
    expect(starsForMistakes(3)).toBe(2);
    expect(starsForMistakes(4)).toBe(1);
    expect(starsForMistakes(99)).toBe(1);
  });

  it('recipeDone carries the mistake-derived stars (2-star case)', () => {
    let s = startRecipe(TEST_RECIPE);
    s = applyInput(s, { kind: 'ingredient', id: 'banana' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'banana' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    s = applyInput(s, { kind: 'action', id: 'chop' }).state;
    s = applyInput(s, { kind: 'action', id: 'cook' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    const r = applyInput(s, { kind: 'ingredient', id: 'bread' });
    expect(r.events).toContainEqual({ type: 'recipeDone', stars: 2, mistakes: 2 });
  });

  it('recipeDone drops to 1 star past 3 mistakes', () => {
    let s = startRecipe(TEST_RECIPE);
    for (let i = 0; i < 4; i += 1) {
      s = applyInput(s, { kind: 'ingredient', id: 'banana' }).state;
    }
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    s = applyInput(s, { kind: 'action', id: 'chop' }).state;
    s = applyInput(s, { kind: 'action', id: 'cook' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    const r = applyInput(s, { kind: 'ingredient', id: 'bread' });
    expect(r.events).toContainEqual({ type: 'recipeDone', stars: 1, mistakes: 4 });
  });

  it('applyInput is pure: the input state is never mutated', () => {
    const s = startRecipe(TEST_RECIPE);
    const snapshot = JSON.parse(JSON.stringify(s)) as unknown;
    applyInput(s, { kind: 'ingredient', id: 'bread' });
    applyInput(s, { kind: 'ingredient', id: 'banana' });
    expect(JSON.parse(JSON.stringify(s))).toEqual(snapshot);
  });

  it('inputs after done are inert: wrong but no mistake increment', () => {
    let s = startRecipe(TEST_RECIPE);
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    s = applyInput(s, { kind: 'action', id: 'chop' }).state;
    s = applyInput(s, { kind: 'action', id: 'cook' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'cheese' }).state;
    s = applyInput(s, { kind: 'ingredient', id: 'bread' }).state;
    expect(s.done).toBe(true);
    const r = applyInput(s, { kind: 'action', id: 'stir' });
    expect(r.correct).toBe(false);
    expect(r.state.mistakes).toBe(0);
    expect(r.state.done).toBe(true);
    expect(r.events).toEqual([]);
  });
});
