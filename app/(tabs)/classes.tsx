import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { format, addDays, startOfDay } from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native';

export default function Classes() {
  const { refresh: refreshMember } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [booking, setBooking] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));

  async function load() {
    const from = new Date().toISOString();
    const to = addDays(new Date(), 60).toISOString();
    const data = await apiFetch(`/classes?from=${from}&to=${to}`);
    setClasses(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    if (classes.length > 0) {
      const firstIdx = days.findIndex(day =>
        classes.some(c => { const d = new Date(c.startsAt); return d >= day && d < addDays(day, 1); })
      );
      if (firstIdx >= 0) setSelectedDay(firstIdx);
    }
  }, [classes]);

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  // All upcoming classes sorted by date
  const allUpcoming = [...classes].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Classes for selected day
  const dayClasses = classes.filter(c => {
    const d = new Date(c.startsAt);
    return d >= days[selectedDay] && d < addDays(days[selectedDay], 1);
  });

  async function handleBook(cls: any) {
    if (booking) return;
    setBooking(cls.id);
    try {
      if (cls.planPrice !== null && cls.planPrice !== undefined && cls.planPrice > 0) {
        const bookRes = await apiPost(`/classes/${cls.id}/book`, { pending: true });
        const intentRes = await apiPost('/stripe/payment-intent', { type: 'class_booking', classId: cls.id, bookingId: bookRes.bookingId });
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intentRes.clientSecret,
          merchantDisplayName: 'Crusader 9 Boxing',
          style: 'alwaysDark',
        });
        if (initError) { Alert.alert('Error', initError.message); return; }
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) { if (presentError.code !== 'Canceled') Alert.alert('Payment failed', presentError.message); return; }
        await apiPost('/stripe/confirm-booking', {
          paymentIntentId: intentRes.clientSecret.split('_secret_')[0],
          type: 'class_booking',
          bookingId: bookRes.bookingId,
        });
        await refreshMember();
        await load();
        Alert.alert('Booked!', `You\'re booked into ${cls.classType?.name}`);
      } else {
        await apiPost(`/classes/${cls.id}/book`, {});
        await refreshMember();
        await load();
        Alert.alert('Booked!', `You\'re booked into ${cls.classType?.name ?? cls.ClassType?.name}`);
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBooking(null); }
  }

  async function handleCancel(cls: any) {
    Alert.alert('Cancel Booking', 'Are you sure?', [
      { text: 'No' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        try { await apiDelete(`/classes/${cls.id}/book`); await refreshMember(); await load(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  function ClassCard({ cls }: { cls: any }) {
    const typeName = cls.classType?.name ?? cls.ClassType?.name ?? 'Class';
    const typeColor = cls.classType?.color ?? cls.ClassType?.color ?? Colors.border;
    const duration = cls.classType?.duration ?? cls.ClassType?.duration ?? 60;
    const isFull = cls.spotsLeft <= 0 && !cls.isBooked;
    const isLoading = booking === cls.id;
    return (
      <View style={[s.card, cls.isBooked && s.cardBooked, { borderLeftColor: typeColor }]}>
        <View style={s.cardHeader}>
          <View style={s.cardInfo}>
            <Text style={s.className}>{typeName}</Text>
            <Text style={s.classTime}>
              {format(new Date(cls.startsAt), 'EEE d MMM')} · {format(new Date(cls.startsAt), 'HH:mm')}–{format(new Date(cls.endsAt), 'HH:mm')} · {duration}min
            </Text>
            {cls.instructor && <Text style={s.instructor}>{cls.instructor}</Text>}
            {cls.location && <Text style={s.location}>{cls.location}</Text>}
          </View>
          <View style={s.cardActions}>
            <Text style={s.spots}>{isFull ? '🔴 Full' : `${cls.spotsLeft} left`}</Text>
            {!isFull && (
              <TouchableOpacity style={[s.bookBtn, cls.isBooked && s.cancelBtn, isLoading && s.bookBtnLoading]}
                onPress={() => cls.isBooked ? handleCancel(cls) : handleBook(cls)} disabled={isLoading}>
                <Text style={[s.bookBtnText, cls.isBooked && s.cancelBtnText]}>
                  {isLoading ? '...' : cls.isBooked ? 'Cancel' : cls.planPrice > 0 ? `Pay £${Number(cls.planPrice).toFixed(2)}` : 'Book'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={s.tags}>
          {cls.isBooked && <View style={s.tagBooked}><Text style={s.tagBookedText}>✓ Booked</Text></View>}
          {!cls.isBooked && cls.includedInPlan && <View style={s.tagIncluded}><Text style={s.tagIncludedText}>Included in plan</Text></View>}
          {!cls.isBooked && !cls.includedInPlan && cls.planPrice > 0 && <View style={s.tagPaid}><Text style={s.tagPaidText}>£{cls.planPrice?.toFixed(2)}</Text></View>}
        </View>
      </View>
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.white} /></View>;

  return (
    <View style={s.container}>
      {/* Day picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayPicker} contentContainerStyle={s.dayPickerContent}>
        {days.map((day, i) => {
          const hasClasses = classes.some(c => { const d = new Date(c.startsAt); return d >= day && d < addDays(day, 1); });
          return (
            <TouchableOpacity key={i} style={[s.dayBtn, selectedDay === i && s.dayBtnActive, !hasClasses && s.dayBtnEmpty]} onPress={() => setSelectedDay(i)}>
              <Text style={[s.dayName, selectedDay === i && s.dayTextActive]}>{format(day, 'EEE')}</Text>
              <Text style={[s.dayNum, selectedDay === i && s.dayTextActive]}>{format(day, 'd')}</Text>
              {hasClasses && <View style={[s.dot, selectedDay === i && s.dotActive]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={s.list} contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.white} />}>

        {/* Selected day classes */}
        {dayClasses.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>{format(days[selectedDay], 'EEEE d MMMM').toUpperCase()}</Text>
            {dayClasses.map(cls => <ClassCard key={cls.id} cls={cls} />)}
          </View>
        )}

        {dayClasses.length === 0 && (
          <View style={s.emptyDay}>
            <Text style={s.emptyText}>No classes on {format(days[selectedDay], 'EEEE d MMMM')}</Text>
          </View>
        )}

        {/* All upcoming classes */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ALL UPCOMING CLASSES</Text>
          {allUpcoming.length === 0 && <Text style={s.emptyText}>No upcoming classes scheduled</Text>}
          {allUpcoming.map(cls => <ClassCard key={cls.id + '-all'} cls={cls} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  dayPicker: { maxHeight: 88, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dayPickerContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  dayBtn: { width: 52, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dayBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  dayBtnEmpty: { opacity: 0.35 },
  dayName: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  dayNum: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  dayTextActive: { color: Colors.bg },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.white, marginTop: 2 },
  dotActive: { backgroundColor: Colors.bg },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  section: { gap: 10 },
  sectionLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  emptyDay: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, gap: 8 },
  cardBooked: { borderColor: Colors.green },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardInfo: { flex: 1, gap: 2 },
  className: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  classTime: { color: Colors.textMuted, fontSize: 12 },
  instructor: { color: Colors.textSub, fontSize: 12 },
  location: { color: Colors.textFaint, fontSize: 11 },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  spots: { color: Colors.textMuted, fontSize: 11 },
  bookBtn: { backgroundColor: Colors.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  bookBtnLoading: { opacity: 0.5 },
  cancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.red },
  bookBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  cancelBtnText: { color: Colors.red },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tagBooked: { backgroundColor: Colors.greenBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagBookedText: { color: Colors.greenText, fontSize: 11, fontWeight: '700' },
  tagIncluded: { backgroundColor: Colors.greenBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagIncludedText: { color: Colors.greenText, fontSize: 11 },
  tagPaid: { backgroundColor: Colors.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagPaidText: { color: Colors.amberText, fontSize: 11, fontWeight: '600' },
});
