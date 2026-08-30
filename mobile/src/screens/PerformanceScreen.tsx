import { useId, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Polygon, Polyline, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePerformance } from '../api/hooks';
import StatCard from '../components/StatCard';
import { Colors, fonts, radius, spacing, useTheme, withAlpha } from '../theme';

const CHART_W = 320;
const CHART_H = 112;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

function EquityChart({ points }: { points: { closed_at: string; cumulative_r: number }[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const gradientId = useId();

  if (points.length < 2) {
    return (
      <View style={[styles.chartPlaceholder, { height: CHART_H }]}>
        <Text style={styles.emptyText}>Not enough closed trades yet for a curve.</Text>
      </View>
    );
  }

  const values = points.map((p) => p.cumulative_r);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const usableH = CHART_H - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * CHART_W;
    const y = PAD_TOP + usableH - ((p.cumulative_r - min) / range) * usableH;
    return [x, y] as const;
  });
  const lineStr = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const fillStr = `${lineStr} ${CHART_W},${CHART_H} 0,${CHART_H}`;
  const gridLines = [0.25, 0.5, 0.75].map((f) => PAD_TOP + usableH * f);

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {gridLines.map((y) => (
        <Line key={y} x1={0} y1={y} x2={CHART_W} y2={y} stroke={colors.surfaceElevated} strokeWidth={1} />
      ))}
      <Polygon points={fillStr} fill={`url(#${gradientId})`} />
      <Polyline points={lineStr} fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function ScoreBar({ score, n, winPct }: { score: number; n: number; winPct: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = winPct >= 70 ? colors.accent : winPct >= 50 ? colors.accentMuted : colors.accentDim;
  return (
    <View style={styles.scoreBarRow}>
      <Text style={styles.scoreBarLabel}>{score}/10</Text>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: `${winPct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.scoreBarPct}>{winPct.toFixed(0)}% · {n}</Text>
    </View>
  );
}

export default function PerformanceScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: perf, loading } = usePerformance();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>PERFORMANCE</Text>
        <Text style={styles.headerSubtitle}>ND DESK · ALL-TIME</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        {!perf && !loading && <Text style={styles.emptyText}>No performance data yet.</Text>}

        {perf && (
          <>
            <View style={styles.card}>
              <View style={styles.equityHeaderRow}>
                <Text style={styles.sectionKicker}>EQUITY — R MULTIPLE</Text>
                <Text style={styles.equityValue}>{perf.net_r >= 0 ? '+' : ''}{perf.net_r.toFixed(1)}R</Text>
              </View>
              <EquityChart points={perf.equity_curve} />
            </View>

            <View style={styles.statsRow}>
              <StatCard value={perf.profit_factor.toFixed(2)} label="PROFIT FACTOR" />
              <StatCard value={String(perf.best_streak)} label="BEST STREAK" />
              <StatCard value={perf.max_drawdown_r.toFixed(1)} unit="R" label="MAX DRAWDN" />
            </View>

            <Text style={styles.sectionTitle}>WIN RATE BY SCORE</Text>
            <View style={styles.card}>
              {perf.win_rate_by_score.length === 0 ? (
                <Text style={styles.emptyText}>No closed trades yet.</Text>
              ) : (
                perf.win_rate_by_score.map((b) => (
                  <ScoreBar key={b.score} score={b.score} n={b.n} winPct={b.win_pct} />
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>BY TIMEFRAME</Text>
            <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
              <View style={styles.tfHeaderRow}>
                <Text style={[styles.tfHeaderCell, { flex: 1 }]}>TF</Text>
                <Text style={[styles.tfHeaderCell, styles.tfColN]}>N</Text>
                <Text style={[styles.tfHeaderCell, styles.tfColWin]}>WIN%</Text>
                <Text style={[styles.tfHeaderCell, styles.tfColNet]}>NET R</Text>
              </View>
              {perf.by_timeframe.length === 0 ? (
                <Text style={[styles.emptyText, { padding: spacing.md }]}>No closed trades yet.</Text>
              ) : (
                perf.by_timeframe.map((t) => (
                  <View key={t.timeframe} style={styles.tfRow}>
                    <Text style={[styles.tfCell, styles.tfCellTf, { flex: 1 }]}>{t.timeframe}</Text>
                    <Text style={[styles.tfCell, styles.tfColN]}>{t.n}</Text>
                    <Text style={[styles.tfCell, styles.tfColWin]}>{t.win_pct.toFixed(0)}%</Text>
                    <Text style={[styles.tfCell, styles.tfColNet, { color: t.net_r >= 0 ? colors.accent : colors.danger }]}>
                      {t.net_r >= 0 ? '+' : ''}{t.net_r.toFixed(1)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg,
    },
    headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 2, color: colors.textPrimary },
    headerSubtitle: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1.5, color: colors.textQuaternary, marginTop: 2 },

    body: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    sectionKicker: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2, color: colors.accent },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2, color: colors.accent, marginBottom: spacing.sm },

    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
      padding: 14, marginBottom: spacing.md,
    },
    equityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
    equityValue: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },

    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

    scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
    scoreBarLabel: { width: 44, fontFamily: fonts.monoRegular, fontSize: 11, color: colors.textSecondary },
    scoreBarTrack: { flex: 1, height: 10, backgroundColor: colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
    scoreBarFill: { height: '100%' },
    scoreBarPct: { width: 60, textAlign: 'right', fontFamily: fonts.monoRegular, fontSize: 11, color: colors.textPrimary },

    tfHeaderRow: { flexDirection: 'row', padding: 10, backgroundColor: colors.surfaceElevated },
    tfHeaderCell: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1, color: colors.textQuaternary },
    tfRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: withAlpha(colors.border, 0.6) },
    tfCell: { fontFamily: fonts.monoRegular, fontSize: 11.5, color: colors.iconGray },
    tfCellTf: { fontFamily: fonts.monoBold, color: colors.textPrimary },
    tfColN: { width: 44, textAlign: 'right' },
    tfColWin: { width: 54, textAlign: 'right' },
    tfColNet: { width: 58, textAlign: 'right', fontFamily: fonts.monoBold },

    chartPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontFamily: fonts.sans, color: colors.textSecondary, textAlign: 'center' },
  });
}
