import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { WithTabBar } from '@/components/WithTabBar';

function fmtDate(iso: string) { try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; } }
function fmtTime(iso: string) { try { return format(new Date(iso), 'HH:mm'); } catch { return ''; } }

export default function ChildPT() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [child, setChild] = useState<any>(null);
  useEffect(() => { apiFetch(`/family/children/${id}`).then(setChild).catch(() => {}); }, [id]);

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'PT Sessions' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.bookBtn} onPress={() => router.push('/(tabs)/instructors')} activeOpacity={0.8}>
          <Text style={s.bookBtnText}>+ Book a PT session</Text>
        </TouchableOpacity>
        {(!child?.ptBookings || child.ptBookings.length === 0) && <Text style={s.empty}>No PT sessions yet</Text>}
        {(child?.ptBookings ?? []).map((b: any) => (
          <View key={b.id} style={s.card}>
            <Text style={s.cardName}>{b.instructor?.firstName} {b.instructor?.lastName}</Text>
            <Text style={s.cardMeta}>{b.startsAt ? fmtDate(b.startsAt) + ' · ' + fmtTime(b.startsAt) : ''}{b.endsAt ? '–' + fmtTime(b.endsAt) : ''}</Text>
            <View style={[s.badge, b.status === 'CONFIRMED' ? s.badgeGreen : s.badgeAmber]}>
              <Text style={s.badgeText}>{b.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', borderLeftWidth: 4, borderLeftColor: '#8b5cf6', gap: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#a0a0a0' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  badgeAmber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 48, fontSize: 14 },
  bookBtn: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, alignItems: 'center' },
  bookBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
});
