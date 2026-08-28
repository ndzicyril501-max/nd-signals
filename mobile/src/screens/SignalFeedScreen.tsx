import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useSignals } from '../api/hooks';
import { SignalListItem } from '../types/signal';
import ScoreBadge from '../components/ScoreBadge';

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
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No signals yet. The scanner checks every 15 minutes.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowLeft: { width: 90 },
  symbol: { fontSize: 15, fontWeight: '700' },
  timeframe: { fontSize: 12, color: '#888' },
  rowMiddle: { flex: 1 },
  phase: { fontSize: 14, fontWeight: '500' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  error: { color: '#c0392b', padding: 12 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, paddingHorizontal: 24 },
});
