import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setOnboardingComplete } from '../services/storageService';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const slides = [
  {
    emoji: '🌸',
    title: 'Track Your Health Daily',
    desc: 'Track fatigue, diet, and mood every day to understand your body better.',
  },
  {
    emoji: '🇵🇰',
    title: 'Made for Pakistani Women',
    desc: 'Built around Pakistani diet and lifestyle: daal, saag, chai habits, and more.',
  },
  {
    emoji: '🤖',
    title: 'AI-Powered Risk Insights',
    desc: 'Get personalized anemia risk analysis based on your daily logs.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [index, setIndex] = useState(0);
  const flatRef = useRef(null);

  const finish = async () => {
    await setOnboardingComplete();
    navigation.replace('Login');
  };

  const next = () => {
    if (index < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1 });
      setIndex(index + 1);
    } else {
      finish();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.skip} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <FlatList
          ref={flatRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            setIndex(i);
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc}>{item.desc}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <TouchableOpacity
            style={[globalStyles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={next}
          >
            <Text style={globalStyles.primaryButtonText}>
              {index === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingBottom: 40,
  },
  skip: {
    alignSelf: 'flex-end',
    padding: 16,
    marginTop: 8,
    marginRight: 12,
  },
  skipText: { color: theme.primary, fontWeight: '600', fontSize: 15 },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  emoji: { fontSize: 80, marginBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  desc: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: theme.primary, width: 24 },
});