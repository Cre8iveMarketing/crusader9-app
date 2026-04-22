import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { WithTabBar } from '@/components/WithTabBar';

export default function ProfileTerms() {
  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Terms & Waiver' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.label}>WAIVER STATUS</Text>
          <View style={s.waiverBox}>
            <Text style={s.waiverTitle}>No waiver on file</Text>
            <Text style={s.waiverDesc}>Please contact reception to complete your waiver.</Text>
          </View>
        </View>
      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 48 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  label: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  waiverBox: { backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 10, padding: 14, gap: 4 },
  waiverTitle: { color: '#fbbf24', fontWeight: '700', fontSize: 14 },
  waiverDesc: { color: '#a0a0a0', fontSize: 13 },
});
