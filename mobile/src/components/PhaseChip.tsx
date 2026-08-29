import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export type ChipKind = 'near' | 'in_zone' | 'at_entry' | 'target_hit' | 'stopped_out' | 'short';

const KIND_STYLE: Record<ChipKind, { label: string; color: string; bg: string; border?: string }> = {
  near: { label: 'NEAR ZONE', color: colors.textTertiary, bg: 'rgba(117,121,140,0.12)' },
  in_zone: { label: 'IN ZONE', color: colors.iconGray, bg: 'rgba(195,202,210,0.10)' },
  at_entry: { label: 'AT ENTRY', color: colors.gold, bg: 'rgba(201,162,74,0.14)' },
  target_hit: { label: 'TARGET HIT', color: colors.gold, bg: 'rgba(201,162,74,0.14)', border: 'rgba(201,162,74,0.4)' },
  stopped_out: { label: 'STOPPED OUT', color: colors.danger, bg: 'rgba(176,71,62,0.14)', border: 'rgba(176,71,62,0.4)' },
  short: { label: 'SHORT', color: colors.danger, bg: 'transparent', border: 'rgba(176,71,62,0.45)' },
};

export default function PhaseChip({ kind }: { kind: ChipKind }) {
  const s = KIND_STYLE[kind];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', borderWidth: s.border ? 1 : 0 }]}>
      <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export function phaseToChipKind(phase: 'near' | 'in_zone' | 'at_entry'): ChipKind {
  return phase;
}

const styles = StyleSheet.create({
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
