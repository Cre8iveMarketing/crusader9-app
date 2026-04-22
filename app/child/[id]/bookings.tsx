import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { WithTabBar } from '@/components/WithTabBar';

function fmtDate(iso: string) { try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; } }
function fmtTime(iso: string) { try { return format(new Date(iso), 'HH:mm'); } catch { return ''; } }

export default function ChildBookings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [child, setChild] = useState<any>(null);
  useEffect(() => { apiFetch(`/family/children/${id}`).then(setChild).catch(() => {}); }, [id]);

  const now = new Date();
  const upcoming = (child?.bookings ?? []).filter((b: any) => new Date(b.Class?.startsAt) >= now && b.status !== 'CANCELLED');
  const past = (child?.bookings ?? []).filter((b: any) => new Date(b.Class?.startsAt) < now && b.status !== 'CANCELLED');

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Bookings' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.bookBtn} onPress={() => router.push('/(tabs)/classes')} activeOpacity={0.8}>
          <Text style={s.bookBtnText}>+ Book a class</Text>
        </TouchableOpacity>
        {upcoming.length === 0 && past.length === 0 && <Text style={s.empty}>No bookings yet</Text>}
        {upcoming.length > 0 && <>
          <Text style={s.sectionLabel}>UPCOMING</Text>
          {upcoming.map((b: any) => (
            <View key={b.id} style={[s.card, { borderLeftColor: b.Class?.ClassType?.color ?? '#3f3f46' }]}>
              <Text style={s.cardName}>{b.Class?.ClassType?.name ?? 'Class'}</Text>
              <Text style={s.cardMeta}>{b.Class?.startsAt ? fmtDate(b.Class.startsAt) + ' · ' + fmtTime(b.Class.startsAt) : ''}{b.Class?.location ? ' · ' + b.Class.location : ''}</Text>
              <View style={s.badge}><Text style={s.badgeText}>CONFIRMED</Text></View>
            </View>
          ))}
        </>}
        {past.length > 0 && <>
          <Text style={s.sectionLabel}>PAST</Text>
          {past.map((b: any) => (
            <View key={b.id} style={[s.card, { borderLeftColor: '#3f3f46', opacity: 0.6 }]}>
              <Text style={s.cardName}>{b.Class?.ClassType?.name ?? 'Class'}</Text>
              <Text style={s.cardMeta}>{b.Class?.startsAt ? fmtDate(b.Class.startsAt) + ' · ' + fmtTime(b.Class.startsAt) : ''}</Text>
            </View>
          ))}
        </>}
        <Text style={s.hint}>To cancel a booking, contact gym staff.</Text>
      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, marginTop: 4 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', borderLeftWidth: 4, gap: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#a0a0a0' },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 48, fontSize: 14 },
  hint: { color: '#3f3f46', fontSize: 11, textAlign: 'center', marginTop: 8 },
  bookBtn: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, alignItems: 'center' },
  bookBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
});
