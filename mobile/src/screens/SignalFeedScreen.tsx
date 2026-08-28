import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useSignals } from '../api/hooks';
import { SignalListItem } from '../types/signal';
import ScoreBadge from '../components/ScoreBadge';
import BrandFooter from '../components/BrandFooter';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

const PHASE_LABEL: Record<SignalListItem['phase'], string> = {
  at_entry: 'At entry',
  in_zone: 'In zone',
  near: 'Near zone',
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

export default function SignalFeedScreen({ navigation }: Props) {
  const { data, loading, error, refetch } = useSignals();

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
        <Text style={styles.phase}>{PHASE_LABEL[item.phase]}</Text>
        <Text style={styles.meta}>R:R {item.rr}:1 · {relativeTime(item.created_at)}</Text>
      </View>
      <ScoreBadge score={item.score} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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
          !loading ? <Text style={styles.empty}>No signals yet. The scanner checks every 15 minutes.</Text> : null
        }
      />
      <BrandFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
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
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  error: { color: colors.danger, padding: spacing.md },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingHorizontal: spacing.lg },
});
