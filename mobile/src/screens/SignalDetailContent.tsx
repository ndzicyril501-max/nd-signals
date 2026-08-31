import { useMemo } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignalDetail } from '../api/hooks';
import PhaseChip from '../components/PhaseChip';
import PositionGauge from '../components/PositionGauge';
import { Colors, fonts, radius, spacing, useTheme, withAlpha } from '../theme';

interface Props {
  signalId: number;
  // Provided by the mobile stack route (renders a back arrow); omitted when
  // embedded as a split-view detail pane on web, where there's nothing to
  // navigate "back" from.
  onBack?: () => void;
}

function tradingViewLink(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=BYBIT:${symbol}.P`;
}

function statusText(s: {
  status: string; closed_price: number | null; at_entry: boolean; in_zone: boolean; distance_pct: number;
}): { text: string; tone: 'active' | 'win' | 'loss' } {
  if (s.status === 'hit_tp3') return { text: `Target hit @ ${s.closed_price}`, tone: 'win' };
  if (s.status === 'hit_sl') return { text: `Stopped out @ ${s.closed_price}`, tone: 'loss' };
  if (s.at_entry) return { text: 'Price is AT the fib entry right now', tone: 'active' };
  if (s.in_zone) return { text: 'Price is INSIDE the entry zone (fib level not tagged yet)', tone: 'active' };
  return { text: `${s.distance_pct.toFixed(1)}% below the zone — waiting for the retrace up`, tone: 'active' };
}

// The scanner bakes the point value into the flag's own name, e.g.
// "price at zone (+2)" -- split it back out for display instead of
// dropping that information on the floor.
function splitFlagLabel(name: string): { label: string; pts: string | null } {
  const m = /^(.*)\s\((\+\d+)\)$/.exec(name);
  return m ? { label: m[1], pts: m[2] } : { label: name, pts: null };
}

function Row({ label, value }: { label: string; value: string | number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function SignalDetailContent({ signalId, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: s, loading, error } = useSignalDetail(signalId);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        {s && (
          <>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerSymbol}>{s.symbol}</Text>
                <PhaseChip kind="short" />
              </View>
              <Text style={styles.headerMeta}>
                {s.timeframe} · {s.gainer_source === 'top_gainer' ? 'Top Gainer' : 'Impulsive Move'} · #{s.id}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.headerScore}>{s.score}</Text>
              <Text style={styles.headerScoreLabel}>SCORE/10</Text>
            </View>
          </>
        )}
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      {error && !loading && (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      {s && (
        <ScrollView style={styles.body} contentContainerStyle={styles.content}>
          {(() => {
            const { text, tone } = statusText(s);
            return (
              <View style={[styles.statusBanner, tone !== 'active' && { borderColor: tone === 'win' ? colors.accent : colors.danger }]}>
                <View style={[styles.statusDot, { backgroundColor: tone === 'loss' ? colors.danger : colors.accent }]} />
                <Text style={styles.statusText}>{text}</Text>
              </View>
            );
          })()}

          <Text style={styles.sectionTitle}>POSITION GAUGE</Text>
          <View style={styles.railCard}>
            <PositionGauge
              variant="detailed"
              sl={s.sl}
              entry={s.entry}
              tp1={s.tp1}
              tp2={s.tp2}
              tp3={s.tp3}
              currentPrice={s.last_price ?? s.price_at_scan}
            />
          </View>

          <Section title="TRADE PLAN">
            <View style={styles.card}>
              <Row label="Entry Zone" value={`${s.zone_low} – ${s.zone_high}`} />
              <Row label="Fib Entry" value={`${s.entry} (${s.entry_method})`} />
              <Row label="Stop Loss" value={`${s.sl} (${(((s.sl - s.entry) / s.entry) * 100).toFixed(2)}% from entry)`} />
              <Row label="R:R at fib entry" value={`${s.rr}:1 (risk ${s.risk})`} />
              <Row label="R:R at zone edge" value={`${s.rr_zone_low}:1 (risk ${s.risk_zone_low})`} />
              <Row label="24h Gain" value={`+${s.gainer_pct24h.toFixed(1)}%`} />
              <Row label="24h Volume" value={`$${s.gainer_vol24h.toLocaleString()}`} />
              <Row label="Funding" value={`${(s.gainer_funding_rate * 100).toFixed(4)}%`} />
              <Row label="Price at scan" value={s.price_at_scan} />
            </View>
          </Section>

          <Section title="CONFLUENCES">
            <View style={styles.card}>
              {Object.entries(s.flags).map(([name, earned]) => {
                const { label, pts } = splitFlagLabel(name);
                return (
                  <View key={name} style={styles.flagRow}>
                    <Text style={[styles.flagMark, { color: earned ? colors.accent : colors.textQuaternary }]}>
                      {earned ? '✓' : '—'}
                    </Text>
                    <Text style={[styles.flagLabel, { color: earned ? colors.iconGray : colors.textTertiary }]}>{label}</Text>
                    {pts && <Text style={styles.flagPts}>{pts}</Text>}
                  </View>
                );
              })}
            </View>
          </Section>

          <Section title="FIB LADDER — OB">
            <View style={styles.card}>
              {Object.entries(s.fib_ob_levels)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([ratio, price]) => (
                  <View key={ratio} style={styles.fibRow}>
                    <Text style={styles.fibRatio}>{Number(ratio).toFixed(3)}</Text>
                    <View style={styles.fibTrack}>
                      <View style={[styles.fibFill, { width: `${Number(ratio) * 100}%` }]} />
                    </View>
                    <Text style={styles.fibPrice}>{price}</Text>
                  </View>
                ))}
            </View>
          </Section>

          <TouchableOpacity style={styles.chartButton} onPress={() => Linking.openURL(tradingViewLink(s.symbol))}>
            <Text style={styles.chartButtonText}>Open on TradingView</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    error: { color: colors.danger },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing.md,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.headerBg,
    },
    backButton: {
      width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    backButtonText: { color: colors.accent, fontSize: 15 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    headerSymbol: { fontFamily: fonts.monoBold, fontSize: 19, letterSpacing: -0.4, color: colors.textPrimary },
    headerMeta: { fontFamily: fonts.monoRegular, fontSize: 10.5, letterSpacing: 1, color: colors.textQuaternary, marginTop: 3 },
    headerScore: { fontFamily: fonts.monoBold, fontSize: 17, color: colors.accent },
    headerScoreLabel: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1, color: colors.textQuaternary },

    body: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    statusBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 11, borderRadius: radius.sm, marginBottom: spacing.md,
      backgroundColor: withAlpha(colors.accent, 0.09), borderWidth: 1, borderColor: withAlpha(colors.accent, 0.3),
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accentBright },

    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2, color: colors.accent, marginBottom: 10 },
    section: { marginBottom: spacing.lg },
    railCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
      paddingHorizontal: 14, paddingBottom: 14, paddingTop: 28, marginBottom: spacing.lg,
    },
    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    dataRow: { flexDirection: 'row', paddingVertical: 5, gap: spacing.sm },
    dataLabel: { flexShrink: 0, maxWidth: '42%', fontFamily: fonts.sans, color: colors.textSecondary, fontSize: 13 },
    dataValue: { flex: 1, fontFamily: fonts.mono, fontSize: 12.5, color: colors.textPrimary, textAlign: 'right' },

    flagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    flagMark: { fontFamily: fonts.monoBold, fontSize: 12, width: 12 },
    flagLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5 },
    flagPts: { fontFamily: fonts.mono, fontSize: 11, color: colors.textQuaternary },

    fibRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    fibRatio: { width: 44, fontFamily: fonts.monoRegular, fontSize: 11, color: colors.textQuaternary },
    fibTrack: { flex: 1, height: 2, backgroundColor: colors.border, overflow: 'hidden' },
    fibFill: { height: '100%', backgroundColor: withAlpha(colors.accent, 0.35) },
    fibPrice: { fontFamily: fonts.monoRegular, fontSize: 11.5, color: colors.textPrimary },

    chartButton: {
      borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 12, alignItems: 'center', marginTop: spacing.sm,
    },
    chartButtonText: { fontFamily: fonts.sansMedium, color: colors.accent, fontSize: 12.5 },
  });
}
