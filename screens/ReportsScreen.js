import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { getLogs } from '../services/storageService';
import { getProfile as getProfileFromService } from '../services/profileService';
import { calculateWeeklyRisk, saveWeeklyRiskReport } from '../services/riskEngine';
import { generateAnemiaReport } from '../services/geminiService';
import { supabase } from '../services/supabase';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

const screenWidth = Dimensions.get('window').width - 32;

export default function ReportsScreen() {
  const { theme: colors } = useTheme();
  const styles = createStyles(colors);

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(192, 57, 43, ${opacity})`,
    labelColor: () => colors.textSecondary,
    style: { borderRadius: 16 },
    propsForDots: { r: '4' },
  };

  const [logs, setLogs] = useState([]);
  const [logCount, setLogCount] = useState(0);
  const [weeklyRisk, setWeeklyRisk] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [profile, setProfile] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareStartDate, setShareStartDate] = useState(null);
  const [shareEndDate, setShareEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [sharePreview, setSharePreview] = useState('');
  const [shareStep, setShareStep] = useState('pick');

  const loadLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const initialLogs = await getLogs(user.id, 7);
      const initialProfile = await getProfileFromService(user.id);

      setLogs(initialLogs);
      setProfile(initialProfile);

      const validLogs = initialLogs.map((entry) => entry.log).filter(Boolean);
      setLogCount(validLogs.length);
      setWeeklyRisk(
        validLogs.length >= 7
          ? calculateWeeklyRisk(validLogs, initialProfile)
          : null
      );

      if (validLogs.length >= 7) {
        const { saveWeeklyRiskReport } = await import('../services/riskEngine');
        await saveWeeklyRiskReport(user.id, validLogs, initialProfile);
      }

      Promise.all([
        getProfileFromService(user.id, (freshProfile) => {
          setProfile(freshProfile);
        }),
        getLogs(user.id, 7, (freshLogs) => {
          setLogs(freshLogs);
          const freshValidLogs = freshLogs.map((entry) => entry.log).filter(Boolean);
          setLogCount(freshValidLogs.length);
          if (freshValidLogs.length >= 7 && initialProfile) {
            setWeeklyRisk(calculateWeeklyRisk(freshValidLogs, initialProfile));
          }
        }),
      ]).catch((err) => {
        console.warn('Background refresh failed:', err?.message);
      });
    } catch (err) {
      console.error('Error loading logs:', err);
    }
  };

  useFocusEffect(useCallback(() => { loadLogs(); }, []));

  const labels = logs.map((d) => {
    const parts = d.date.split('-');
    return `${parts[2]}/${parts[1]}`;
  });

  const fatigueData    = logs.map((d) => d.log?.fatigue ?? 0);
  const energyData     = logs.map((d) => d.log?.energy ?? 0);
  const ironRichData   = logs.map((d) => d.log?.foods?.ironRich?.length ?? 0);
  const ironBlockData  = logs.map((d) => d.log?.foods?.ironBlocking?.length ?? 0);
  const vitaminCData   = logs.map((d) => d.log?.foods?.vitaminC?.length ?? 0);
  const junkData       = logs.map((d) => d.log?.foods?.junk?.length ?? 0);

  const getRiskColor = (log) => {
    if (!log) return colors.grey;
    const score = log.riskScore ?? 0;
    if (score <= 15) return colors.success;
    if (score <= 30) return colors.warning;
    return colors.primary;
  };

  const handleGenerateReport = async () => {
    setAiError('');
    setAiReport(null);
    const loggedCount = logs.filter((d) => d.log).length;
    if (loggedCount < 3) {
      setAiError('Log at least 3 days to generate a report');
      return;
    }
    setLoading(true);
    try {
      const report = await generateAnemiaReport(logs, profile);
      setAiReport(report);
    } catch (e) {
      setAiError(e.message || 'AI service unavailable, try again later');
    }
    setLoading(false);
  };

  const generateShareSummary = (selectedLogs, startDate, endDate) => {
    const dayCount = selectedLogs.length;
    const loggedDays = selectedLogs.filter(d => d.log);

    if (dayCount < 7) {
      const lines = selectedLogs.map((d) => {
        if (!d.log) return `${d.date}: Not logged`;
        const l = d.log;
        return `${d.date}:\n  Fatigue: ${l.fatigue}/10 | Energy: ${l.energy}/10 | Mood: ${l.mood}/5\n  Sleep: ${l.lifestyle?.sleep ?? 'N/A'}h | Water: ${l.lifestyle?.water ?? 'N/A'} glasses | Exercise: ${l.exercise_minutes ?? 0} min`;
      });
      return `BloomCare Health Summary\n${startDate} to ${endDate}\n\n${lines.join('\n\n')}\n\nGenerated by BloomCare`;
    } else if (dayCount < 14) {
      const avgFatigue = (loggedDays.reduce((s, d) => s + d.log.fatigue, 0) / loggedDays.length).toFixed(1);
      const avgEnergy = (loggedDays.reduce((s, d) => s + d.log.energy, 0) / loggedDays.length).toFixed(1);
      const avgSleep = (loggedDays.reduce((s, d) => s + (d.log.lifestyle?.sleep ?? 0), 0) / loggedDays.length).toFixed(1);
      const riskLine = weeklyRisk ? `Risk Level: ${weeklyRisk.level}` : 'Risk Level: Insufficient data';
      return `BloomCare Weekly Summary\n${startDate} to ${endDate}\n\n${riskLine}\nDays Logged: ${loggedDays.length}/${dayCount}\n\nAverages:\n  Fatigue: ${avgFatigue}/10\n  Energy: ${avgEnergy}/10\n  Sleep: ${avgSleep}h\n\nGenerated by BloomCare`;
    } else {
      const weeks = [];
      for (let i = 0; i < selectedLogs.length; i += 7) {
        const week = selectedLogs.slice(i, i + 7);
        const weekLogged = week.filter(d => d.log);
        const weekAvgFatigue = weekLogged.length ? (weekLogged.reduce((s, d) => s + d.log.fatigue, 0) / weekLogged.length).toFixed(1) : 'N/A';
        const weekAvgEnergy = weekLogged.length ? (weekLogged.reduce((s, d) => s + d.log.energy, 0) / weekLogged.length).toFixed(1) : 'N/A';
        weeks.push(`Week ${Math.floor(i / 7) + 1} (${week[0].date} to ${week[week.length - 1].date}):\n  Days Logged: ${weekLogged.length}/7 | Avg Fatigue: ${weekAvgFatigue}/10 | Avg Energy: ${weekAvgEnergy}/10`);
      }
      return `BloomCare Monthly Summary\n${startDate} to ${endDate}\n\n${weeks.join('\n\n')}\n\nGenerated by BloomCare`;
    }
  };

  const handleGeneratePreview = () => {
    if (!shareStartDate || !shareEndDate) return;
    const start = new Date(shareStartDate);
    const end = new Date(shareEndDate);
    const selectedLogs = logs.filter(d => {
      const date = new Date(d.date);
      return date >= start && date <= end;
    });
    const preview = generateShareSummary(selectedLogs, shareStartDate, shareEndDate);
    setSharePreview(preview);
    setShareStep('preview');
  };

  const resetShareModal = () => {
    setShowShareModal(false);
    setShareStep('pick');
    setSharePreview('');
    setShareStartDate(null);
    setShareEndDate(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: sharePreview });
      resetShareModal();
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <ScrollView
      style={[globalStyles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={globalStyles.scrollContent}
    >
      <Text style={globalStyles.heading}>Reports 📊</Text>

      {/* ── Risk Score Card ── */}
      <View style={styles.topRiskCard}>
        <Text style={styles.topRiskTitle}>Your Risk Score</Text>
        {logCount < 7 ? (
          <View style={styles.lockedWrap}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.lockedText}>
              Log {7 - logCount} more days to unlock your risk score
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.bigScore}>{weeklyRisk?.score ?? 0}/100</Text>
            <View style={[styles.levelPill, { backgroundColor: weeklyRisk?.color || colors.success }]}>
              <Text style={styles.levelPillText}>{weeklyRisk?.level || 'Low'}</Text>
            </View>
            <Text style={styles.topRiskSubtext}>Calculated from your last 7 days</Text>
            <Text style={styles.daysText}>{weeklyRisk?.daysLogged ?? 0}/7 days logged this week</Text>
          </>
        )}
      </View>

      {/* ── Charts ── */}
      <Text style={styles.sectionTitle}>This Week</Text>
      {logs.some((d) => d.log) ? (
        <>
          <Text style={styles.chartLabel}>Fatigue & Energy (7 days)</Text>
          <LineChart
            data={{
              labels,
              datasets: [
                { data: fatigueData.length ? fatigueData : [0], color: () => colors.danger, strokeWidth: 2 },
                { data: energyData.length ? energyData : [0], color: () => colors.success, strokeWidth: 2 },
              ],
              legend: ['Fatigue', 'Energy'],
            }}
            width={screenWidth}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />

          <Text style={styles.chartLabel}>Iron-rich foods per day</Text>
          <BarChart
            data={{
              labels,
              datasets: [{ data: ironRichData.length ? ironRichData : [0] }],
            }}
            width={screenWidth}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
            }}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />

          <Text style={styles.chartLabel}>Vitamin C foods per day</Text>
          <BarChart
            data={{
              labels,
              datasets: [{ data: vitaminCData.length ? vitaminCData : [0] }],
            }}
            width={screenWidth}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(243, 156, 18, ${opacity})`,
            }}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />

          <Text style={styles.chartLabel}>Iron-blocking foods per day</Text>
          <BarChart
            data={{
              labels,
              datasets: [{ data: ironBlockData.length ? ironBlockData : [0] }],
            }}
            width={screenWidth}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
            }}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />

          <Text style={styles.chartLabel}>Junk & fried foods per day</Text>
          <BarChart
            data={{
              labels,
              datasets: [{ data: junkData.length ? junkData : [0] }],
            }}
            width={screenWidth}
            height={180}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(192, 57, 43, ${opacity})`,
            }}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero
            showValuesOnTopOfBars
          />
        </>
      ) : (
        <Text style={globalStyles.bodyText}>No logs yet this week. Start tracking!</Text>
      )}

      {/* ── Risk Trend ── */}
      <Text style={styles.sectionTitle}>Risk Trend</Text>
      <View style={styles.trendRow}>
        {logs.map((d) => (
          <View key={d.date} style={styles.trendItem}>
            <View
              style={[
                styles.trendDot,
                { backgroundColor: d.log ? getRiskColor(d.log) : colors.grey },
              ]}
            />
            <Text style={styles.trendDate}>{d.date.slice(5)}</Text>
            <Text style={styles.trendLabel}>
              {d.log ? d.log.riskLevel?.slice(0, 3) : '-'}
            </Text>
          </View>
        ))}
      </View>

      {/* ── AI Report ── */}
      <Text style={styles.sectionTitle}>AI Report</Text>
      <TouchableOpacity
        style={[globalStyles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={handleGenerateReport}
        disabled={loading}
      >
        <Text style={globalStyles.primaryButtonText}>
          {loading ? 'Generating...' : '✨ Generate AI Report'}
        </Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 16 }}
        />
      )}

      {aiError ? <Text style={globalStyles.errorText}>{aiError}</Text> : null}

      {aiReport && (
        <View style={[globalStyles.card, { marginTop: 12 }]}>
          <Text style={styles.reportSection}>Overall Risk Assessment</Text>
          <Text style={[styles.riskBadge, {
            color: aiReport.riskLevel === 'Low'
              ? colors.success
              : aiReport.riskLevel === 'High'
                ? colors.danger
                : colors.warning,
          }]}>
            {aiReport.riskLevel}
          </Text>

          <Text style={styles.reportSection}>Key Observations</Text>
          {aiReport.observations.map((o, i) => (
            <Text key={i} style={styles.bullet}>• {o}</Text>
          ))}

          <Text style={styles.reportSection}>Diet Recommendations</Text>
          {aiReport.dietRecommendations.map((d, i) => (
            <Text key={i} style={styles.bullet}>• {d}</Text>
          ))}

          <Text style={styles.reportSection}>Lifestyle Tip</Text>
          <Text style={globalStyles.bodyText}>{aiReport.lifestyleTip}</Text>

          <Text style={styles.disclaimer}>{aiReport.disclaimer}</Text>
        </View>
      )}

      {/* ── Export ── */}
      <Text style={styles.sectionTitle}>Export</Text>
      <TouchableOpacity style={globalStyles.secondaryButton} onPress={() => setShowShareModal(true)}>
        <Text style={globalStyles.secondaryButtonText}>📤 Share Summary</Text>
      </TouchableOpacity>

      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={resetShareModal}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalCard}>
            <TouchableOpacity
              style={styles.shareModalClose}
              onPress={resetShareModal}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.shareModalTitle}>Share Summary</Text>

            {shareStep === 'pick' ? (
              <View>
                <TouchableOpacity
                  style={[globalStyles.secondaryButton, styles.shareDateButton]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={globalStyles.secondaryButtonText}>
                    {shareStartDate ? `Start: ${shareStartDate}` : 'Pick Start Date'}
                  </Text>
                </TouchableOpacity>

                {showStartPicker && (
                  <DateTimePicker
                    value={shareStartDate ? new Date(shareStartDate) : new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(_, date) => {
                      setShowStartPicker(false);
                      if (date) setShareStartDate(date.toISOString().split('T')[0]);
                    }}
                  />
                )}

                <TouchableOpacity
                  style={[globalStyles.secondaryButton, styles.shareDateButton]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={globalStyles.secondaryButtonText}>
                    {shareEndDate ? `End: ${shareEndDate}` : 'Pick End Date'}
                  </Text>
                </TouchableOpacity>

                {showEndPicker && (
                  <DateTimePicker
                    value={shareEndDate ? new Date(shareEndDate) : new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(_, date) => {
                      setShowEndPicker(false);
                      if (date) setShareEndDate(date.toISOString().split('T')[0]);
                    }}
                  />
                )}

                <TouchableOpacity
                  style={[globalStyles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={handleGeneratePreview}
                >
                  <Text style={globalStyles.primaryButtonText}>Generate Summary</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <ScrollView style={styles.sharePreviewBox} nestedScrollEnabled>
                  <Text style={styles.sharePreviewText}>{sharePreview}</Text>
                </ScrollView>

                <TouchableOpacity
                  style={[globalStyles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={handleShare}
                >
                  <Text style={globalStyles.primaryButtonText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[globalStyles.secondaryButton, { marginTop: 12 }]}
                  onPress={() => setShareStep('pick')}
                >
                  <Text style={globalStyles.secondaryButtonText}>Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 16,
    marginBottom: 10,
  },
  chartLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  chart: {
    borderRadius: 16,
    marginBottom: 16,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  trendItem: { alignItems: 'center', flex: 1 },
  trendDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 4,
  },
  trendDate: { fontSize: 9, color: colors.textSecondary },
  trendLabel: { fontSize: 9, color: colors.textPrimary, fontWeight: '600' },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  shareModalCard: {
    backgroundColor: colors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  shareModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    paddingRight: 28,
  },
  shareDateButton: {
    marginBottom: 12,
  },
  sharePreviewBox: {
    maxHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  sharePreviewText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  reportSection: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  riskBadge: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  bullet: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  disclaimer: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 12,
    lineHeight: 16,
  },
  topRiskCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRiskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  lockedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedText: {
    marginLeft: 10,
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bigScore: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 56,
  },
  levelPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 6,
  },
  levelPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  topRiskSubtext: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textSecondary,
  },
  daysText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
});