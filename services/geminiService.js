const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const buildPrompt = (last7DaysLogs, userProfile) => {
  const loggedDays = last7DaysLogs.filter((d) => d.log);
  const avgFatigue =
    loggedDays.reduce((s, d) => s + (d.log.fatigue || 0), 0) / (loggedDays.length || 1);
  const avgEnergy =
    loggedDays.reduce((s, d) => s + (d.log.energy || 0), 0) / (loggedDays.length || 1);
  const avgMood =
    loggedDays.reduce((s, d) => s + (d.log.mood || 0), 0) / (loggedDays.length || 1);
  const avgSleep =
    loggedDays.reduce((s, d) => s + (d.log.sleep_hours || 0), 0) / (loggedDays.length || 1);

  const symptomCounts = {};
  loggedDays.forEach(({ log }) => {
    const symptoms = log.symptoms || {};
    Object.entries(symptoms).forEach(([k, v]) => {
      if (v) symptomCounts[k] = (symptomCounts[k] || 0) + 1;
    });
  });

  const riskTrend = loggedDays.map(({ date, log }) => {
    const risk = log.riskScore ?? 'N/A';
    return `${date}: score ${risk}`;
  });

  // Build profile info - handle both old and new formats
  const getDiet = () => {
    if (userProfile?.diet_type) return userProfile.diet_type;
    if (userProfile?.dietaryPreference) return userProfile.dietaryPreference;
    return 'unknown';
  };

  const getConditions = () => {
    if (Array.isArray(userProfile?.medicalConditions)) {
      return userProfile.medicalConditions.join(', ');
    }
    const conds = [];
    if (userProfile?.has_thyroid) conds.push('Thyroid Disorder');
    if (userProfile?.has_diabetes) conds.push('Diabetes');
    if (userProfile?.other_conditions) conds.push(userProfile.other_conditions);
    return conds.length > 0 ? conds.join(', ') : 'none';
  };

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
- Age: ${userProfile?.age ?? 'unknown'}
- Medical conditions: ${getConditions()}
- Dietary preference: ${getDiet()}
- Average sleep (hours): ${avgSleep.toFixed(1)}

TRACKING SUMMARY (last 7 days, ${loggedDays.length} days logged):
- Average fatigue (1-10): ${avgFatigue.toFixed(1)}
- Average energy (1-10): ${avgEnergy.toFixed(1)}
- Average mood (1-10): ${avgMood.toFixed(1)}
- Frequent symptoms: ${JSON.stringify(symptomCounts)}
- Risk trend: ${riskTrend.join('; ')}

Daily logs JSON:
${JSON.stringify(loggedDays, null, 2)}`;
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
