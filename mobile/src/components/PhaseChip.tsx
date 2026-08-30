import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, fonts, useTheme, withAlpha } from '../theme';

export type ChipKind = 'near' | 'in_zone' | 'at_entry' | 'target_hit' | 'stopped_out' | 'short';

function kindStyle(colors: Colors): Record<ChipKind, { label: string; color: string; bg: string; border?: string }> {
  return {
    near: { label: 'NEAR ZONE', color: colors.textTertiary, bg: withAlpha(colors.textTertiary, 0.12) },
    in_zone: { label: 'IN ZONE', color: colors.iconGray, bg: withAlpha(colors.iconGray, 0.10) },
    at_entry: { label: 'AT ENTRY', color: colors.accent, bg: withAlpha(colors.accent, 0.14) },
    target_hit: { label: 'TARGET HIT', color: colors.accent, bg: withAlpha(colors.accent, 0.14), border: withAlpha(colors.accent, 0.4) },
    stopped_out: { label: 'STOPPED OUT', color: colors.danger, bg: withAlpha(colors.danger, 0.14), border: withAlpha(colors.danger, 0.4) },
    short: { label: 'SHORT', color: colors.danger, bg: 'transparent', border: withAlpha(colors.danger, 0.45) },
  };
}

export default function PhaseChip({ kind }: { kind: ChipKind }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const s = useMemo(() => kindStyle(colors)[kind], [colors, kind]);
  return (
    <View style={[styles.chip, { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', borderWidth: s.border ? 1 : 0 }]}>
      <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export function phaseToChipKind(phase: 'near' | 'in_zone' | 'at_entry'): ChipKind {
  return phase;
}

function createStyles(_colors: Colors) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 3,
      alignSelf: 'flex-start',
    },
    label: {
      fontFamily: fonts.monoBold,
      fontSize: 9.5,
      letterSpacing: 1.2,
    },
  });
}
