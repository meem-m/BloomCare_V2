export const ironRichFoods = [
  { id: 'daal', label: 'Daal (lentils)', emoji: '🫘', category: 'ironRich' },
  { id: 'saag', label: 'Saag (spinach/mustard greens)', emoji: '🥬', category: 'ironRich' },
  { id: 'redMeat', label: 'Red meat (beef/mutton)', emoji: '🥩', category: 'ironRich' },
  { id: 'chicken', label: 'Chicken', emoji: '🍗', category: 'ironRich' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚', category: 'ironRich' },
  { id: 'fortifiedAtta', label: 'Fortified atta/roti', emoji: '🫓', category: 'ironRich' },
];

export const ironBlockingFoods = [
  { id: 'chaiWithMeal', label: 'Chai with meal', emoji: '🍵', category: 'ironBlocking' },
  { id: 'coffee', label: 'Coffee', emoji: '☕', category: 'ironBlocking' },
  { id: 'dairyWithIron', label: 'Dairy with iron-rich food', emoji: '🥛', category: 'ironBlocking' },
];

export const vitaminCFoods = [
  { id: 'lemon', label: 'Lemon/nimbu', emoji: '🍋', category: 'vitaminC' },
  { id: 'tomatoes', label: 'Tomatoes', emoji: '🍅', category: 'vitaminC' },
  { id: 'amla', label: 'Amla', emoji: '🟠', category: 'vitaminC' },
  { id: 'citrus', label: 'Orange/citrus', emoji: '🍊', category: 'vitaminC' },
];

export const otherFoods = [
  { id: 'rice', label: 'Rice', emoji: '🍚', category: 'other' },
  { id: 'plainRoti', label: 'Plain roti', emoji: '🫓', category: 'other' },
  { id: 'fastFood', label: 'Fast food', emoji: '🍔', category: 'other' },
  { id: 'noProperMeal', label: 'No proper meal today', emoji: '❌', category: 'other' },
];

export const allFoodCategories = [
  { title: 'Iron-Rich Foods 💪', foods: ironRichFoods },
  { title: 'Iron-Blocking Foods ⚠️', foods: ironBlockingFoods },
  { title: 'Vitamin C Boosters ✅', foods: vitaminCFoods },
  { title: 'Other', foods: otherFoods },
];
