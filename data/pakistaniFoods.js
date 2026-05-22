export const ironRichFoods = [
  { id: 'daal', label: 'Daal (lentils)', emoji: '🫘', category: 'ironRich' },
  { id: 'saag', label: 'Saag (spinach/mustard greens)', emoji: '🥬', category: 'ironRich' },
  { id: 'palak', label: 'Palak (spinach curry)', emoji: '🍃', category: 'ironRich' },
  { id: 'methi', label: 'Methi (fenugreek leaves)', emoji: '🌿', category: 'ironRich' },
  { id: 'bhindi', label: 'Bhindi (okra)', emoji: '🫑', category: 'ironRich' },
  { id: 'karela', label: 'Karela (bitter gourd)', emoji: '🥒', category: 'ironRich' },
  { id: 'besan', label: 'Besan (chickpea flour dishes)', emoji: '🟡', category: 'ironRich' },
  { id: 'redMeat', label: 'Red meat (beef/mutton)', emoji: '🥩', category: 'ironRich' },
  { id: 'kaleji', label: 'Kaleji (liver)', emoji: '🫀', category: 'ironRich' },
  { id: 'chicken', label: 'Chicken', emoji: '🍗', category: 'ironRich' },
  { id: 'fish', label: 'Fish', emoji: '🐟', category: 'ironRich' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚', category: 'ironRich' },
  { id: 'chanay', label: 'Chanay (chickpeas)', emoji: '🫘', category: 'ironRich' },
  { id: 'kidneyBeans', label: 'Kidney beans (rajma)', emoji: '🫘', category: 'ironRich' },
  { id: 'fortifiedAtta', label: 'Fortified atta/roti', emoji: '🫓', category: 'ironRich' },
  { id: 'driedFruits', label: 'Dried fruits (raisins/dates)', emoji: '🍇', category: 'ironRich' },
  { id: 'nihariQorma', label: 'Nihari/qorma (meat-based)', emoji: '🍲', category: 'ironRich' },
  { id: 'banana', label: 'Banana', emoji: '🍌', category: 'ironRich' },
  { id: 'pomegranate', label: 'Pomegranate (anar)', emoji: '🔴', category: 'ironRich' },
];

export const vitaminCFoods = [
  { id: 'lemon', label: 'Lemon', emoji: '🍋', category: 'vitaminC' },
  { id: 'tomatoes', label: 'Tomatoes', emoji: '🍅', category: 'vitaminC' },
  { id: 'orange', label: 'Orange/citrus', emoji: '🍊', category: 'vitaminC' },
  { id: 'amrood', label: 'Amrood (guava)', emoji: '🍈', category: 'vitaminC' },
  { id: 'shimlaM', label: 'Shimla mirch (bell pepper)', emoji: '🫑', category: 'vitaminC' },
  { id: 'strawberry', label: 'Strawberry', emoji: '🍓', category: 'vitaminC' },
  { id: 'rawOnion', label: 'Raw onion (with meal)', emoji: '🧅', category: 'vitaminC' },
  { id: 'mango', label: 'Mango (aam)', emoji: '🥭', category: 'vitaminC' },
  { id: 'watermelon', label: 'Watermelon (tarbuz)', emoji: '🍉', category: 'vitaminC' },
  { id: 'aloo', label: 'Aloo (potato)', emoji: '🥔', category: 'vitaminC' },
  { id: 'cabbage', label: 'Cabbage (band gobi)', emoji: '🥬', category: 'vitaminC' },
  { id: 'salad', label: 'Salad/mixed vegetables', emoji: '🥗', category: 'vitaminC' },
];

export const ironBlockingFoods = [
  { id: 'chaiWithMeal', label: 'Chai/tea (with or after meal)', emoji: '🍵', category: 'ironBlocking' },
  { id: 'coffee', label: 'Coffee', emoji: '☕', category: 'ironBlocking' },
  { id: 'coldDrinks', label: 'Cold drinks/soda', emoji: '🥤', category: 'ironBlocking' },
];

export const staplesFoods = [
  { id: 'plainRoti', label: 'Plain roti', emoji: '🫓', category: 'staples' },
  { id: 'paratha', label: 'Paratha', emoji: '🥞', category: 'staples' },
  { id: 'rice', label: 'Rice/biryani', emoji: '🍚', category: 'staples' },
  { id: 'naan', label: 'Naan/maida bread', emoji: '🍞', category: 'staples' },
];

export const dairyFoods = [
  { id: 'milk', label: 'Milk (doodh)', emoji: '🥛', category: 'dairy' },
  { id: 'dahi', label: 'Dahi (yogurt)', emoji: '🍶', category: 'dairy' },
  { id: 'lassi', label: 'Lassi', emoji: '🥛', category: 'dairy' },
  { id: 'packagedJuice', label: 'Packaged juice', emoji: '🧃', category: 'dairy' },
  { id: 'energyDrink', label: 'Energy drinks', emoji: '🔋', category: 'dairy' },
];

export const junkFoods = [
  { id: 'samosaPakora', label: 'Samosa/pakora (fried)', emoji: '🥟', category: 'junk' },
  { id: 'fastFood', label: 'Fast food (burger/pizza)', emoji: '🍔', category: 'junk' },
  { id: 'chips', label: 'Chips/crisps', emoji: '🍟', category: 'junk' },
  { id: 'mithai', label: 'Mithai/sweets', emoji: '🍬', category: 'junk' },
  { id: 'biscuits', label: 'Biscuits/cookies', emoji: '🍪', category: 'junk' },
  { id: 'noProperMeal', label: 'No proper meal today', emoji: '❌', category: 'junk' },
];

export const allFoodCategories = [
  {
    title: 'Iron-Rich Foods 💪',
    subtitle: 'Eat these to boost your iron levels',
    categoryKey: 'ironRich',
    foods: ironRichFoods,
  },
  {
    title: 'Vitamin C Boosters ✅',
    subtitle: 'Helps your body absorb iron better',
    categoryKey: 'vitaminC',
    foods: vitaminCFoods,
  },
  {
    title: 'Iron Blockers ⚠️',
    subtitle: 'These reduce iron absorption',
    categoryKey: 'ironBlocking',
    foods: ironBlockingFoods,
  },
  {
    title: 'Staples & Grains 🌾',
    subtitle: 'Common daily staples',
    categoryKey: 'staples',
    foods: staplesFoods,
  },
  {
    title: 'Dairy & Drinks 🥛',
    subtitle: 'Best consumed separately from iron-rich meals',
    categoryKey: 'dairy',
    foods: dairyFoods,
  },
  {
    title: 'Fried & Junk Foods ❌',
    subtitle: 'Low nutritional value — limit where possible',
    categoryKey: 'junk',
    foods: junkFoods,
  },
];