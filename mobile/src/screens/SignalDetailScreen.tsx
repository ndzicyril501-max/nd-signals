import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useSignalDetail } from '../api/hooks';
import ScoreBadge from '../components/ScoreBadge';
import FlagChecklist from '../components/FlagChecklist';
import FibLadderTable from '../components/FibLadderTable';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

function tradingViewLink(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=BYBIT:${symbol}.P`;
}

function statusText(atEntry: boolean, inZone: boolean, distancePct: number): string {
  if (atEntry) return '🎯 Price is AT the fib entry right now';
  if (inZone) return '✅ Price is INSIDE the entry zone (fib level not tagged yet)';
  return `⏳ ${distancePct.toFixed(1)}% below the zone — waiting for the retrace up`;
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
      {children}
    </View>
  );
}

export default function SignalDetailScreen({ route }: Props) {
  const { signalId } = route.params;
  const { data: s, loading, error } = useSignalDetail(signalId);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
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

      <Text style={styles.status}>{statusText(s.at_entry, s.in_zone, s.distance_pct)}</Text>

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
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#c0392b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  status: { fontSize: 14, marginBottom: 16, color: '#333' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginBottom: 6 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  dataLabel: { color: '#666', fontSize: 14 },
  dataValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chartButton: { backgroundColor: '#1a73e8', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  chartButtonText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
