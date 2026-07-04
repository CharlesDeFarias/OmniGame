import type { ActionId, IngredientId, Recipe } from './types';

/** Runtime mirror of the IngredientId union, for validation and pantry/distractor pools. */
export const ALL_INGREDIENTS: readonly IngredientId[] = [
  'bread',
  'butter',
  'banana',
  'apple',
  'strawberry',
  'orange',
  'yogurt',
  'egg',
  'milk',
  'cheese',
  'ham',
  'lettuce',
  'tomato',
  'pasta',
  'sauce',
  'tortilla',
  'flour',
  'sugar',
  'carrot',
  'potato',
  'onion',
  'dough',
  'oil',
  'salt',
];

/** Runtime mirror of the ActionId union. */
export const ALL_ACTIONS: readonly ActionId[] = ['chop', 'stir', 'pour', 'flip', 'spread', 'blend', 'cook'];

/**
 * Ten everyday recipes in fixed unlock order, escalating in length (decision #48).
 * Order of actions is real-world realistic — educational per spec (e.g. toast the
 * bread BEFORE spreading the butter; mix pancake batter before it hits the pan).
 */
export const RECIPES: readonly Recipe[] = [
  {
    id: 'toast',
    icon: 'bread',
    steps: [
      { type: 'gather', ingredients: ['bread', 'butter'] },
      { type: 'sequence', actions: ['cook', 'spread'] },
    ],
  },
  {
    id: 'fruit-salad',
    icon: 'apple',
    steps: [
      { type: 'gather', ingredients: ['banana', 'apple', 'strawberry', 'orange'] },
      { type: 'sequence', actions: ['chop', 'stir'] },
    ],
  },
  {
    id: 'sandwich',
    icon: 'cheese',
    steps: [
      { type: 'gather', ingredients: ['bread', 'cheese', 'ham', 'lettuce', 'tomato'] },
      { type: 'assemble', layers: ['bread', 'ham', 'cheese', 'lettuce', 'tomato', 'bread'] },
    ],
  },
  {
    id: 'scrambled-eggs',
    icon: 'egg',
    steps: [
      { type: 'gather', ingredients: ['egg', 'milk', 'butter', 'salt'] },
      { type: 'sequence', actions: ['stir', 'pour', 'cook'] },
    ],
  },
  {
    id: 'smoothie',
    icon: 'strawberry',
    steps: [
      { type: 'gather', ingredients: ['banana', 'strawberry', 'yogurt', 'milk'] },
      { type: 'sequence', actions: ['chop', 'pour', 'blend'] },
    ],
  },
  {
    id: 'pancakes',
    icon: 'flour',
    steps: [
      { type: 'gather', ingredients: ['flour', 'egg', 'milk', 'sugar', 'butter'] },
      { type: 'sequence', actions: ['pour', 'stir', 'cook', 'flip'] },
    ],
  },
  {
    id: 'pasta-sauce',
    icon: 'pasta',
    steps: [
      { type: 'gather', ingredients: ['pasta', 'sauce', 'salt', 'oil'] },
      { type: 'sequence', actions: ['cook', 'pour', 'stir'] },
    ],
  },
  {
    id: 'quesadilla',
    icon: 'tortilla',
    steps: [
      { type: 'gather', ingredients: ['tortilla', 'cheese', 'tomato', 'onion'] },
      { type: 'sequence', actions: ['chop', 'cook', 'flip'] },
      { type: 'assemble', layers: ['tortilla', 'cheese', 'tomato', 'tortilla'] },
    ],
  },
  {
    id: 'veggie-soup',
    icon: 'carrot',
    steps: [
      { type: 'gather', ingredients: ['carrot', 'potato', 'onion', 'salt', 'oil'] },
      { type: 'sequence', actions: ['chop', 'pour', 'cook', 'stir'] },
    ],
  },
  {
    id: 'mini-pizza',
    icon: 'dough',
    steps: [
      { type: 'gather', ingredients: ['dough', 'sauce', 'cheese', 'tomato'] },
      { type: 'sequence', actions: ['spread', 'chop'] },
      { type: 'assemble', layers: ['dough', 'sauce', 'cheese', 'tomato'] },
      { type: 'sequence', actions: ['cook'] },
    ],
  },
];
