import type { CookEvent, CookInput, CookingState, Recipe, Step } from './types';

/** Relaxed scoring (decision #44): mistakes never fail, they only cost stars. */
export function starsForMistakes(mistakes: number): 1 | 2 | 3 {
  if (mistakes <= 1) return 3;
  if (mistakes <= 3) return 2;
  return 1;
}

export function startRecipe(recipe: Recipe): CookingState {
  return { recipe, stepIndex: 0, gathered: [], seqDone: 0, mistakes: 0, done: false };
}

export function currentStep(state: CookingState): Step | null {
  if (state.done) return null;
  return state.recipe.steps[state.stepIndex] ?? null;
}

/** Gather: every required-not-yet-gathered ingredient; sequence/assemble: exactly the single next input. */
export function expectedNext(state: CookingState): CookInput[] {
  const step = currentStep(state);
  if (step === null) return [];
  if (step.type === 'gather') {
    return step.ingredients
      .filter((id) => !state.gathered.includes(id))
      .map((id) => ({ kind: 'ingredient', id }) as CookInput);
  }
  if (step.type === 'sequence') {
    const next = step.actions[state.seqDone];
    return next === undefined ? [] : [{ kind: 'action', id: next }];
  }
  const next = step.layers[state.seqDone];
  return next === undefined ? [] : [{ kind: 'ingredient', id: next }];
}

export interface ApplyResult {
  state: CookingState;
  correct: boolean;
  events: CookEvent[];
}

function clone(state: CookingState): CookingState {
  return { ...state, gathered: [...state.gathered] };
}

function wrong(state: CookingState): ApplyResult {
  const next = clone(state);
  next.mistakes += 1;
  return { state: next, correct: false, events: [{ type: 'wrong' }] };
}

/** Marks the current step complete, advancing (and finishing the recipe on the last step). */
function completeStep(state: CookingState, events: CookEvent[]): void {
  events.push({ type: 'stepDone', stepIndex: state.stepIndex });
  state.stepIndex += 1;
  state.gathered = [];
  state.seqDone = 0;
  if (state.stepIndex >= state.recipe.steps.length) {
    state.done = true;
    events.push({ type: 'recipeDone', stars: starsForMistakes(state.mistakes), mistakes: state.mistakes });
  }
}

/** Pure transition: never mutates the input state; wrong inputs never fail, only count mistakes. */
export function applyInput(state: CookingState, input: CookInput): ApplyResult {
  const step = currentStep(state);
  if (step === null) {
    // After done (or on an empty recipe) inputs are inert: incorrect, but no mistake charged.
    return { state: clone(state), correct: false, events: [] };
  }

  if (step.type === 'gather') {
    if (input.kind !== 'ingredient') return wrong(state);
    if (!step.ingredients.includes(input.id) || state.gathered.includes(input.id)) return wrong(state);
    const next = clone(state);
    next.gathered.push(input.id);
    const events: CookEvent[] = [{ type: 'gathered', id: input.id }];
    if (next.gathered.length === step.ingredients.length) completeStep(next, events);
    return { state: next, correct: true, events };
  }

  if (step.type === 'sequence') {
    if (input.kind !== 'action' || input.id !== step.actions[state.seqDone]) return wrong(state);
    const next = clone(state);
    next.seqDone += 1;
    const events: CookEvent[] = [{ type: 'acted', id: input.id }];
    if (next.seqDone === step.actions.length) completeStep(next, events);
    return { state: next, correct: true, events };
  }

  if (input.kind !== 'ingredient' || input.id !== step.layers[state.seqDone]) return wrong(state);
  const next = clone(state);
  next.seqDone += 1;
  const events: CookEvent[] = [{ type: 'layered', id: input.id }];
  if (next.seqDone === step.layers.length) completeStep(next, events);
  return { state: next, correct: true, events };
}
