import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useNetworkStatus } from './services/networkService';

function AppShell() {
  const { themeName } = useTheme();
  const statusBarStyle = themeName === 'Midnight' || themeName === 'Charcoal' ? 'light' : 'dark';

  // Monitor network status and sync pending logs on reconnect
  useNetworkStatus();

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
