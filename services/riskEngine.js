import { supabase } from './supabase';

const THRESHOLDS = [
  { max: 9, level: 'low', color: '#27AE60' },
  { max: 19, level: 'moderate', color: '#F39C12' },
  { max: 100, level: 'high', color: '#C0392B' },
];

const clampScore = (value) => Math.min(100, Math.max(0, value));

/**
 * Score a single day's log snapshot
 */
const scoreSnapshot = (log, profile = {}) => {
  let score = 0;

  // ── SYMPTOMS ──────────────────────────────────────────────

  // Fatigue: 1-10 scale
  const fatigue = log?.fatigue ?? 0;
  if (fatigue >= 8) score += 8;
  else if (fatigue >= 6) score += 5;
  else if (fatigue >= 4) score += 2;

  // Energy low (under 4 = +3)
  const energy = log?.energy ?? 10;
  if (energy < 4) score += 3;

  // Mood low (under 4 = +2)
  const mood = log?.lifestyle?.mood ?? log?.mood ?? 5;
  if (mood < 4) score += 2;

  // Dizziness: boolean symptom
  if (log?.symptoms?.dizziness) score += 3;

  // Headache: boolean symptom
  if (log?.symptoms?.headache) score += 2;

  // Shortness of breath: strong anemia indicator
  if (log?.symptoms?.shortnessOfBreath) score += 4;

  // Heart palpitations: strong anemia indicator
  if (log?.symptoms?.heartPalpitations) score += 4;

  // Cold hands/feet: moderate anemia indicator
  if (log?.symptoms?.coldHandsFeet) score += 2;

  // Pale appearance: strong anemia indicator
  if (log?.symptoms?.paleAppearance) score += 4;

  // ── LIFESTYLE ─────────────────────────────────────────────

  // Sleep under 6 hours (+2)
  const sleepHours = log?.sleep_hours ?? log?.lifestyle?.sleep ?? 8;
  if (sleepHours < 6) score += 2;

  // Water under 4 glasses (+1)
  const water = log?.lifestyle?.water ?? 8;
  if (water < 4) score += 1;

  // Stress level
  const stress = log?.lifestyle?.stress ?? 'low';
  if (stress === 'high') score += 2;
  else if (stress === 'medium') score += 1;

  // Activity level — sedentary lifestyle worsens anemia
  const activity = log?.lifestyle?.activity ?? 'light';
  if (activity === 'none') score += 2;

  // ── DIET ──────────────────────────────────────────────────

  const foods = log?.foods || {};
  const ironRich = foods.ironRich || [];
  const ironBlocking = foods.ironBlocking || [];
  const vitaminC = foods.vitaminC || [];
  const staples = foods.staples || [];
  const dairy = foods.dairy || [];
  const junk = foods.junk || [];

  // No iron-rich foods at all: +4
  if (ironRich.length === 0) score += 4;
  // Some iron-rich but less than 2: +2
  else if (ironRich.length < 2) score += 2;

  // Iron blockers present: +2 each blocker up to +4
  score += Math.min(4, ironBlocking.length * 2);

  // No vitamin C at all: +2
  if (vitaminC.length === 0) score += 2;

  // Heavy staples (phytic acid) — more than 2 items: +1
  if (staples.length > 2) score += 1;

  // Dairy items — if 2+ dairy AND no vitamin C: mild penalty
  if (dairy.length >= 2 && vitaminC.length === 0) score += 1;

  // Junk food — 2+ junk items: +2, 4+ items: +4
  if (junk.length >= 4) score += 4;
  else if (junk.length >= 2) score += 2;

  // No proper meal logged
  if (junk.includes('noProperMeal')) score += 3;

  // ── PROFILE MULTIPLIERS ───────────────────────────────────

  const conditions = profile?.medicalConditions || [];

  // Tier 1 — directly causes or worsens anemia (+4 each)
  if (conditions.includes('ironDeficiency')) score += 4;
  if (conditions.includes('thalassemia')) score += 4;
  if (conditions.includes('b12Deficiency')) score += 4;
  if (conditions.includes('folateDeficiency')) score += 4;
  if (conditions.includes('menorrhagia')) score += 4;
  if (conditions.includes('sickleCellTrait')) score += 3;

  // Tier 2 — commonly associated (+2 each)
  if (conditions.includes('diabetes')) score += 2;
  if (conditions.includes('thyroid')) score += 2;
  if (conditions.includes('kidneyDisease')) score += 3;
  if (conditions.includes('celiacDisease')) score += 3;
  if (conditions.includes('ibd')) score += 3;

  // Tier 3 — less direct but relevant (+1 each)
  if (conditions.includes('lupus')) score += 1;
  if (conditions.includes('rheumatoidArthritis')) score += 1;
  if (conditions.includes('cancer')) score += 2;
  if (conditions.includes('heartDisease')) score += 1;
  if (conditions.includes('liverDisease')) score += 2;
  if (conditions.includes('malaria')) score += 2;
  if (conditions.includes('bonemarrowDisorder')) score += 3;

  // Coffee/tea frequency as iron blocker
  const coffeeTea = profile?.coffee_tea_frequency;
  if (coffeeTea === 'multiple_daily') score += 3;
  else if (coffeeTea === 'daily') score += 1;

  // Vegetarian/vegan with no iron-rich foods
  const diet = profile?.dietaryPreference || profile?.diet_type;
  if (
    (diet === 'Vegetarian' || diet === 'Vegan' || diet === 'vegetarian') &&
    ironRich.length === 0
  ) score += 2;

  // Low exercise + sedentary
  if (
    profile?.exercise_frequency === 'never' &&
    activity === 'none'
  ) score += 1;

  // Age-based risk — older women (45+) higher anemia risk
  const age = profile?.age ?? 0;
  if (age >= 45) score += 2;
  else if (age >= 35) score += 1;

  return clampScore(score);
};

/**
 * Resolve score to risk level
 */
const resolveRisk = (score) => {
  const threshold = THRESHOLDS.find((t) => score <= t.max) || THRESHOLDS[2];
  return {
    score: Math.round(score),
    level: threshold.level,
    color: threshold.color,
  };
};

/**
 * Calculate risk for a single day log
 */
export const calculateRisk = (log, profile = {}) => {
  const score = scoreSnapshot(log, profile);
  return resolveRisk(score);
};

/**
 * Calculate weekly risk from 7 days of logs
 */
export const calculateWeeklyRisk = (logs = [], profile = {}) => {
  const validLogs = logs.filter(Boolean);
  const daysLogged = validLogs.length;

  if (daysLogged < 7) {
    return {
      ...resolveRisk(0),
      daysLogged,
      insufficient_data: true,
    };
  }

  let avgFatigue = 0;
  let avgEnergy = 0;
  let avgMood = 0;
  let avgSleep = 0;
  let avgWater = 0;
  let dizzinessCount = 0;
  let headacheCount = 0;
  let shortnessCount = 0;
  let palpitationsCount = 0;
  let coldHandsCount = 0;
  let paleCount = 0;
  let ironRichCount = 0;
  let ironBlockingCount = 0;
  let vitaminCCount = 0;
  let staplesCount = 0;
  let dairyCount = 0;
  let junkCount = 0;
  let highStressCount = 0;
  let noMealCount = 0;

  validLogs.forEach((log) => {
    avgFatigue += log?.fatigue ?? 0;
    avgEnergy += log?.energy ?? 10;
    avgMood += log?.lifestyle?.mood ?? log?.mood ?? 5;
    avgSleep += log?.sleep_hours ?? log?.lifestyle?.sleep ?? 8;
    avgWater += log?.lifestyle?.water ?? 8;

    if (log?.symptoms?.dizziness) dizzinessCount++;
    if (log?.symptoms?.headache) headacheCount++;
    if (log?.symptoms?.shortnessOfBreath) shortnessCount++;
    if (log?.symptoms?.heartPalpitations) palpitationsCount++;
    if (log?.symptoms?.coldHandsFeet) coldHandsCount++;
    if (log?.symptoms?.paleAppearance) paleCount++;

    const foods = log?.foods || {};
    if ((foods.ironRich || []).length > 0) ironRichCount++;
    if ((foods.ironBlocking || []).length > 0) ironBlockingCount++;
    if ((foods.vitaminC || []).length > 0) vitaminCCount++;
    if ((foods.staples || []).length > 2) staplesCount++;
    if ((foods.dairy || []).length >= 2) dairyCount++;
    if ((foods.junk || []).length >= 2) junkCount++;
    if ((foods.junk || []).includes('noProperMeal')) noMealCount++;
    if ((log?.lifestyle?.stress) === 'high') highStressCount++;
  });

  avgFatigue /= daysLogged;
  avgEnergy /= daysLogged;
  avgMood /= daysLogged;
  avgSleep /= daysLogged;
  avgWater /= daysLogged;

  const half = daysLogged / 2;

  const weeklyLog = {
    fatigue: avgFatigue,
    energy: avgEnergy,
    lifestyle: {
      mood: avgMood,
      sleep: avgSleep,
      water: avgWater,
      stress: highStressCount > half ? 'high' : 'low',
      activity: 'light',
    },
    symptoms: {
      dizziness: dizzinessCount > half,
      headache: headacheCount > half,
      shortnessOfBreath: shortnessCount > half,
      heartPalpitations: palpitationsCount > half,
      coldHandsFeet: coldHandsCount > half,
      paleAppearance: paleCount > half,
    },
    foods: {
      ironRich: ironRichCount > half ? ['present'] : [],
      ironBlocking: ironBlockingCount > half ? ['present'] : [],
      vitaminC: vitaminCCount > half ? ['present'] : [],
      staples: staplesCount > half ? ['present', 'present', 'present'] : [],
      dairy: dairyCount > half ? ['present', 'present'] : [],
      junk: junkCount > half
        ? (noMealCount > half ? ['present', 'present', 'noProperMeal'] : ['present', 'present'])
        : [],
    },
  };

  const score = scoreSnapshot(weeklyLog, profile);
  return { ...resolveRisk(score), daysLogged };
};

/**
 * Insert risk report into Supabase
 */
export const saveWeeklyRiskReport = async (userId, logs = [], profile = {}) => {
  if (!userId || logs.length < 7) return null;

  const risk = calculateWeeklyRisk(logs, profile);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  try {
    const { error } = await supabase
      .from('risk_reports')
      .insert({
        user_id: userId,
        week_start: formatDate(weekStart),
        week_end: formatDate(today),
        score: risk.score,
        level: risk.level,
        contributing_factors: extractContributingFactors(logs, profile),
      });

    if (error) throw error;
    return risk;
  } catch (err) {
    console.error('Error saving risk report:', err);
    return risk;
  }
};

/**
 * Extract contributing factors from logs
 */
const extractContributingFactors = (logs = [], profile = {}) => {
  const factors = [];
  const conditions = profile?.medicalConditions || [];

  // Medical conditions
  if (conditions.includes('ironDeficiency')) factors.push('iron_deficiency_diagnosed');
  if (conditions.includes('thalassemia')) factors.push('thalassemia');
  if (conditions.includes('menorrhagia')) factors.push('menorrhagia');
  if (conditions.includes('b12Deficiency')) factors.push('b12_deficiency');
  if (conditions.includes('folateDeficiency')) factors.push('folate_deficiency');
  if (conditions.includes('diabetes')) factors.push('diabetes');
  if (conditions.includes('thyroid')) factors.push('thyroid_disorder');
  if (conditions.includes('kidneyDisease')) factors.push('kidney_disease');
  if (profile?.coffee_tea_frequency === 'multiple_daily') factors.push('high_caffeine');

  // Dietary patterns
  const noIronRich = logs.filter((l) => !(l?.foods?.ironRich?.length));
  if (noIronRich.length > 3) factors.push('insufficient_iron_foods');

  const hasBlockers = logs.filter((l) => l?.foods?.ironBlocking?.length);
  if (hasBlockers.length > 3) factors.push('iron_blockers_present');

  const hasJunk = logs.filter((l) => (l?.foods?.junk?.length ?? 0) >= 2);
  if (hasJunk.length > 3) factors.push('poor_diet_quality');

  const noVitC = logs.filter((l) => !(l?.foods?.vitaminC?.length));
  if (noVitC.length > 3) factors.push('low_vitamin_c');

  // Symptom patterns
  const highFatigue = logs.filter((l) => (l?.fatigue ?? 0) >= 6);
  if (highFatigue.length > 3) factors.push('elevated_fatigue');

  const lowSleep = logs.filter((l) => (l?.sleep_hours ?? l?.lifestyle?.sleep ?? 8) < 6);
  if (lowSleep.length > 3) factors.push('insufficient_sleep');

  const shortness = logs.filter((l) => l?.symptoms?.shortnessOfBreath);
  if (shortness.length > 2) factors.push('shortness_of_breath');

  const pale = logs.filter((l) => l?.symptoms?.paleAppearance);
  if (pale.length > 2) factors.push('pale_appearance');

  return factors;
};