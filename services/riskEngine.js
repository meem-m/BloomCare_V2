import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// THRESHOLDS — calibrated from Random Forest training
// Low: 0-15 | Moderate: 16-30 | High: 31+
// Model achieved 78.8% accuracy (5-fold CV) on synthetic dataset
// ─────────────────────────────────────────────────────────────
const THRESHOLDS = [
  { max: 15,  level: 'low',      color: '#27AE60' },
  { max: 30,  level: 'moderate', color: '#F39C12' },
  { max: 100, level: 'high',     color: '#C0392B' },
];

const clampScore = (value) => Math.min(100, Math.max(0, value));

// ─────────────────────────────────────────────────────────────
// SCORE SNAPSHOT
// Weights derived from Random Forest feature importances
// Top factors: fatigue (15.3%), symptom severity (12.7%),
// diet quality (6.2%), iron absorption (4.9%)
// ─────────────────────────────────────────────────────────────
const scoreSnapshot = (log, profile = {}) => {
  let score = 0;

  // ── FATIGUE (15.32% importance — highest single feature) ──
  const fatigue = log?.fatigue ?? 0;
  if      (fatigue >= 9) score += 10;
  else if (fatigue >= 7) score += 7;
  else if (fatigue >= 5) score += 4;
  else if (fatigue >= 3) score += 1;

  // ── ENERGY (2.76% importance) ──
  const energy = log?.energy ?? 10;
  if      (energy <= 2) score += 4;
  else if (energy <= 4) score += 2;
  else if (energy <= 6) score += 1;

  // ── MOOD (1.75% importance) ──
  const mood = log?.lifestyle?.mood ?? log?.mood ?? 5;
  if (mood <= 2) score += 3;
  else if (mood <= 3) score += 1;

  // ── SYMPTOMS (combined 12.70% importance) ──
  // Shortness of breath: 3.35% — strongest individual symptom
  if (log?.symptoms?.shortnessOfBreath)  score += 5;
  // Heart palpitations: 2.17%
  if (log?.symptoms?.heartPalpitations)  score += 4;
  // Pale appearance: 2.03%
  if (log?.symptoms?.paleAppearance)     score += 4;
  // Dizziness: 2.38%
  if (log?.symptoms?.dizziness)          score += 3;
  // Cold hands/feet: 1.06%
  if (log?.symptoms?.coldHandsFeet)      score += 2;
  // Headache: 1.43%
  if (log?.symptoms?.headache)           score += 2;

  // ── LIFESTYLE ──
  // Sleep: 2.91% importance
  const sleepHours = log?.sleep_hours ?? log?.lifestyle?.sleep ?? 8;
  if      (sleepHours < 5) score += 4;
  else if (sleepHours < 6) score += 2;
  else if (sleepHours < 7) score += 1;

  // Water: 2.06% importance
  const water = log?.lifestyle?.water ?? 8;
  if      (water < 3) score += 2;
  else if (water < 5) score += 1;

  // Activity level: 1.62% importance
  const activity = log?.lifestyle?.activity ?? 'light';
  if      (activity === 'none')  score += 3;
  else if (activity === 'light') score += 1;

  // Stress: 0.89% importance — less than expected
  const stress = log?.lifestyle?.stress ?? 'low';
  if      (stress === 'high')   score += 2;
  else if (stress === 'medium') score += 1;

  // ── DIET (combined ~11% importance) ──
  const foods = log?.foods || {};
  const ironRich      = foods.ironRich      || [];
  const ironBlocking  = foods.ironBlocking  || [];
  const vitaminC      = foods.vitaminC      || [];
  const staples       = foods.staples       || [];
  const dairy         = foods.dairy         || [];
  const junk          = foods.junk          || [];

  // Iron rich: 2.14% — model says less critical than diet quality overall
  if      (ironRich.length === 0) score += 4;
  else if (ironRich.length === 1) score += 2;

  // Iron blockers: 2.36%
  score += Math.min(4, ironBlocking.length * 2);

  // Vitamin C: 1.98% — aids absorption
  if (vitaminC.length === 0) score += 2;

  // Junk food: 2.68% — model rates this higher than expected
  if      (junk.length >= 5) score += 5;
  else if (junk.length >= 3) score += 3;
  else if (junk.length >= 2) score += 1;

  // No proper meal
  if (junk.includes('noProperMeal')) score += 3;

  // Staples: 1.22% — mild effect
  if (staples.length > 3) score += 1;

  // Dairy: 1.26% — mild blocker if high and no vitamin C
  if (dairy.length >= 3 && vitaminC.length === 0) score += 1;

  // ── PROFILE — AGE & BMI (combined ~6% importance) ──
  const age = profile?.age ?? 0;
  if      (age >= 50) score += 4;
  else if (age >= 45) score += 3;
  else if (age >= 35) score += 1;

  const bmi = profile?.bmi ??
    (profile?.weight && profile?.height
      ? parseFloat((profile.weight / ((profile.height / 100) ** 2)).toFixed(1))
      : null);

  if (bmi !== null) {
    if      (bmi < 17)   score += 5;
    else if (bmi < 18.5) score += 3;
    else if (bmi >= 35)  score += 3;
    else if (bmi >= 30)  score += 2;
    else if (bmi >= 25)  score += 1;
  }

  // ── COFFEE/TEA: 1.34% importance ──
  const coffeeTea = profile?.coffee_tea_frequency;
  if      (coffeeTea === 'multiple_daily') score += 3;
  else if (coffeeTea === 'daily')          score += 1;

  // ── EXERCISE: 1.21% importance ──
  const exerciseFreq = profile?.exercise_frequency;
  if (exerciseFreq === 'never' && activity === 'none') score += 2;
  else if (exerciseFreq === 'never')                   score += 1;

  // ── DIET TYPE: 0.68% importance ──
  const diet = profile?.dietaryPreference || profile?.diet_type;
  if (
    (diet === 'Vegetarian' || diet === 'Vegan') &&
    ironRich.length === 0
  ) score += 2;

  // ── MEDICAL CONDITIONS ──
  // Model shows these matter less than symptoms/diet individually
  // but are still meaningful — kept but weights reduced
  const conditions = profile?.medicalConditions || [];

  // Tier 1 — directly causes anemia (1.39% top condition)
  if (conditions.includes('ironDeficiency'))   score += 3;
  if (conditions.includes('thalassemia'))      score += 3;
  if (conditions.includes('b12Deficiency'))    score += 3;
  if (conditions.includes('folateDeficiency')) score += 3;
  if (conditions.includes('menorrhagia'))      score += 3;
  if (conditions.includes('sickleCellTrait'))  score += 2;

  // Tier 2 — commonly associated
  if (conditions.includes('diabetes'))         score += 2;
  if (conditions.includes('thyroid'))          score += 2;
  if (conditions.includes('kidneyDisease'))    score += 2;
  if (conditions.includes('celiacDisease'))    score += 2;
  if (conditions.includes('ibd'))              score += 2;

  // Tier 3 — less direct
  if (conditions.includes('cancer'))           score += 2;
  if (conditions.includes('liverDisease'))     score += 1;
  if (conditions.includes('malaria'))          score += 1;
  if (conditions.includes('bonemarrowDisorder')) score += 2;
  if (conditions.includes('lupus'))            score += 1;
  if (conditions.includes('rheumatoidArthritis')) score += 1;
  if (conditions.includes('heartDisease'))     score += 1;

  return clampScore(score);
};

// ─────────────────────────────────────────────────────────────
// RESOLVE SCORE TO RISK LEVEL
// ─────────────────────────────────────────────────────────────
const resolveRisk = (score) => {
  const threshold = THRESHOLDS.find((t) => score <= t.max) || THRESHOLDS[2];
  return {
    score: Math.round(score),
    level: threshold.level,
    color: threshold.color,
  };
};

// ─────────────────────────────────────────────────────────────
// CALCULATE DAILY RISK
// ─────────────────────────────────────────────────────────────
export const calculateRisk = (log, profile = {}) => {
  const score = scoreSnapshot(log, profile);
  return resolveRisk(score);
};

// ─────────────────────────────────────────────────────────────
// CALCULATE WEEKLY RISK
// ─────────────────────────────────────────────────────────────
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

  let avgFatigue = 0, avgEnergy = 0, avgMood = 0;
  let avgSleep = 0, avgWater = 0;
  let dizzinessCount = 0, headacheCount = 0;
  let shortnessCount = 0, palpitationsCount = 0;
  let coldHandsCount = 0, paleCount = 0;
  let ironRichCount = 0, ironBlockingCount = 0;
  let vitaminCCount = 0, staplesCount = 0;
  let dairyCount = 0, junkCount = 0;
  let highStressCount = 0, noMealCount = 0;
  let noneActivityCount = 0;

  validLogs.forEach((log) => {
    avgFatigue  += log?.fatigue ?? 0;
    avgEnergy   += log?.energy ?? 10;
    avgMood     += log?.lifestyle?.mood ?? log?.mood ?? 5;
    avgSleep    += log?.sleep_hours ?? log?.lifestyle?.sleep ?? 8;
    avgWater    += log?.lifestyle?.water ?? 8;

    if (log?.symptoms?.dizziness)           dizzinessCount++;
    if (log?.symptoms?.headache)            headacheCount++;
    if (log?.symptoms?.shortnessOfBreath)   shortnessCount++;
    if (log?.symptoms?.heartPalpitations)   palpitationsCount++;
    if (log?.symptoms?.coldHandsFeet)       coldHandsCount++;
    if (log?.symptoms?.paleAppearance)      paleCount++;

    const foods = log?.foods || {};
    if ((foods.ironRich     || []).length > 0)  ironRichCount++;
    if ((foods.ironBlocking || []).length > 0)  ironBlockingCount++;
    if ((foods.vitaminC     || []).length > 0)  vitaminCCount++;
    if ((foods.staples      || []).length > 3)  staplesCount++;
    if ((foods.dairy        || []).length >= 3) dairyCount++;
    if ((foods.junk         || []).length >= 2) junkCount++;
    if ((foods.junk         || []).includes('noProperMeal')) noMealCount++;

    if (log?.lifestyle?.stress    === 'high') highStressCount++;
    if (log?.lifestyle?.activity  === 'none') noneActivityCount++;
  });

  avgFatigue  /= daysLogged;
  avgEnergy   /= daysLogged;
  avgMood     /= daysLogged;
  avgSleep    /= daysLogged;
  avgWater    /= daysLogged;

  const half = daysLogged / 2;

  const weeklyLog = {
    fatigue: avgFatigue,
    energy:  avgEnergy,
    lifestyle: {
      mood:     avgMood,
      sleep:    avgSleep,
      water:    avgWater,
      stress:   highStressCount    > half ? 'high'   : 'low',
      activity: noneActivityCount  > half ? 'none'   : 'light',
    },
    symptoms: {
      dizziness:          dizzinessCount   > half,
      headache:           headacheCount    > half,
      shortnessOfBreath:  shortnessCount   > half,
      heartPalpitations:  palpitationsCount > half,
      coldHandsFeet:      coldHandsCount   > half,
      paleAppearance:     paleCount        > half,
    },
    foods: {
      ironRich:     ironRichCount     > half ? ['present'] : [],
      ironBlocking: ironBlockingCount > half ? ['present'] : [],
      vitaminC:     vitaminCCount     > half ? ['present'] : [],
      staples:      staplesCount      > half
        ? ['present','present','present','present'] : [],
      dairy:        dairyCount        > half
        ? ['present','present','present'] : [],
      junk:         junkCount         > half
        ? (noMealCount > half
            ? ['present','present','noProperMeal']
            : ['present','present'])
        : [],
    },
  };

  const score = scoreSnapshot(weeklyLog, profile);
  return { ...resolveRisk(score), daysLogged };
};

// ─────────────────────────────────────────────────────────────
// SAVE WEEKLY RISK REPORT TO SUPABASE
// ─────────────────────────────────────────────────────────────
export const saveWeeklyRiskReport = async (userId, logs = [], profile = {}) => {
  if (!userId || logs.length < 7) return null;

  const risk = calculateWeeklyRisk(logs, profile);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);

  const formatDate = (d) => {
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  try {
    const { error } = await supabase
      .from('risk_reports')
      .insert({
        user_id:             userId,
        week_start:          formatDate(weekStart),
        week_end:            formatDate(today),
        score:               risk.score,
        level:               risk.level,
        contributing_factors: extractContributingFactors(logs, profile),
      });

    if (error) throw error;
    return risk;
  } catch (err) {
    console.error('Error saving risk report:', err);
    return risk;
  }
};

// ─────────────────────────────────────────────────────────────
// EXTRACT CONTRIBUTING FACTORS
// ─────────────────────────────────────────────────────────────
const extractContributingFactors = (logs = [], profile = {}) => {
  const factors = [];
  const conditions = profile?.medicalConditions || [];

  // Medical conditions
  if (conditions.includes('ironDeficiency'))   factors.push('iron_deficiency_diagnosed');
  if (conditions.includes('thalassemia'))      factors.push('thalassemia');
  if (conditions.includes('menorrhagia'))      factors.push('menorrhagia');
  if (conditions.includes('b12Deficiency'))    factors.push('b12_deficiency');
  if (conditions.includes('folateDeficiency')) factors.push('folate_deficiency');
  if (conditions.includes('diabetes'))         factors.push('diabetes');
  if (conditions.includes('thyroid'))          factors.push('thyroid_disorder');
  if (conditions.includes('kidneyDisease'))    factors.push('kidney_disease');
  if (profile?.coffee_tea_frequency === 'multiple_daily') factors.push('high_caffeine');

  // Diet patterns
  const noIronRich = logs.filter((l) => !(l?.foods?.ironRich?.length));
  if (noIronRich.length > 3)    factors.push('insufficient_iron_foods');

  const hasBlockers = logs.filter((l) => l?.foods?.ironBlocking?.length);
  if (hasBlockers.length > 3)   factors.push('iron_blockers_present');

  const hasJunk = logs.filter((l) => (l?.foods?.junk?.length ?? 0) >= 2);
  if (hasJunk.length > 3)       factors.push('poor_diet_quality');

  const noVitC = logs.filter((l) => !(l?.foods?.vitaminC?.length));
  if (noVitC.length > 3)        factors.push('low_vitamin_c');

  // Symptom patterns
  const highFatigue = logs.filter((l) => (l?.fatigue ?? 0) >= 6);
  if (highFatigue.length > 3)   factors.push('elevated_fatigue');

  const lowSleep = logs.filter((l) =>
    (l?.sleep_hours ?? l?.lifestyle?.sleep ?? 8) < 6
  );
  if (lowSleep.length > 3)      factors.push('insufficient_sleep');

  const shortness = logs.filter((l) => l?.symptoms?.shortnessOfBreath);
  if (shortness.length > 2)     factors.push('shortness_of_breath');

  const pale = logs.filter((l) => l?.symptoms?.paleAppearance);
  if (pale.length > 2)          factors.push('pale_appearance');

  const palpitations = logs.filter((l) => l?.symptoms?.heartPalpitations);
  if (palpitations.length > 2)  factors.push('heart_palpitations');

  return factors;
};