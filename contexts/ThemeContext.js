import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as defaultColors } from '../constants/colors';

const THEME_STORAGE_KEY = 'selectedTheme';

export const themes = {
  Bloom: {
    primary: '#C0392B',
    primaryLight: '#FAD7D7',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#FFF0F0',      // warmer pink tint
    card: '#FFF8F8',            // subtle pink — separates from background
    textPrimary: '#1C1C1C',     // darker for contrast
    textSecondary: '#5A5A5A',   // much darker than before — readable on light
    border: '#E8C0C0',          // more visible pink border
    accent: '#E94B6A',
    white: '#FFFFFF',
    grey: '#95A5A6',
  },

  Sage: {
    primary: '#5B8266',
    primaryLight: '#D4EAD8',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#F0F7F0',      // clear green tint
    card: '#F7FBF5',            // light green-white — separates from background
    textPrimary: '#1C1C1C',     // darker for contrast
    textSecondary: '#4A5A4A',   // green-tinted dark gray — readable
    border: '#BDD5C0',          // visible green border
    accent: '#6FA57A',
    white: '#FFFFFF',
    grey: '#95A5A6',
  },

  Lavender: {
    primary: '#7B6FA8',
    primaryLight: '#EDE7F6',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#FAF8FD',
    card: '#FFFFFF',
    textPrimary: '#2C2C2C',
    textSecondary: '#7F8C8D',
    border: '#DCD3EB',
    accent: '#9A86CC',
    white: '#FFFFFF',
    grey: '#BDC3C7',
  },

  Midnight: {
    primary: '#E94B6A',
    primaryLight: '#5C2D42',    // much lighter than before — chip selections visible
    success: '#2ECC71',         // brighter green for dark bg
    warning: '#F1C40F',         // brighter yellow for dark bg
    danger: '#E74C3C',
    background: '#0F1623',      // deeper dark — better contrast with card
    card: '#1A2235',            // clearly distinct from background
    textPrimary: '#F5F5F5',
    textSecondary: '#B0BAC8',   // lighter — readable on dark card
    border: '#2E3F58',          // more visible than before
    accent: '#6BA5FF',
    white: '#FFFFFF',
    grey: '#8899AA',
  },

  Charcoal: {
    primary: '#E07856',
    primaryLight: '#3A2E28',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#1A1A1A',
    card: '#252525',
    textPrimary: '#F0F0F0',
    textSecondary: '#999999',
    border: '#333333',
    accent: '#F0B16A',
    white: '#FFFFFF',
    grey: '#999999',
  },
};

const ThemeContext = createContext({
  theme: defaultColors,
  themeName: 'Bloom',
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('Bloom');

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (mounted && stored && themes[stored]) {
          setThemeName(stored);
        }
      } catch (err) {
        console.warn('Theme load failed, using default theme:', err?.message || err);
      }
    };

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = async (name) => {
    if (!themes[name]) return;
    setThemeName(name);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, name);
    } catch (err) {
      console.warn('Theme save failed:', err?.message || err);
    }
  };

  const value = useMemo(
    () => ({
      theme: themes[themeName] || themes.Bloom,
      themeName,
      setTheme,
    }),
    [themeName]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}