import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, Image } from 'react-native';
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
  const [upcomingPt, setUpcomingPt] = useState<any[]>([]);
  const [family, setFamily] = useState<any[]>([]);
  const [ptModal, setPtModal] = useState<{ context: any; candidates: any[] } | null>(null);
  const [ptSelectedCandidate, setPtSelectedCandidate] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    apiFetch('/instructors').then(d => setInstructors(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch('/pt-bookings').then(d => {
      const upcoming = (Array.isArray(d) ? d : [])
        .filter((b: any) => new Date(b.startsAt) >= new Date() && b.status !== 'CANCELLED')
        .sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      setUpcomingPt(upcoming);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch('/family').then(d => setFamily(d.children ?? [])).catch(() => {});
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

    // If parent has children, show who's this for modal
    if (family.length > 0 && detail) {
      const sessionPrice = duration === 30 && detail?.rate30Min > 0 ? detail.rate30Min : detail?.hourlyRate;
      const candidates = [
        { id: 'self', firstName: detail.selfFirstName ?? 'You', lastName: '', image: null, isSelf: true, dateOfBirth: null },
        ...family.map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, image: c.image, isSelf: false, dateOfBirth: c.dateOfBirth })),
      ];
      setPtModal({ context: { instructorName: `${selected.firstName} ${selected.lastName}`, startsAt: `${selectedDate}T${selectedTime}:00`, durationMins: duration, price: sessionPrice }, candidates });
      setPtSelectedCandidate(null);
      return;
    }

    await proceedWithPtBooking(null);
  }

  async function proceedWithPtBooking(forMemberId: string | null) {
    setBooking(true);
    try {
      const startsAt = `${selectedDate}T${selectedTime}:00`;
      const price = duration === 30 && detail?.rate30Min > 0 ? detail.rate30Min : detail?.hourlyRate;

      if (price > 0) {
        const intentRes = await apiPost('/stripe/payment-intent', {
          type: 'pt_booking',
          instructorId: selected.id,
          startsAt,
          durationMins: duration,
          forMemberId: forMemberId ?? '',
        });
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intentRes.clientSecret,
          merchantDisplayName: 'Crusader 9 Boxing',
          style: 'alwaysDark',
          returnURL: 'crusader9://stripe-success',
          applePay: { merchantCountryCode: 'GB' },
          googlePay: { merchantCountryCode: 'GB', currencyCode: 'GBP', testEnv: true },
        });
        if (initError) { Alert.alert('Error', initError.message); return; }

        setBooking(false);

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== 'Canceled') {
            Alert.alert('Payment failed', `code=${presentError.code} message=${presentError.message}`);
          }
          return;
        }

        Alert.alert('Booked!', 'Your PT session has been booked and paid.');
      } else {
        Alert.alert('Request Sent!', 'Your PT session request has been sent.');
      }
      setSelected(null); setDetail(null); setSelectedDate(''); setSelectedTime(''); setSlots([]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBooking(false);
    }
  }

  async function handlePtModalConfirm() {
    if (!ptSelectedCandidate) return;
    const candidate = ptModal?.candidates.find((c: any) => c.id === ptSelectedCandidate);
    const forMemberId = candidate?.isSelf ? null : ptSelectedCandidate;
    setPtModal(null);
    // Wait for iOS to fully dismiss the RN Modal before presenting Stripe
    await new Promise(resolve => setTimeout(resolve, 350));
    await proceedWithPtBooking(forMemberId);
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
      {upcomingPt.length > 0 && (
        <View style={{ marginTop: 8, gap: 10 }}>
          <Text style={s.upcomingLabel}>UPCOMING PT SESSIONS</Text>
          {upcomingPt.map((b: any) => (
            <View key={b.id} style={s.upcomingCard}>
              <View style={[s.upcomingBar, { backgroundColor: '#8b5cf6' }]} />
              <View style={s.upcomingInfo}>
                <Text style={s.upcomingName}>{b.instructor?.firstName} {b.instructor?.lastName}</Text>
                <Text style={s.upcomingMeta}>
                  {new Date(b.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
                  {' · '}
                  {new Date(b.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                  {'–'}
                  {new Date(b.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                </Text>
                <View style={[s.upcomingBadge, b.status === 'CONFIRMED' ? s.upcomingBadgeGreen : s.upcomingBadgeAmber]}>
                  <Text style={s.upcomingBadgeText}>{b.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
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

      {/* Who's this PT session for? Modal */}
      <Modal visible={!!ptModal} transparent animationType="none" onRequestClose={() => setPtModal(null)}>
        <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={() => setPtModal(null)}>
          <View style={pm.sheet} onStartShouldSetResponder={() => true}>
            <View style={pm.header}>
              <Text style={pm.headerLabel}>WHO'S THIS SESSION FOR?</Text>
              <Text style={pm.headerClass}>PT with {ptModal?.context?.instructorName}</Text>
              <Text style={pm.headerMeta}>
                {ptModal?.context?.startsAt ? new Date(ptModal.context.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : ''}
                {' · '}{ptModal?.context?.durationMins} min · £{ptModal?.context?.price?.toFixed(2)}
              </Text>
            </View>
            <ScrollView style={pm.list}>
              {(ptModal?.candidates ?? []).map((c: any) => {
                const isSelected = ptSelectedCandidate === c.id;
                const age = c.dateOfBirth ? Math.floor((Date.now() - new Date(c.dateOfBirth).getTime()) / (1000*60*60*24*365.25)) : null;
                return (
                  <TouchableOpacity key={c.id} style={[pm.row, isSelected && pm.rowSelected]} onPress={() => setPtSelectedCandidate(c.id)} activeOpacity={0.7}>
                    {c.image
                      ? <Image source={{ uri: c.image }} style={pm.avatar} />
                      : <View style={pm.avatarPlaceholder}><Text style={pm.avatarText}>{c.firstName[0]}{c.isSelf ? '' : c.lastName[0]}</Text></View>
                    }
                    <View style={pm.rowInfo}>
                      <Text style={pm.rowName}>{c.isSelf ? 'You' : `${c.firstName} ${c.lastName}`}</Text>
                      <Text style={pm.rowSub}>{c.isSelf ? 'Book for yourself' : age !== null ? `age ${age} · Junior member` : 'Junior member'}</Text>
                    </View>
                    <View style={[pm.radio, isSelected && pm.radioSelected]}>
                      {isSelected && <View style={pm.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={pm.footer}>
              <TouchableOpacity style={pm.cancelBtn} onPress={() => setPtModal(null)}>
                <Text style={pm.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[pm.confirmBtn, !ptSelectedCandidate && pm.confirmBtnDisabled]}
                onPress={handlePtModalConfirm} disabled={!ptSelectedCandidate}>
                <Text style={pm.confirmBtnText}>
                  {ptSelectedCandidate ? `Book — £${ptModal?.context?.price?.toFixed(2)}` : 'Select a member'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  slotBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, minWidth: '30%', alignItems: 'center' },
  slotBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  slotText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
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
  upcomingLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  upcomingCard: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', borderLeftWidth: 4, flexDirection: 'row', gap: 10 },
  upcomingBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  upcomingInfo: { flex: 1, gap: 4 },
  upcomingName: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  upcomingMeta: { fontSize: 12, color: '#a0a0a0' },
  upcomingBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  upcomingBadgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  upcomingBadgeAmber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  upcomingBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
});

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, marginBottom: 4 },
  headerClass: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  headerMeta: { fontSize: 12, color: '#a0a0a0', marginTop: 2 },
  list: { maxHeight: 280 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a22' },
  rowSelected: { backgroundColor: '#2a2a2a' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  rowSub: { fontSize: 12, color: '#a1a1aa' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#3f3f46', justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: '#ffffff' },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#ffffff' },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  cancelBtnText: { color: '#a0a0a0', fontSize: 14 },
  confirmBtn: { flex: 1, backgroundColor: '#ffffff', padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#2a2a2a' },
  confirmBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
});
