import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { apiFetch, apiPost } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { format, addDays } from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Instructors() {
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    apiFetch('/instructors').then(d => setInstructors(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, []);

  async function selectInstructor(inst: any) {
    setSelected(inst);
    setDetail(null);
    setLoadingDetail(true);
    setSelectedDate(''); setSelectedTime(''); setSlots([]);
    try {
      const d = await apiFetch(`/instructors/${inst.id}`);
      setDetail(d);
      const durations = d.sessionDurations ?? ['60'];
      setDuration(parseInt(durations[0]));
    } finally { setLoadingDetail(false); }
  }

  async function selectDate(date: string) {
    setSelectedDate(date); setSelectedTime(''); setLoadingSlots(true);
    try {
      const d = await apiFetch(`/instructors/${selected.id}?date=${date}&duration=${duration}`);
      setSlots(d.slots ?? []);
    } finally { setLoadingSlots(false); }
  }

  async function changeDuration(d: number) {
    setDuration(d); setSelectedTime('');
    if (selectedDate) {
      setLoadingSlots(true);
      try {
        const res = await apiFetch(`/instructors/${selected.id}?date=${selectedDate}&duration=${d}`);
        setSlots(res.slots ?? []);
      } finally { setLoadingSlots(false); }
    }
  }

  function isDateAvailable(date: string): boolean {
    if (!detail) return false;
    const d = new Date(date + 'T12:00:00');
    const dayName = DAY_NAMES[d.getDay()];
    if (detail.unavailableDates?.includes(date)) return false;
    const sched = detail.availabilitySchedule;
    if (sched && typeof sched === 'object') {
      return !!(sched[dayName] && sched[dayName].length > 0);
    }
    return detail.availability?.some((a: any) => a.dayOfWeek === d.getDay()) ?? false;
  }

  async function requestBooking() {
    if (!selectedDate || !selectedTime) { Alert.alert('Required', 'Please select a date and time'); return; }
    setBooking(true);
    try {
      const startsAt = `${selectedDate}T${selectedTime}:00`;
      const res = await apiPost('/pt-bookings', {
        instructorId: selected.id,
        startsAt,
        durationMins: duration,
        notes: ''
      });
      const price = duration === 30 && detail?.rate30Min > 0 ? detail.rate30Min : detail?.hourlyRate;
      if (price > 0) {
        const intentRes = await apiPost('/stripe/payment-intent', { type: 'pt_booking', ptBookingId: res.id });
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
          type: 'pt_booking',
          ptBookingId: res.id,
        });
        Alert.alert('Booked!', 'Your PT session has been booked and paid.');
        setSelected(null); setDetail(null); setSelectedDate(''); setSelectedTime(''); setSlots([]);
      } else {
        Alert.alert('Request Sent!', 'Your PT session request has been sent. The instructor will confirm shortly.');
        setSelected(null); setDetail(null); setSelectedDate(''); setSelectedTime(''); setSlots([]);
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBooking(false); }
  }

  function getEndTime(startTime: string, durationMins: number): string {
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m + durationMins;
    return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.white} /></View>;

  if (!selected) return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Personal Trainers</Text>
      <Text style={s.pageSub}>Book a 1-on-1 session with one of our instructors</Text>
      {instructors.length === 0 && <Text style={s.empty}>No instructors available</Text>}
      {instructors.map(inst => (
        <TouchableOpacity key={inst.id} style={s.card} onPress={() => selectInstructor(inst)}>
          <View style={s.cardTop}>
            <View style={s.avatar}><Text style={s.avatarText}>{inst.firstName[0]}{inst.lastName[0]}</Text></View>
            <View style={s.cardInfo}>
              <Text style={s.instName}>{inst.firstName} {inst.lastName}</Text>
              {inst.specialities?.length > 0 && <Text style={s.specialties}>{inst.specialities.join(' · ')}</Text>}
              <Text style={s.rate}>{inst.hourlyRate > 0 ? `£${inst.hourlyRate}/hr` : 'Contact for pricing'}{inst.rate30Min > 0 ? ` · £${inst.rate30Min}/30min` : ''}</Text>
            </View>
          </View>
          <View style={s.bookLinkRow}><Text style={s.bookLinkText}>Book a session →</Text></View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => { setSelected(null); setDetail(null); }}>
        <Text style={s.back}>← Back to instructors</Text>
      </TouchableOpacity>

      {loadingDetail ? <ActivityIndicator color={Colors.white} style={{ marginTop: 24 }} /> : detail && (
        <>
          <View style={s.detailHeader}>
            <View style={s.avatarLg}><Text style={s.avatarLgText}>{selected.firstName[0]}{selected.lastName[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{selected.firstName} {selected.lastName}</Text>
              {detail.specialities?.length > 0 && <Text style={s.specialties}>{detail.specialities.join(' · ')}</Text>}
              <Text style={s.rate}>{detail.hourlyRate > 0 ? `£${detail.hourlyRate}/hr` : ''}{detail.rate30Min > 0 ? ` · £${detail.rate30Min}/30min` : ''}</Text>
            </View>
          </View>
          {detail.bio && <Text style={s.bio}>{detail.bio}</Text>}

          <Text style={s.sectionTitle}>Book a Session</Text>

          {/* Duration selector */}
          {detail.sessionDurations?.length > 1 && (
            <View style={s.durationSection}>
              <Text style={s.label}>Session Duration</Text>
              <View style={s.durationRow}>
                {detail.sessionDurations.map((d: string) => (
                  <TouchableOpacity key={d} style={[s.durationBtn, duration === parseInt(d) && s.durationBtnActive]}
                    onPress={() => changeDuration(parseInt(d))}>
                    <Text style={[s.durationText, duration === parseInt(d) && s.durationTextActive]}>{d} min</Text>
                    {parseInt(d) === 30 && detail.rate30Min > 0 && <Text style={[s.durationPrice, duration === parseInt(d) && s.durationTextActive]}>£{detail.rate30Min}</Text>}
                    {parseInt(d) === 60 && detail.hourlyRate > 0 && <Text style={[s.durationPrice, duration === parseInt(d) && s.durationTextActive]}>£{detail.hourlyRate}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Date picker */}
          <Text style={s.label}>Select a Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.datePickerContent}>
            {dates.map(date => {
              const d = new Date(date + 'T12:00:00');
              const available = isDateAvailable(date);
              return (
                <TouchableOpacity key={date} style={[s.dateBtn, selectedDate === date && s.dateBtnActive, !available && s.dateBtnUnavail]}
                  onPress={() => available && selectDate(date)} disabled={!available}>
                  <Text style={[s.dateBtnDay, selectedDate === date && s.dateBtnTextActive]}>{format(d, 'EEE')}</Text>
                  <Text style={[s.dateBtnNum, selectedDate === date && s.dateBtnTextActive]}>{format(d, 'd')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time slots */}
          {selectedDate && (
            <View>
              <Text style={s.label}>Available Times</Text>
              {loadingSlots ? <ActivityIndicator color={Colors.white} /> :
                slots.length === 0 ? <Text style={s.noSlots}>No available slots for this date</Text> :
                <View style={s.slotsGrid}>
                  {slots.map(slot => (
                    <TouchableOpacity key={slot} style={[s.slotBtn, selectedTime === slot && s.slotBtnActive]}
                      onPress={() => setSelectedTime(slot)}>
                      <Text style={[s.slotText, selectedTime === slot && s.slotTextActive]}>
                        {slot}–{getEndTime(slot, duration)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              }
            </View>
          )}

          {/* Booking summary */}
          {selectedDate && selectedTime && (() => {
            const sessionPrice = duration === 30 && detail?.rate30Min > 0 ? detail.rate30Min : detail?.hourlyRate;
            return (
            <View style={s.summary}>
              <Text style={s.summaryTitle}>Your Booking</Text>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Trainer</Text><Text style={s.summaryValue}>{detail.firstName} {detail.lastName}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Date</Text><Text style={s.summaryValue}>{format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMMM')}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Time</Text><Text style={s.summaryValue}>{selectedTime}–{getEndTime(selectedTime, duration)}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Duration</Text><Text style={s.summaryValue}>{duration} min</Text></View>
              {sessionPrice > 0 && (
                <View style={[s.summaryRow, s.summaryTotal]}>
                  <Text style={s.summaryTotalLabel}>Total</Text>
                  <Text style={s.summaryTotalValue}>£{Number(sessionPrice).toFixed(2)}</Text>
                </View>
              )}
              <TouchableOpacity style={[s.bookNowBtn, booking && { opacity: 0.6 }]} onPress={requestBooking} disabled={booking}>
                <Text style={s.bookNowText}>
                  {booking ? 'Booking...' : sessionPrice > 0 ? `Book — £${Number(sessionPrice).toFixed(2)}` : 'Request Session'}
                </Text>
              </TouchableOpacity>
            </View>
            );
          })()}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  back: { color: Colors.textMuted, fontSize: 14 },
  pageTitle: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  pageSub: { color: Colors.textMuted, fontSize: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceHigh, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  cardInfo: { flex: 1, gap: 2 },
  instName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  specialties: { color: Colors.textMuted, fontSize: 12 },
  rate: { color: Colors.textSub, fontSize: 13, fontWeight: '600' },
  bookLinkRow: { backgroundColor: Colors.surfaceHigh, padding: 10, borderRadius: 8, alignItems: 'center' },
  bookLinkText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  detailHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarLg: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceHigh, justifyContent: 'center', alignItems: 'center' },
  avatarLgText: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  detailName: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  bio: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  label: { color: Colors.textMuted, fontSize: 13, marginBottom: 6 },
  durationSection: { gap: 6 },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  durationBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  durationText: { color: Colors.textMuted, fontWeight: '700', fontSize: 15 },
  durationTextActive: { color: Colors.bg },
  durationPrice: { color: Colors.textFaint, fontSize: 12, marginTop: 2 },
  datePickerContent: { gap: 8, paddingBottom: 4 },
  dateBtn: { width: 52, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dateBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  dateBtnUnavail: { opacity: 0.25 },
  dateBtnDay: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  dateBtnNum: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  dateBtnTextActive: { color: Colors.bg },
  noSlots: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  slotBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  slotText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  slotTextActive: { color: Colors.bg },
  summary: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  summaryTitle: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: Colors.textMuted, fontSize: 14 },
  summaryValue: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  summaryTotalValue: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  bookNowBtn: { backgroundColor: Colors.white, padding: 16, borderRadius: 12, alignItems: 'center' },
  bookNowText: { color: Colors.bg, fontWeight: '700', fontSize: 16 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});
