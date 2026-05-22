# BloomCare 🌸

BloomCare is a React Native mobile app for **anemia risk detection** and **daily health tracking**, designed for Pakistani women. Built with Expo SDK 54, it runs in **Expo Go** without ejecting.

## Features

- Email/password authentication via Supabase
- Daily symptom, diet (Pakistani foods), and lifestyle tracking
- Rule-based anemia risk scoring (0–100)
- Weekly charts and AI-powered reports (Google Gemini free tier)
- 15 culturally relevant anemia myths busted
- Local data storage with AsyncStorage

## Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) app on your phone (SDK 54)
- Free accounts: [Supabase](https://supabase.com), [Google AI Studio](https://aistudio.google.com) (Gemini API key)

## Setup

### 1. Install dependencies

```bash
npm install
npx expo install expo react react-native expo-status-bar babel-preset-expo
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context react-native-gesture-handler @react-native-async-storage/async-storage react-native-svg @react-native-community/slider
npm install @supabase/supabase-js react-native-chart-kit
```

### 2. Environment variables

Copy `.env` and fill in your keys:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

Restart the dev server after changing `.env`.

### 3. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Authentication → Providers** and enable **Email**
3. Copy **Project URL** and **anon public key** from **Settings → API**
4. Paste into `.env`
5. (Optional) Disable email confirmation under **Authentication → Settings** for easier testing

### 4. Gemini API key

1. Visit [Google AI Studio](https://aistudio.google.com)
2. Create an API key (free tier)
3. Add to `.env` as `EXPO_PUBLIC_GEMINI_API_KEY`

## Run with Expo Go

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Use the same Wi‑Fi network as your computer.

## Project structure

```
BloomCare/
├── App.js
├── navigation/AppNavigator.js
├── screens/          # All app screens
├── components/       # Reusable UI
├── services/         # Supabase, risk engine, Gemini, storage
├── data/             # Myths, Pakistani foods
└── constants/        # Colors, shared styles
```

## Risk scoring logic (FYP summary)

The risk engine (`services/riskEngine.js`) computes a score from 0–100 using four categories:

| Category | Max points | Examples |
|----------|------------|----------|
| Symptoms | 40 | High fatigue, low energy, dizziness, pallor |
| Diet | 30 | No iron-rich foods, chai/dairy with meals, skipped meals |
| Lifestyle | 20 | Low sleep, high stress, low water, inactivity + fatigue |
| Profile | 10 | Thalassemia trait, kidney disease, age &lt;18 or &gt;45 |

**Thresholds:** 0–30 Low (green), 31–60 Moderate (amber), 61–100 High (red).

This is an **educational estimate**, not a medical diagnosis. Users should consult a doctor for Hb/ferritin tests.

## Data storage

- **Supabase:** authentication only (sign up, login, logout, password reset)
- **AsyncStorage:** profile, daily logs (`log_YYYY-MM-DD`), streak, onboarding flag

## Disclaimer

BloomCare does not provide medical diagnosis or treatment. Risk scores and AI reports are for awareness and self-tracking only. Always consult a qualified healthcare provider for blood tests and treatment. Seek emergency care for severe symptoms.

## License

Educational / FYP use.
