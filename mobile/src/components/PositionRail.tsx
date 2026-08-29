import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

interface Levels {
  sl: number;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  currentPrice?: number | null;
}

// All these setups are SHORTS: sl is the highest price, tp3 the lowest.
// Percent-along-the-rail is measured from sl (0%) to tp3 (100%), so a price
// closer to tp3 always reads further right/down regardless of the symbol's
// actual price scale.
function pct(levels: Levels, value: number): number {
  const range = levels.sl - levels.tp3;
  if (range <= 0) return 50;
  return Math.min(100, Math.max(0, ((levels.sl - value) / range) * 100));
}

export function PositionRailHorizontal({ sl, entry, tp1, tp2, tp3, currentPrice }: Levels) {
  const levels = { sl, entry, tp1, tp2, tp3 };
  const markerPct = currentPrice != null ? pct(levels, currentPrice) : null;

  return (
    <View style={styles.hContainer}>
      <View style={styles.hTrack}>
        <View style={[styles.hTick, styles.hTickSl, { left: `${pct(levels, sl)}%` }]} />
        <View style={[styles.hTick, styles.hTickEntry, { left: `${pct(levels, entry)}%` }]} />
        <View style={[styles.hTickSmall, { left: `${pct(levels, tp1)}%` }]} />
        <View style={[styles.hTickSmall, { left: `${pct(levels, tp2)}%` }]} />
        <View style={[styles.hTick, styles.hTickTp3, { left: `${pct(levels, tp3)}%` }]} />
        {markerPct != null && (
          <View style={[styles.hMarker, { left: `${markerPct}%` }]} />
        )}
      </View>
      <View style={styles.hLabels}>
        <Text style={styles.hLabel}>SL {sl}</Text>
        <Text style={[styles.hLabel, styles.hLabelGold]}>ENTRY {entry}</Text>
        <Text style={styles.hLabel}>TP3 {tp3}</Text>
      </View>
    </View>
  );
}

export function PositionRailVertical({ sl, entry, tp1, tp2, tp3, currentPrice }: Levels) {
  const rows: { label: string; value: number; color: string; big?: boolean }[] = [
    { label: 'SL', value: sl, color: colors.danger, big: true },
    { label: 'ENTRY', value: entry, color: colors.gold, big: true },
    { label: 'TP1', value: tp1, color: colors.textSecondary },
    { label: 'TP2', value: tp2, color: colors.textSecondary },
    { label: 'TP3', value: tp3, color: colors.iconGray, big: true },
  ];
  const levels = { sl, entry, tp1, tp2, tp3 };
  const markerPct = currentPrice != null ? pct(levels, currentPrice) : null;

  return (
    <View style={styles.vContainer}>
      <View style={styles.vLine} />
      {markerPct != null && (
        <View style={[styles.vMarker, { top: `${markerPct}%` }]} />
      )}
      {rows.map((row) => (
        <View key={row.label} style={styles.vRow}>
          <View style={[styles.vDot, { backgroundColor: row.color }]} />
          <Text style={[styles.vLabel, { color: row.color }]}>{row.label}</Text>
          <View style={styles.vFill} />
          <Text style={[styles.vValue, row.big && styles.vValueBig, { color: row.big ? row.color : colors.textPrimary }]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Horizontal (feed card) variant
  hContainer: { marginVertical: 10 },
  hTrack: { height: 16, position: 'relative', justifyContent: 'center' },
  hTick: { position: 'absolute', width: 2, height: 12, top: 2, marginLeft: -1 },
  hTickSmall: { position: 'absolute', width: 1, height: 8, top: 4, marginLeft: -0.5, backgroundColor: colors.neutralLine },
  hTickSl: { backgroundColor: colors.danger },
  hTickEntry: { backgroundColor: colors.gold, width: 2, height: 12 },
  hTickTp3: { backgroundColor: colors.iconGray },
  hMarker: {
    position: 'absolute', width: 9, height: 16, marginLeft: -4.5, borderRadius: 2,
    backgroundColor: colors.gold, shadowColor: colors.gold, shadowOpacity: 0.7, shadowRadius: 6, elevation: 4,
  },
  hLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  hLabel: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.5, color: colors.textQuaternary },
  hLabelGold: { color: colors.gold },

  // Vertical (detail screen) variant
  vContainer: { position: 'relative', paddingLeft: 8 },
  vLine: { position: 'absolute', left: 8, top: 6, bottom: 6, width: 1, backgroundColor: colors.border },
  vMarker: {
    position: 'absolute', left: 4, width: 9, height: 9, borderRadius: 5, marginTop: -4.5,
    backgroundColor: colors.gold, shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  vDot: { width: 7, height: 7, borderRadius: 4, marginLeft: -3.5 },
  vLabel: { width: 38, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 },
  vFill: { flex: 1, height: 1, backgroundColor: colors.border },
  vValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary },
  vValueBig: { fontFamily: fonts.monoBold, fontSize: 13 },
});
