import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useSignals } from '../api/hooks';
import { SignalListItem } from '../types/signal';
import ScoreBadge from '../components/ScoreBadge';
import BrandFooter from '../components/BrandFooter';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;
type Tab = 'active' | 'done';

const PHASE_LABEL: Record<SignalListItem['phase'], string> = {
  at_entry: 'At entry',
  in_zone: 'In zone',
  near: 'Near zone',
};

const OUTCOME_LABEL: Record<'hit_sl' | 'hit_tp3', string> = {
  hit_sl: 'Stopped Out',
  hit_tp3: 'Target Hit',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso + 'Z').getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function TabSwitcher({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={styles.tabRow}>
      {(['active', 'done'] as Tab[]).map((t) => {
        const selected = t === tab;
        return (
          <TouchableOpacity
            key={t}
            style={[styles.tabButton, selected && styles.tabButtonSelected]}
            onPress={() => onChange(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
              {t === 'active' ? 'Active Trades' : 'Done Trades'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SignalFeedScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const { data, loading, error, refetch } = useSignals({ active: tab === 'active' });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const renderItem = ({ item }: { item: SignalListItem }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Detail', { signalId: item.id })}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.symbol}>{item.symbol}</Text>
        <Text style={styles.timeframe}>{item.timeframe}</Text>
      </View>
      <View style={styles.rowMiddle}>
        {item.status === 'active' ? (
          <>
            <Text style={styles.phase}>{PHASE_LABEL[item.phase]}</Text>
            <Text style={styles.meta}>R:R {item.rr}:1 · {relativeTime(item.created_at)}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.phase, item.status === 'hit_tp3' ? styles.outcomeWin : styles.outcomeLoss]}>
              {OUTCOME_LABEL[item.status as 'hit_sl' | 'hit_tp3']}
            </Text>
            <Text style={styles.meta}>
              Closed @ {item.closed_price ?? '—'} · {relativeTime(item.created_at)}
            </Text>
          </>
        )}
      </View>
      <ScoreBadge score={item.score} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TabSwitcher tab={tab} onChange={setTab} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        style={styles.list}
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={data && data.length > 0 ? undefined : styles.emptyContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.gold} colors={[colors.gold]} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {tab === 'active'
                ? 'No active signals yet. The scanner checks every 15 minutes.'
                : 'No closed trades yet.'}
            </Text>
          ) : null
        }
      />
      <BrandFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  tabRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonSelected: {
    backgroundColor: colors.goldDim,
    borderColor: colors.gold,
  },
  tabLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabLabelSelected: { color: colors.gold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  rowLeft: { width: 90 },
  symbol: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  timeframe: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  rowMiddle: { flex: 1 },
  phase: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  outcomeWin: { color: colors.gold },
  outcomeLoss: { color: colors.danger },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  error: { color: colors.danger, padding: spacing.md },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingHorizontal: spacing.lg },
});
