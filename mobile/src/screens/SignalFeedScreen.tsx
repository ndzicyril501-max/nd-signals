import { ReactNode, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignals, useStatsSummary, usePerformance } from '../api/hooks';
import { SignalListItem } from '../types/signal';
import { ClosedLogEntry } from '../types/stats';
import ScoreBadge from '../components/ScoreBadge';
import PhaseChip from '../components/PhaseChip';
import PositionGauge from '../components/PositionGauge';
import StatCard from '../components/StatCard';
import ScanCountdown from '../components/ScanCountdown';
import { Colors, fonts, radius, spacing, useTheme, withAlpha } from '../theme';

type Tab = 'active' | 'done';

interface Props {
  onSelectSignal: (signalId: number) => void;
  // Web split-view only: which row (if any) is currently shown in the
  // adjoining detail pane, so the list can highlight it.
  selectedSignalId?: number | null;
  // Web split-view only: renders the list in a fixed-width left pane next to
  // this content instead of taking the full width (mobile has no such pane
  // -- it navigates to a full-screen detail route instead).
  rightPane?: ReactNode;
}

// Only 9/10+ setups are surfaced -- see backend/app/config.py's
// MIN_ALERT_SCORE, which gates alerting itself; this is the mobile-side
// mirror of that intent, not just a display filter.
const MIN_SCORE = 9;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso + 'Z').getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function unrealizedPct(entry: number, lastPrice: number | null): number | null {
  if (lastPrice == null) return null;
  return ((entry - lastPrice) / entry) * 100; // short: price falling from entry is favorable
}

function Header({ activeCount }: { activeCount: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: stats } = useStatsSummary();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>ND</Text>
        </View>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>NDGROUP TRADING DESK</Text>
          <Text style={styles.headerSubtitle}>SMC SHORT SCANNER</Text>
        </View>
        <ScanCountdown />
      </View>
      <View style={styles.statsRow}>
        <StatCard value={String(stats?.active_count ?? activeCount)} label="ACTIVE" />
        <StatCard value={stats ? stats.avg_score.toFixed(1) : '—'} label="AVG SCORE" accent />
        <StatCard value={stats ? stats.win_rate_pct.toFixed(1) : '—'} unit="%" label="WIN RATE" />
        <StatCard
          value={stats ? `${stats.net_r >= 0 ? '+' : ''}${stats.net_r.toFixed(1)}` : '—'}
          unit="R"
          label="NET"
          accent
        />
      </View>
    </View>
  );
}

function TabSwitcher({ tab, onChange, activeCount, doneCount }: { tab: Tab; onChange: (t: Tab) => void; activeCount: number; doneCount: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.tabRow}>
      {([
        { key: 'active' as Tab, label: 'ACTIVE TRADES', count: activeCount },
        { key: 'done' as Tab, label: 'DONE TRADES', count: doneCount },
      ]).map((t) => {
        const selected = t.key === tab;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabButton, selected && styles.tabButtonSelected]}
            onPress={() => onChange(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{t.label}</Text>
            <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
              <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ActiveCard({ item, onPress, selected }: { item: SignalListItem; onPress: () => void; selected?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pct = unrealizedPct(item.entry, item.last_price);
  return (
    <TouchableOpacity
      style={[styles.card, (item.phase === 'at_entry' || selected) && styles.cardHighlighted, selected && styles.cardSelected]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.cardTopRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardSymbol}>{item.symbol}</Text>
            <Text style={styles.cardTf}>{item.timeframe}</Text>
          </View>
          <View style={styles.cardChipRow}>
            <PhaseChip kind="short" />
            <PhaseChip kind={item.phase} />
            <Text style={styles.cardRr}>R:R {item.rr}</Text>
          </View>
        </View>
        <ScoreBadge score={item.score} />
      </View>

      <PositionGauge
        variant="compact"
        sl={item.sl}
        entry={item.entry}
        tp1={item.tp1}
        tp2={item.tp2}
        tp3={item.tp3}
        currentPrice={item.last_price}
      />

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterMeta}>{relativeTime(item.created_at)}</Text>
        <Text style={[styles.cardFooterDelta, pct != null && pct >= 0 && styles.cardFooterDeltaAccent]}>
          {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function DoneSummary() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: perf } = usePerformance();
  if (!perf) return null;
  const winPct = perf.win_rate_pct;
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeaderRow}>
        <Text style={styles.sectionKicker}>RECORD</Text>
        <Text style={styles.recordSub}>{perf.win_count + perf.loss_count} CLOSED</Text>
      </View>
      <View style={styles.recordMainRow}>
        <View>
          <Text style={styles.recordBig}>
            <Text style={{ color: colors.accent }}>{perf.win_count}</Text>
            <Text style={{ color: colors.textQuaternary, fontSize: 19 }}> – </Text>
            <Text style={{ color: colors.danger }}>{perf.loss_count}</Text>
          </Text>
          <Text style={styles.recordCaption}>WIN / LOSS</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.recordBig, { color: colors.textPrimary }]}>
            {perf.net_r >= 0 ? '+' : ''}{perf.net_r.toFixed(1)}
            <Text style={{ fontSize: 14, color: colors.accentMuted }}>R</Text>
          </Text>
          <Text style={styles.recordCaption}>NET RETURN</Text>
        </View>
      </View>
      <View style={styles.recordBar}>
        <View style={[styles.recordBarWin, { width: `${winPct}%` }]} />
        <View style={styles.recordBarLoss} />
      </View>
      <View style={styles.recordFootRow}>
        <Text style={styles.recordFoot}>{winPct.toFixed(1)}% win rate</Text>
        <Text style={styles.recordFoot}>avg win {perf.avg_win_r >= 0 ? '+' : ''}{perf.avg_win_r.toFixed(2)}R · avg loss {perf.avg_loss_r.toFixed(2)}R</Text>
      </View>
    </View>
  );
}

function ClosedRow({ item, onPress, selected }: { item: ClosedLogEntry; onPress: () => void; selected?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = item.outcome === 'TARGET' ? colors.accent : colors.danger;
  return (
    <TouchableOpacity style={[styles.closedRow, selected && styles.closedRowSelected]} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.closedBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.closedSymbol}>{item.symbol}</Text>
        <Text style={styles.closedMeta}>
          {item.timeframe} · CLOSED {item.closed_price} · {relativeTime(item.closed_at)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.closedR, { color }]}>{item.r >= 0 ? '+' : ''}{item.r}R</Text>
        <Text style={styles.closedOutcome}>{item.outcome}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function SignalFeedScreen({ onSelectSignal, selectedSignalId, rightPane }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('active');
  const { data: activeData, loading, error, refetch } = useSignals({ active: true, minScore: MIN_SCORE });
  const { data: doneData, refetch: refetchDone } = useSignals({ active: false, minScore: MIN_SCORE });
  const { data: perf, refetch: refetchPerf } = usePerformance();

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchDone();
      refetchPerf();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const activeCount = activeData?.length ?? 0;
  const doneCount = doneData?.length ?? 0;

  const list = tab === 'active' ? (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={activeData ?? []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <ActiveCard item={item} selected={item.id === selectedSignalId} onPress={() => onSelectSignal(item.id)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.accent} colors={[colors.accent]} />}
      ListEmptyComponent={
        !loading ? <Text style={styles.empty}>No active signals yet. The scanner checks periodically.</Text> : null
      }
    />
  ) : (
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
      <DoneSummary />
      {perf && perf.closed_log.length > 0 && (
        <View style={styles.closedLogCard}>
          <Text style={[styles.sectionKicker, { marginBottom: spacing.sm }]}>CLOSED LOG</Text>
          {perf.closed_log.map((item) => (
            <ClosedRow key={item.id} item={item} selected={item.id === selectedSignalId} onPress={() => onSelectSignal(item.id)} />
          ))}
        </View>
      )}
      {(!perf || perf.closed_log.length === 0) && <Text style={styles.empty}>No closed trades yet.</Text>}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Header activeCount={activeCount} />
      <TabSwitcher tab={tab} onChange={setTab} activeCount={activeCount} doneCount={doneCount} />

      {error && <Text style={styles.error}>{error}</Text>}

      {rightPane ? (
        <View style={styles.splitRow}>
          <View style={styles.splitListPane}>{list}</View>
          <View style={styles.splitDetailPane}>{rightPane}</View>
        </View>
      ) : (
        list
      )}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { flex: 1 },
    listContent: { padding: spacing.md },

    splitRow: { flex: 1, flexDirection: 'row' },
    splitListPane: { width: 380, borderRightWidth: 1, borderRightColor: colors.border },
    splitDetailPane: { flex: 1 },

    header: { backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: spacing.md },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md },
    brandMark: { width: 26, height: 26, borderWidth: 1.6, borderColor: colors.accent, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    brandMarkText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent },
    headerTitleBlock: { flex: 1 },
    headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, letterSpacing: 1, color: colors.textPrimary },
    headerSubtitle: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1.5, color: colors.textQuaternary, marginTop: 1 },
    statsRow: { flexDirection: 'row', marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },

    tabRow: { flexDirection: 'row', gap: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.background },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderTopLeftRadius: radius.sm,
      borderTopRightRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabButtonSelected: { backgroundColor: colors.surface, borderColor: colors.border, borderBottomColor: colors.surface },
    tabLabel: { fontFamily: fonts.monoBold, fontSize: 10.5, letterSpacing: 1, color: colors.textQuaternary },
    tabLabelSelected: { color: colors.accent },
    tabCount: { backgroundColor: colors.surfaceElevated, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1 },
    tabCountSelected: { backgroundColor: colors.accent },
    tabCountText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.textTertiary },
    tabCountTextSelected: { color: colors.background },

    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: 13,
    },
    cardHighlighted: {
      borderColor: withAlpha(colors.accent, 0.42),
      backgroundColor: colors.surfaceElevated,
    },
    cardSelected: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
    cardSymbol: { fontFamily: fonts.monoBold, fontSize: 16, color: colors.textPrimary, letterSpacing: -0.3 },
    cardTf: { fontFamily: fonts.monoRegular, fontSize: 10, color: colors.textQuaternary },
    cardChipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
    cardRr: { fontFamily: fonts.monoRegular, fontSize: 10, color: colors.textQuaternary },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 9,
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.7),
    },
    cardFooterMeta: { fontFamily: fonts.monoRegular, fontSize: 10, color: colors.textTertiary },
    cardFooterDelta: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textQuaternary },
    cardFooterDeltaAccent: { color: colors.accent },

    error: { color: colors.danger, padding: spacing.md },
    empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: spacing.xl },

    recordCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      padding: 15,
      marginBottom: spacing.md,
    },
    recordHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 },
    sectionKicker: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2, color: colors.accent },
    recordSub: { fontFamily: fonts.monoRegular, fontSize: 9.5, color: colors.textQuaternary },
    recordMainRow: { flexDirection: 'row', alignItems: 'baseline', gap: 14, marginBottom: 12 },
    recordBig: { fontFamily: fonts.monoBold, fontSize: 30, letterSpacing: -1 },
    recordCaption: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1.5, color: colors.textQuaternary, marginTop: 5 },
    recordBar: { flexDirection: 'row', height: 7, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 7 },
    recordBarWin: { backgroundColor: colors.accent },
    recordBarLoss: { flex: 1, backgroundColor: colors.danger, opacity: 0.65 },
    recordFootRow: { flexDirection: 'row', justifyContent: 'space-between' },
    recordFoot: { fontFamily: fonts.monoRegular, fontSize: 9.5, color: colors.textTertiary },

    closedLogCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      paddingTop: spacing.md,
    },
    closedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 11,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.border, 0.6),
    },
    closedRowSelected: {
      backgroundColor: colors.surfaceElevated,
    },
    closedBar: { width: 3, height: 26, borderRadius: 2 },
    closedSymbol: { fontFamily: fonts.monoBold, fontSize: 12.5, color: colors.textPrimary },
    closedMeta: { fontFamily: fonts.monoRegular, fontSize: 9.5, letterSpacing: 0.5, color: colors.textQuaternary, marginTop: 2 },
    closedR: { fontFamily: fonts.monoBold, fontSize: 12.5 },
    closedOutcome: { fontFamily: fonts.monoRegular, fontSize: 9, letterSpacing: 1, color: colors.textQuaternary, marginTop: 2 },
  });
}
