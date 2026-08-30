import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeMode, Colors, fonts, radius, spacing } from '../theme';

const OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'SYSTEM' },
  { key: 'light', label: 'LIGHT' },
  { key: 'dark', label: 'DARK' },
];

export default function SettingsScreen() {
  const { mode, resolvedMode, colors, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <Text style={styles.headerSubtitle}>APPEARANCE</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>THEME</Text>
        <View style={styles.card}>
          <View style={styles.segmentRow}>
            {OPTIONS.map((opt) => {
              const selected = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => setMode(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.caption}>Currently: {resolvedMode === 'dark' ? 'Dark' : 'Light'}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.headerBg,
    },
    headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 2, color: colors.textPrimary },
    headerSubtitle: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1.5, color: colors.textQuaternary, marginTop: 2 },
    content: { padding: spacing.md },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2, color: colors.accent, marginBottom: spacing.sm },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    segmentRow: { flexDirection: 'row', gap: spacing.sm },
    segment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.sm,
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentSelected: { backgroundColor: colors.accentDim, borderColor: colors.accent },
    segmentLabel: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
    segmentLabelSelected: { color: colors.accent },
    caption: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  });
}
