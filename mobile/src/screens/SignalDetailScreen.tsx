import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useSignalDetail } from '../api/hooks';
import { SignalDetail } from '../types/signal';
import ScoreBadge from '../components/ScoreBadge';
import FlagChecklist from '../components/FlagChecklist';
import FibLadderTable from '../components/FibLadderTable';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

function tradingViewLink(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=BYBIT:${symbol}.P`;
}

function statusText(s: SignalDetail): { text: string; tone: 'active' | 'win' | 'loss' } {
  if (s.status === 'hit_tp3') return { text: `🏁 Target hit @ ${s.closed_price}`, tone: 'win' };
  if (s.status === 'hit_sl') return { text: `🛑 Stopped out @ ${s.closed_price}`, tone: 'loss' };
  if (s.at_entry) return { text: '🎯 Price is AT the fib entry right now', tone: 'active' };
  if (s.in_zone) return { text: '✅ Price is INSIDE the entry zone (fib level not tagged yet)', tone: 'active' };
  return { text: `⏳ ${s.distance_pct.toFixed(1)}% below the zone — waiting for the retrace up`, tone: 'active' };
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function SignalDetailScreen({ route }: Props) {
  const { signalId } = route.params;
  const { data: s, loading, error } = useSignalDetail(signalId);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (error || !s) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Signal not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{s.symbol}</Text>
          <Text style={styles.subtitle}>{s.timeframe} · {s.gainer_source === 'top_gainer' ? 'Top Gainer' : 'Impulsive Move'}</Text>
        </View>
        <ScoreBadge score={s.score} />
      </View>

      {(() => {
        const { text, tone } = statusText(s);
        return (
          <Text style={[styles.status, tone === 'win' && styles.statusWin, tone === 'loss' && styles.statusLoss]}>
            {text}
          </Text>
        );
      })()}

      <Section title="Market">
        <Row label="24h Gain" value={`+${s.gainer_pct24h.toFixed(1)}%`} />
        <Row label="24h Volume" value={`$${s.gainer_vol24h.toLocaleString()}`} />
        <Row label="24h High-Low Swing" value={`${s.gainer_move24h.toFixed(1)}%`} />
        <Row label="Funding" value={`${(s.gainer_funding_rate * 100).toFixed(4)}%`} />
        <Row label="Price" value={s.price_at_scan} />
      </Section>

      <Section title="Trade Plan">
        <Row label="Entry Zone" value={`${s.zone_low} – ${s.zone_high}`} />
        <Row label="Fib Entry" value={`${s.entry} (${s.entry_method})`} />
        <Row label="Stop Loss" value={s.sl} />
        <Row label="TP1" value={s.tp1} />
        <Row label="TP2" value={s.tp2} />
        <Row label="TP3" value={s.tp3} />
        <Row label="R:R at fib entry" value={`${s.rr}:1 (risk ${s.risk})`} />
        <Row label="R:R at zone edge" value={`${s.rr_zone_low}:1 (risk ${s.risk_zone_low})`} />
      </Section>

      <Section title="Confluences">
        <FlagChecklist flags={s.flags} />
      </Section>

      <Section title="Fib Ladder">
        <FibLadderTable title="OB levels" levels={s.fib_ob_levels} />
        <FibLadderTable title="Leg levels" levels={s.fib_leg_levels} />
      </Section>

      <TouchableOpacity style={styles.chartButton} onPress={() => Linking.openURL(tradingViewLink(s.symbol))}>
        <Text style={styles.chartButtonText}>📊 Open Chart on TradingView</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.3 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  status: { fontSize: 14, marginBottom: spacing.md, color: colors.textPrimary, fontWeight: '600' },
  statusWin: { color: colors.gold },
  statusLoss: { color: colors.danger },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dataLabel: { color: colors.textSecondary, fontSize: 14 },
  dataValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  chartButton: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  chartButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
