import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as defaultColors } from '../constants/colors';

const THEME_STORAGE_KEY = 'selectedTheme';

export const themes = {
  Bloom: {
    primary: '#C0392B',
    primaryLight: '#F9E4E4',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#FFF8F8',
    card: '#FFFFFF',
    textPrimary: '#2C2C2C',
    textSecondary: '#7F8C8D',
    border: '#F0D9D9',
    accent: '#E94B6A',
    white: '#FFFFFF',
    grey: '#BDC3C7',
  },
  Sage: {
    primary: '#5B8266',
    primaryLight: '#E3EEDA',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#F7FBF5',
    card: '#FFFFFF',
    textPrimary: '#2C2C2C',
    textSecondary: '#7F8C8D',
    border: '#D8E5D3',
    accent: '#6FA57A',
    white: '#FFFFFF',
    grey: '#BDC3C7',
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
    primaryLight: '#3A2A36',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#121826',
    card: '#1E2638',
    textPrimary: '#F5F5F5',
    textSecondary: '#A0A8B5',
    border: '#2A3548',
    accent: '#6BA5FF',
    white: '#FFFFFF',
    grey: '#999999',
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
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (mounted && stored && themes[stored]) {
        setThemeName(stored);
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
    await AsyncStorage.setItem(THEME_STORAGE_KEY, name);
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
