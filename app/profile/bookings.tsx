import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { apiFetch, apiDelete } from '@/lib/api';
import { format } from 'date-fns';
import { WithTabBar } from '@/components/WithTabBar';

function fmtDate(iso: string) { try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; } }
function fmtTime(iso: string) { try { return format(new Date(iso), 'HH:mm'); } catch { return ''; } }

export default function ProfileBookings() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() { try { setMe(await apiFetch('/me')); } catch {} }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleCancel(booking: any) {
    const className = booking.Class?.ClassType?.name ?? 'this class';
    const isPaid = booking.paymentType === 'PAID';
    Alert.alert('Cancel Booking', isPaid ? `Cancel ${className}? A refund will be issued.` : `Cancel ${className}?`, [
      { text: 'Keep booking' },
      { text: 'Cancel', style: 'destructive', onPress: async () => {
        try { await apiDelete(`/classes/${booking.Class?.id}/book`); await load(); Alert.alert('Cancelled', isPaid ? 'Booking cancelled and refund issued.' : 'Booking cancelled.'); }
        catch (e: any) { Alert.alert('Cannot Cancel', e.message); }
      }},
    ]);
  }

  const now = new Date();
  const upcoming = (me?.bookings ?? []).filter((b: any) => new Date(b.Class?.startsAt) >= now);
  const past = (me?.bookings ?? []).filter((b: any) => new Date(b.Class?.startsAt) < now);

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Bookings' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.bookBtn} onPress={() => router.push('/(tabs)/classes')} activeOpacity={0.8}>
          <Text style={s.bookBtnText}>+ Book a class</Text>
        </TouchableOpacity>
        {upcoming.length === 0 && past.length === 0 && !loading && <Text style={s.empty}>No bookings yet</Text>}
        {upcoming.length > 0 && <>
          <Text style={s.sectionLabel}>UPCOMING</Text>
          {upcoming.map((b: any) => {
            const color = b.Class?.ClassType?.color ?? '#3f3f46';
            return (
              <View key={b.id} style={[s.card, { borderLeftColor: color }]}>
                <View style={s.cardRow}>
                  <View style={s.cardInfo}>
                    <Text style={s.cardName}>{b.Class?.ClassType?.name ?? 'Class'}</Text>
                    <Text style={s.cardMeta}>{b.Class?.startsAt ? fmtDate(b.Class.startsAt) + ' · ' + fmtTime(b.Class.startsAt) : ''}{b.Class?.location ? ' · ' + b.Class.location : ''}</Text>
                    <View style={s.badge}><Text style={s.badgeText}>CONFIRMED</Text></View>
                  </View>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(b)}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>}
        {past.length > 0 && <>
          <Text style={s.sectionLabel}>PAST</Text>
          {past.map((b: any) => {
            const color = b.Class?.ClassType?.color ?? '#3f3f46';
            return (
              <View key={b.id} style={[s.card, { borderLeftColor: color, opacity: 0.6 }]}>
                <Text style={s.cardName}>{b.Class?.ClassType?.name ?? 'Class'}</Text>
                <Text style={s.cardMeta}>{b.Class?.startsAt ? fmtDate(b.Class.startsAt) + ' · ' + fmtTime(b.Class.startsAt) : ''}</Text>
              </View>
            );
          })}
        </>}
      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, marginTop: 4 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', borderLeftWidth: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#a0a0a0' },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginLeft: 10 },
  cancelBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 48, fontSize: 14 },
  bookBtn: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, alignItems: 'center' },
  bookBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
});
