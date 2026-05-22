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

  // Symptoms scoring
  // Fatigue: none=0, mild=2, moderate=5, severe=8
  const fatigue = log?.fatigue ?? 0;
  if (fatigue >= 8) score += 8;
  else if (fatigue >= 6) score += 5;
  else if (fatigue >= 4) score += 2;

  // Dizziness: 0-3 scale × 2
  const dizziness = log?.dizziness ?? 0;
  score += Math.min(3, dizziness) * 2;

  // Headache: 0-3 scale × 1.5
  const headache = log?.headache ?? 0;
  score += Math.min(3, headache) * 1.5;

  // Energy low (under 4 = +3)
  const energy = log?.energy ?? 10;
  if (energy < 4) score += 3;

  // Mood low (under 4 = +2)
  const mood = log?.mood ?? 5;
  if (mood < 4) score += 2;

  // Sleep under 6 hours (+2)
  const sleepHours = log?.sleep_hours ?? log?.lifestyle?.sleep ?? 8;
  if (sleepHours < 6) score += 2;

  // Diet assessment
  const foods = log?.foods || {};
  const ironRich = foods.ironRich || [];
  const ironBlocking = foods.ironBlocking || [];
  const vitaminC = foods.vitaminC || [];

  if (ironRich.length === 0) score += 3;
  if (ironBlocking.length > 0) score += 2;
  if (vitaminC.length === 0) score += 1;

  // Profile-based multipliers
  if (profile?.has_thyroid) score += 2;
  if (profile?.has_diabetes) score += 2;

  // Coffee/tea frequency as iron blocker: multiple_daily adds +2
  if (profile?.coffee_tea_frequency === 'multiple_daily') score += 2;

  // Diet type: vegetarian adds +1 unless balanced
  if (profile?.diet_type === 'vegetarian' && ironRich.length === 0) score += 1;

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
 * Requires at least 7 days of data
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

  // Build weekly snapshot by averaging metrics
  let totalScore = 0;
  let avgFatigue = 0;
  let avgEnergy = 0;
  let avgMood = 0;
  let avgSleep = 0;
  let dizzinessCount = 0;
  let headacheCount = 0;
  let ironRichCount = 0;
  let ironBlockingCount = 0;
  let vitaminCCount = 0;

  validLogs.forEach((log) => {
    avgFatigue += log?.fatigue ?? 0;
    avgEnergy += log?.energy ?? 10;
    avgMood += log?.mood ?? 5;
    avgSleep += log?.sleep_hours ?? log?.lifestyle?.sleep ?? 8;

    if (log?.dizziness) dizzinessCount++;
    if (log?.headache) headacheCount++;

    const foods = log?.foods || {};
    if ((foods.ironRich || []).length > 0) ironRichCount++;
    if ((foods.ironBlocking || []).length > 0) ironBlockingCount++;
    if ((foods.vitaminC || []).length > 0) vitaminCCount++;
  });

  // Average the metrics
  avgFatigue = avgFatigue / daysLogged;
  avgEnergy = avgEnergy / daysLogged;
  avgMood = avgMood / daysLogged;
  avgSleep = avgSleep / daysLogged;

  // Build weekly aggregate
  const weeklyLog = {
    fatigue: avgFatigue,
    energy: avgEnergy,
    mood: avgMood,
    sleep_hours: avgSleep,
    dizziness: dizzinessCount > 0 ? Math.ceil((dizzinessCount / daysLogged) * 3) : 0,
    headache: headacheCount > 0 ? Math.ceil((headacheCount / daysLogged) * 3) : 0,
    foods: {
      ironRich: ironRichCount > daysLogged / 2 ? ['present'] : [],
      ironBlocking: ironBlockingCount > daysLogged / 2 ? ['present'] : [],
      vitaminC: vitaminCCount > daysLogged / 2 ? ['present'] : [],
    },
  };

  const score = scoreSnapshot(weeklyLog, profile);

  return {
    ...resolveRisk(score),
    daysLogged,
  };
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

  // Check profile conditions
  if (profile?.has_thyroid) factors.push('thyroid_disorder');
  if (profile?.has_diabetes) factors.push('diabetes');
  if (profile?.coffee_tea_frequency === 'multiple_daily') factors.push('high_caffeine');

  // Check dietary patterns
  const logsWithoutIronRich = logs.filter((l) => !l?.foods?.ironRich?.length);
  if (logsWithoutIronRich.length > 3) factors.push('insufficient_iron_foods');

  const logsWithIronBlockers = logs.filter((l) => l?.foods?.ironBlocking?.length);
  if (logsWithIronBlockers.length > 3) factors.push('iron_blockers_present');

  // Check fatigue patterns
  const highFatigueLogs = logs.filter((l) => (l?.fatigue ?? 0) >= 6);
  if (highFatigueLogs.length > 3) factors.push('elevated_fatigue');

  // Check sleep patterns
  const insufficientSleep = logs.filter((l) => (l?.sleep_hours ?? 8) < 6);
  if (insufficientSleep.length > 3) factors.push('insufficient_sleep');

  return factors;
};

