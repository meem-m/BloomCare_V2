export const myths = [
  {
    id: 1,
    myth: 'Eating spinach alone can cure anemia',
    verdict: 'BUSTED',
    explanation:
      'Palak and saag are good iron sources, but spinach also has oxalates that reduce absorption. Pair with daal, lemon, or amla, and get proper medical tests. Desi mothers often push "sirf palak khao" but that alone is not enough.',
    emoji: '🥬',
  },
  {
    id: 2,
    myth: 'Only poor or malnourished women get anemia',
    verdict: 'BUSTED',
    explanation:
      'Anemia affects women across all income levels in Pakistan, from university students to working professionals. Diet gaps, poor absorption, and chronic stress do not check your bank balance.',
    emoji: '💰',
  },
  {
    id: 3,
    myth: 'Chai after meals helps digestion and is harmless',
    verdict: 'BUSTED',
    explanation:
      'That post-roti doodh patti is a cultural ritual, but tannins in chai block iron absorption when taken with meals. Wait 1–2 hours after iron-rich food before your cup.',
    emoji: '🍵',
  },
  {
    id: 4,
    myth: 'You can always tell if someone is anemic by looking at them',
    verdict: 'BUSTED',
    explanation:
      'Pale nails and tired eyes are not always visible, especially on darker skin tones common in South Asia. Only blood tests (Hb, ferritin) give a real answer.',
    emoji: '👀',
  },
  {
    id: 5,
    myth: "Anemia only happens to women who don't eat meat",
    verdict: 'BUSTED',
    explanation:
      'Many non-vegetarian Pakistani women still have anemia due to poor iron absorption, certain medical conditions, or diet imbalances, not just lack of gosht.',
    emoji: '🥩',
  },
  {
    id: 6,
    myth: 'Taking iron supplements is always enough',
    verdict: 'PARTIALLY TRUE',
    explanation:
      'Supplements help when prescribed, but side effects like constipation are common. Diet, vitamin C pairing, and follow-up tests matter just as much.',
    emoji: '💊',
  },
  {
    id: 7,
    myth: 'Dark-skinned women cannot show pallor signs',
    verdict: 'BUSTED',
    explanation:
      'Pallor is harder to spot on brown skin. Look at inner eyelids, nail beds, and gums instead. "She looks fine" is not a medical check.',
    emoji: '🤎',
  },
  {
    id: 8,
    myth: 'Anemia means you just need more rest',
    verdict: 'BUSTED',
    explanation:
      'Extra sona will not fix low hemoglobin. Chronic tiredness after 8 hours sleep often signals iron deficiency, not laziness.',
    emoji: '😴',
  },
  {
    id: 9,
    myth: 'Desi ghee and red meat guarantee good blood',
    verdict: 'PARTIALLY TRUE',
    explanation:
      'Gosht and ghee provide iron, but excess ghee without balance, plus chai with meals, can still leave you deficient. Moderation and pairing matter.',
    emoji: '🫕',
  },
  {
    id: 10,
    myth: "Young girls don't need to worry about anemia",
    verdict: 'BUSTED',
    explanation:
      'Teen girls in Pakistan often skip iron-rich foods and may not recognize early symptoms. School-going girls frequently have undetected low iron that affects concentration and performance.',
    emoji: '👧',
  },
  {
    id: 11,
    myth: 'Drinking more water prevents anemia',
    verdict: 'PARTIALLY TRUE',
    explanation:
      'Hydration supports overall health but does not replace iron. Water helps circulation; it does not build red blood cells.',
    emoji: '💧',
  },
  {
    id: 12,
    myth: 'Iron-rich foods can be eaten with anything',
    verdict: 'BUSTED',
    explanation:
      'Doodh with daal, chai with saag, and coffee after breakfast all reduce iron uptake. Timing and pairing are key in our daily meals.',
    emoji: '🍽️',
  },
  {
    id: 13,
    myth: 'Anemia is not serious if you feel only slightly tired',
    verdict: 'BUSTED',
    explanation:
      'Mild fatigue can worsen silently. Many women normalize "thakan" until dizziness or breathlessness appears. Early tracking helps.',
    emoji: '⚠️',
  },
  {
    id: 14,
    myth: 'Pomegranate (anar) cures anemia quickly',
    verdict: 'PARTIALLY TRUE',
    explanation:
      'Anar is nutritious and loved in Ramzan and weddings, but it is not a magic cure. It supports diet, not a replacement for medical treatment.',
    emoji: '🍎',
  },
  {
    id: 15,
    myth: 'Only doctors can detect anemia. Home tracking is useless',
    verdict: 'BUSTED',
    explanation:
      'Apps cannot diagnose, but daily symptom and diet logs help you spot patterns before your next doctor visit, especially when lab tests are hard to access.',
    emoji: '📱',
  },
];

export const getMythOfTheDay = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return myths[dayOfYear % myths.length];
};
