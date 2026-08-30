import { useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Colors, fonts, useTheme } from '../theme';

export interface Levels {
  sl: number;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  currentPrice?: number | null;
}

interface PositionGaugeProps extends Levels {
  variant: 'compact' | 'detailed';
}

// All these setups are SHORTS: sl is the highest price, tp3 the lowest.
// Percent-along-the-gauge is measured from sl (0%, left) to tp3 (100%,
// right), so a price closer to tp3 always reads further right regardless
// of the symbol's actual price scale.
export function pct(levels: Levels, value: number): number {
  const range = levels.sl - levels.tp3;
  if (range <= 0) return 50;
  return Math.min(100, Math.max(0, ((levels.sl - value) / range) * 100));
}

// The bar itself is always a saturated red->purple gradient regardless of
// theme, so ticks/needle are fixed white rather than theme-driven -- a
// theme-colored (esp. near-black light-mode) needle would disappear against
// either end of that gradient.
const ON_GAUGE_LIGHT = 'rgba(255,255,255,0.92)';
const ON_GAUGE_DIM = 'rgba(255,255,255,0.5)';

export default function PositionGauge({ sl, entry, tp1, tp2, tp3, currentPrice, variant }: PositionGaugeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const gradientId = useId();
  const levels = { sl, entry, tp1, tp2, tp3 };
  const markerPct = currentPrice != null ? pct(levels, currentPrice) : null;
  const barHeight = variant === 'detailed' ? 30 : 16;

  return (
    <View style={styles.container}>
      {variant === 'detailed' && markerPct != null && (
        <View style={[styles.currentBadgeWrap, { left: `${markerPct}%` }]}>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>{currentPrice} · CURRENT</Text>
          </View>
        </View>
      )}

      <View style={{ height: barHeight, borderRadius: 4, overflow: 'hidden' }}>
        <Svg width="100%" height={barHeight} viewBox={`0 0 100 ${barHeight}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.danger} />
              <Stop offset="1" stopColor={colors.accent} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={barHeight} fill={`url(#${gradientId})`} />
        </Svg>

        {/* Tick marks -- entry/sl/tp3 tall+bright, tp1/tp2 short+dim */}
        <View style={[styles.tick, styles.tickTall, { left: `${pct(levels, sl)}%` }]} />
        <View style={[styles.tick, styles.tickTall, { left: `${pct(levels, entry)}%` }]} />
        <View style={[styles.tick, styles.tickShort, { left: `${pct(levels, tp1)}%` }]} />
        <View style={[styles.tick, styles.tickShort, { left: `${pct(levels, tp2)}%` }]} />
        <View style={[styles.tick, styles.tickTall, { left: `${pct(levels, tp3)}%` }]} />

        {markerPct != null && <View style={[styles.needle, { left: `${markerPct}%` }]} />}
      </View>

      {variant === 'compact' ? (
        <View style={styles.compactLabels}>
          <Text style={styles.compactLabel}>SL {sl}</Text>
          <Text style={[styles.compactLabel, styles.compactLabelAccent]}>ENTRY {entry}</Text>
          <Text style={styles.compactLabel}>TP3 {tp3}</Text>
        </View>
      ) : (
        <View style={styles.detailedLabels}>
          {[
            { name: 'SL', value: sl, color: colors.danger },
            { name: 'ENTRY', value: entry, color: colors.accent },
            { name: 'TP1', value: tp1, color: colors.textSecondary },
            { name: 'TP2', value: tp2, color: colors.textSecondary },
            { name: 'TP3', value: tp3, color: colors.iconGray },
          ].map((row) => (
            <View key={row.name} style={[styles.detailedLabelWrap, { left: `${pct(levels, row.value)}%` }]}>
              <Text style={[styles.detailedLabelName, { color: row.color }]}>{row.name}</Text>
              <Text style={[styles.detailedLabelValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { marginVertical: 10 },

    tick: {
      position: 'absolute',
      width: 2,
      marginLeft: -1,
      backgroundColor: ON_GAUGE_LIGHT,
    },
    tickTall: { top: 2, bottom: 2 },
    tickShort: { top: 5, bottom: 5, backgroundColor: ON_GAUGE_DIM },

    needle: {
      position: 'absolute',
      top: -3,
      bottom: -3,
      width: 3,
      marginLeft: -1.5,
      borderRadius: 1.5,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.45)',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 3,
      elevation: 3,
    },

    compactLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    compactLabel: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.5, color: colors.textQuaternary },
    compactLabelAccent: { color: colors.accent },

    detailedLabels: { position: 'relative', height: 34, marginTop: 8 },
    detailedLabelWrap: { position: 'absolute', alignItems: 'center', transform: [{ translateX: -20 }], width: 40 },
    detailedLabelName: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1 },
    detailedLabelValue: { fontFamily: fonts.monoBold, fontSize: 10.5, marginTop: 2 },

    currentBadgeWrap: { position: 'absolute', top: -22, transform: [{ translateX: -30 }], width: 60, alignItems: 'center', zIndex: 1 },
    currentBadge: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
      borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surfaceElevated,
    },
    currentBadgeText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent },
  });
}
