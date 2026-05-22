const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const buildPrompt = (last7DaysLogs, userProfile) => {
  const loggedDays = last7DaysLogs.filter((d) => d.log);
  const n = loggedDays.length || 1;

  const avg = (key) =>
    loggedDays.reduce((s, d) => s + (d.log[key] || 0), 0) / n;

  const avgFatigue = avg('fatigue');
  const avgEnergy  = avg('energy');
  const avgMood    = avg('mood');
  const avgSleep   = loggedDays.reduce(
    (s, d) => s + (d.log.lifestyle?.sleep || d.log.sleep_hours || 0), 0
  ) / n;
  const avgWater   = loggedDays.reduce(
    (s, d) => s + (d.log.lifestyle?.water ?? 0), 0
  ) / n;

  // Symptom frequency counts
  const symptomCounts = {};
  loggedDays.forEach(({ log }) => {
    Object.entries(log.symptoms || {}).forEach(([k, v]) => {
      if (v) symptomCounts[k] = (symptomCounts[k] || 0) + 1;
    });
  });

  // Diet summary across 7 days
  const dietSummary = {
    ironRich:     0, vitaminC:   0, ironBlocking: 0,
    staples:      0, dairy:      0, junk:         0,
    noProperMeal: 0,
  };
  loggedDays.forEach(({ log }) => {
    const f = log.foods || {};
    dietSummary.ironRich     += (f.ironRich     || []).length;
    dietSummary.vitaminC     += (f.vitaminC     || []).length;
    dietSummary.ironBlocking += (f.ironBlocking || []).length;
    dietSummary.staples      += (f.staples      || []).length;
    dietSummary.dairy        += (f.dairy        || []).length;
    dietSummary.junk         += (f.junk         || []).length;
    if ((f.junk || []).includes('noProperMeal')) dietSummary.noProperMeal++;
  });

  const riskTrend = loggedDays.map(({ date, log }) =>
    `${date}: score ${log.riskScore ?? 'N/A'} (${log.riskLevel ?? 'unknown'})`
  );

  const getDiet = () =>
    userProfile?.dietaryPreference || userProfile?.diet_type || 'unknown';

  const getConditions = () => {
    if (Array.isArray(userProfile?.medicalConditions)) {
      const filtered = userProfile.medicalConditions.filter(
        (c) => c !== 'noConditions'
      );
      return filtered.length > 0 ? filtered.join(', ') : 'None';
    }
    return 'None';
  };

  const bmiInfo = userProfile?.bmi
    ? `BMI: ${userProfile.bmi}`
    : '';

  return `You are a health assistant for Pakistani women tracking anemia risk. Analyze this data and respond EXACTLY in this format (no extra text):

RISK LEVEL: [Low/Moderate/High]
OBSERVATIONS:
1. ...
2. ...
3. ...
DIET RECOMMENDATIONS:
1. ...
2. ...
LIFESTYLE TIP: ...
DISCLAIMER: This is not a medical diagnosis. Please consult a doctor.

USER PROFILE:
- Age: ${userProfile?.age ?? 'unknown'} ${bmiInfo}
- Medical conditions: ${getConditions()}
- Dietary preference: ${getDiet()}
- Coffee/tea frequency: ${userProfile?.coffee_tea_frequency ?? 'unknown'}
- Exercise frequency: ${userProfile?.exercise_frequency ?? 'unknown'}

TRACKING SUMMARY (last 7 days, ${loggedDays.length} days logged):
- Average fatigue (1-10): ${avgFatigue.toFixed(1)}
- Average energy (1-10): ${avgEnergy.toFixed(1)}
- Average mood (1-5): ${avgMood.toFixed(1)}
- Average sleep (hours): ${avgSleep.toFixed(1)}
- Average water (glasses): ${avgWater.toFixed(1)}

SYMPTOM FREQUENCY (out of ${loggedDays.length} days):
${JSON.stringify(symptomCounts, null, 2)}

DIET SUMMARY (total items across ${loggedDays.length} days):
- Iron-rich foods: ${dietSummary.ironRich} items
- Vitamin C foods: ${dietSummary.vitaminC} items  
- Iron blockers: ${dietSummary.ironBlocking} items
- Staples/grains: ${dietSummary.staples} items
- Dairy/drinks: ${dietSummary.dairy} items
- Junk/fried foods: ${dietSummary.junk} items
- Days with no proper meal: ${dietSummary.noProperMeal}

RISK TREND:
${riskTrend.join('\n')}

Focus recommendations on Pakistani dietary context 
(daal, saag, chanay, chai timing, etc.)`;
};


const parseResponse = (text) => {
  const result = {
    riskLevel: 'Moderate',
    observations: [],
    dietRecommendations: [],
    lifestyleTip: '',
    disclaimer:
      'This is not a medical diagnosis. Please consult a doctor for proper testing and treatment.',
  };

  const riskMatch = text.match(/RISK LEVEL:\s*(Low|Moderate|High)/i);
  if (riskMatch) result.riskLevel = riskMatch[1];

  const obsSection = text.match(/OBSERVATIONS:\s*([\s\S]*?)(?=DIET RECOMMENDATIONS:|$)/i);
  if (obsSection) {
    const lines = obsSection[1]
      .split('\n')
      .map((l) => l.replace(/^\d+\.\s*/, '').trim())
      .filter((l) => l.length > 0);
    result.observations = lines.slice(0, 3);
  }

  const dietSection = text.match(/DIET RECOMMENDATIONS:\s*([\s\S]*?)(?=LIFESTYLE TIP:|$)/i);
  if (dietSection) {
    const lines = dietSection[1]
      .split('\n')
      .map((l) => l.replace(/^\d+\.\s*/, '').trim())
      .filter((l) => l.length > 0);
    result.dietRecommendations = lines.slice(0, 2);
  }

  const lifestyleMatch = text.match(/LIFESTYLE TIP:\s*(.+?)(?=DISCLAIMER:|$)/is);
  if (lifestyleMatch) result.lifestyleTip = lifestyleMatch[1].trim();

  const disclaimerMatch = text.match(/DISCLAIMER:\s*(.+)/is);
  if (disclaimerMatch) result.disclaimer = disclaimerMatch[1].trim();

  return result;
};

const getGeminiErrorMessage = (error, response) => {
  const msg = (error?.message || '').toLowerCase();
  const status = response?.status ?? error?.status;

  if (
    msg.includes('api key') ||
    msg.includes('gemini api key') ||
    status === 400 ||
    status === 401 ||
    status === 403
  ) {
    return 'Invalid Gemini API key. Check your .env file.';
  }
  if (status === 429 || msg.includes('quota')) {
    return 'Gemini quota exceeded. Try again later.';
  }
  if (
    error instanceof TypeError ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  ) {
    return 'No internet connection. Check your network.';
  }
  return 'AI service unavailable. Please try again.';
};

export const generateAnemiaReport = async (last7DaysLogs, userProfile) => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key') {
    throw new Error('Gemini API key not configured');
  }

  const loggedCount = last7DaysLogs.filter((d) => d.log).length;
  if (loggedCount < 3) {
    throw new Error('Need at least 3 days of logs');
  }

  const prompt = buildPrompt(last7DaysLogs, userProfile);

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const err = new Error(`API request failed (${response.status})`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) throw new Error('Empty response');

    return parseResponse(text);
  } catch (error) {
    if (
      error.message === 'Gemini API key not configured' ||
      error.message === 'Need at least 3 days of logs'
    ) {
      throw error;
    }
    throw new Error(getGeminiErrorMessage(error, { status: error.status }));
  }
};
