import { StyleSheet, Text, View } from 'react-native';

export default function ScoreBadge({ score }: { score: number }) {
  const color = score >= 9 ? '#1a8a4a' : score >= 8 ? '#c98a12' : '#888';
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{score}/10</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
});
