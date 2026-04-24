import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal, Image } from 'react-native';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { format, addDays, startOfDay } from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native';

export default function Classes() {
  const { member, refresh: refreshMember } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [family, setFamily] = useState<any[]>([]);
  const [bookModal, setBookModal] = useState<{ cls: any; candidates: any[] } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, any>>({});
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
    apiFetch('/family').then(d => setFamily(d.children ?? [])).catch(() => {});
  }, []);

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
    if (activeClassId === cls.id) return;

    // If parent has children, show member picker
    if (family.length > 0 && member) {
      const candidates = [
        { id: member.memberInternalId ?? member.id, firstName: member.firstName, lastName: member.lastName, image: member.image, isSelf: true, dateOfBirth: null },
        ...family.map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, image: c.image, isSelf: false, dateOfBirth: c.dateOfBirth })),
      ];
      setBookModal({ cls, candidates });
      setSelectedCandidate(null);
      setEligibility({});
      candidates.forEach(async (c) => {
        try {
          const res = await apiFetch(`/classes/${cls.id}/eligibility?for=${c.id}`);
          setEligibility(prev => ({ ...prev, [c.id]: res }));
        } catch {
          setEligibility(prev => ({ ...prev, [c.id]: { error: true } }));
        }
      });
      return;
    }

    // No children — book directly for self
    await proceedWithBooking(cls, null);
  }

  async function proceedWithBooking(cls: any, forMemberId: string | null) {
    setActiveClassId(cls.id);
    try {
      const targetId = forMemberId ?? member?.memberInternalId ?? member?.id ?? '';
      const elig = await apiFetch(`/classes/${cls.id}/eligibility?for=${targetId}`);

      if (elig.eligibleForFree) {
        await apiPost(`/classes/${cls.id}/book`, { ...(forMemberId && { forMemberId }) });
        await refreshMember();
        await load();
        Alert.alert('Booked!', `Booking confirmed!`);
        return;
      }

      const intentRes = await apiPost('/stripe/payment-intent', {
        type: 'class_booking',
        classId: cls.id,
        forMemberId: forMemberId ?? '',
      });
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intentRes.clientSecret,
        merchantDisplayName: 'Crusader 9 Boxing',
        style: 'alwaysDark',
        returnURL: 'crusader9://stripe-success',
        applePay: { merchantCountryCode: 'GB' },
      });
      if (initError) { Alert.alert('Error', initError.message); return; }

      setActiveClassId(null);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment failed', `code=${presentError.code} message=${presentError.message}`);
        }
        return;
      }

      await refreshMember();
      await load();
      Alert.alert('Booked!', `Booking confirmed!`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Booking failed');
    } finally {
      setActiveClassId(null);
    }
  }

  async function handleModalConfirm() {
    if (!bookModal || !selectedCandidate) return;
    const candidate = bookModal.candidates.find(c => c.id === selectedCandidate);
    const forMemberId = candidate?.isSelf ? null : selectedCandidate;
    setBookModal(null);
    await proceedWithBooking(bookModal.cls, forMemberId);
  }

  async function handleCancel(cls: any) {
    const bookings = cls.familyBookings ?? [];

    if (bookings.length > 1) {
      // Multiple family members booked — ask who to cancel for
      Alert.alert(
        'Cancel Booking',
        'Who would you like to cancel for?',
        [
          ...bookings.map((b: any) => ({
            text: b.name,
            style: 'destructive' as const,
            onPress: () => confirmCancel(cls, b.bookingId, b.memberId),
          })),
          { text: 'Keep all bookings', style: 'cancel' as const },
        ]
      );
    } else {
      // Single booking
      Alert.alert('Cancel Booking', 'Are you sure?', [
        { text: 'No' },
        { text: 'Yes, cancel', style: 'destructive', onPress: () => confirmCancel(cls, bookings[0]?.bookingId ?? cls.myBookingId, bookings[0]?.memberId ?? null) },
      ]);
    }
  }

  async function confirmCancel(cls: any, bookingId: string, memberId: string | null) {
    setActiveClassId(cls.id);
    try {
      await apiDelete(`/classes/${cls.id}/book`);
      await refreshMember();
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActiveClassId(null); }
  }

  function ClassCard({ cls }: { cls: any }) {
    const typeName = cls.classType?.name ?? cls.ClassType?.name ?? 'Class';
    const typeColor = cls.classType?.color ?? cls.ClassType?.color ?? Colors.border;
    const duration = cls.classType?.duration ?? cls.ClassType?.duration ?? 60;
    const isFull = cls.spotsLeft <= 0 && !cls.isBooked;
    const isLoading = activeClassId === cls.id;
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
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                {(cls.familyBookings ?? []).length > 0 && (
                  <TouchableOpacity style={[s.cancelBtn, isLoading && s.bookBtnLoading]}
                    onPress={() => handleCancel(cls)} disabled={isLoading}>
                    <Text style={s.cancelBtnText}>
                      {isLoading ? '...' : (cls.familyBookings ?? []).length > 1 ? 'Cancel booking' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                )}
                {(!(cls.familyBookings ?? []).every((b: any) => b.memberId === (cls.familyBookings?.[0]?.memberId)) || (cls.familyBookings ?? []).length === 0 || family.length > 0) && !cls.isBooked && (
                  <TouchableOpacity style={[s.bookBtn, isLoading && s.bookBtnLoading]}
                    onPress={() => handleBook(cls)} disabled={isLoading}>
                    <Text style={s.bookBtnText}>
                      {isLoading ? '...' : cls.planPrice > 0 ? `Pay £${Number(cls.planPrice).toFixed(2)}` : 'Book'}
                    </Text>
                  </TouchableOpacity>
                )}
                {cls.isBooked && family.length > 0 && (
                  <TouchableOpacity style={[s.bookBtn, isLoading && s.bookBtnLoading]}
                    onPress={() => handleBook(cls)} disabled={isLoading}>
                    <Text style={s.bookBtnText}>Book for family</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
        <View style={s.tags}>
          {(cls.familyBookings ?? []).map((b: any) => (
            <View key={b.memberId} style={s.tagBooked}>
              <Text style={s.tagBookedText}>✓ {b.name} booked</Text>
            </View>
          ))}
          {(cls.familyBookings ?? []).length === 0 && cls.includedInPlan && <View style={s.tagIncluded}><Text style={s.tagIncludedText}>Included in plan</Text></View>}
          {(cls.familyBookings ?? []).length === 0 && !cls.includedInPlan && cls.planPrice > 0 && <View style={s.tagPaid}><Text style={s.tagPaidText}>£{Number(cls.planPrice).toFixed(2)}</Text></View>}
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

      {/* Who's this class for? Modal */}
      <Modal visible={!!bookModal} transparent animationType="slide" onRequestClose={() => setBookModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setBookModal(null)}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.header}>
              <Text style={m.headerLabel}>WHO'S THIS CLASS FOR?</Text>
              <Text style={m.headerClass}>{bookModal?.cls?.classType?.name ?? bookModal?.cls?.ClassType?.name}</Text>
              <Text style={m.headerMeta}>
                {bookModal?.cls?.startsAt ? new Date(bookModal.cls.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : ''}
                {bookModal?.cls?.location ? ' · ' + bookModal.cls.location : ''}
              </Text>
            </View>
            <ScrollView style={m.list}>
              {(bookModal?.candidates ?? []).map((c: any) => {
                const elig = eligibility[c.id];
                const isLoading = !elig;
                const isError = elig?.error;
                const alreadyBooked = elig?.alreadyBooked;
                const isFull = elig?.isFull;
                const eligibleFree = elig?.eligibleForFree;
                const price = elig?.planPrice;
                const reason = elig?.reason;
                const selectable = !isLoading && !isError && !alreadyBooked && !isFull && (eligibleFree || (price !== null && price !== undefined && price > 0));
                const isSelected = selectedCandidate === c.id;
                const age = c.dateOfBirth ? Math.floor((Date.now() - new Date(c.dateOfBirth).getTime()) / (1000*60*60*24*365.25)) : null;

                return (
                  <TouchableOpacity key={c.id} style={[m.row, isSelected && m.rowSelected, !selectable && m.rowDisabled]}
                    onPress={() => selectable && setSelectedCandidate(c.id)} disabled={!selectable} activeOpacity={0.7}>
                    {c.image
                      ? <Image source={{ uri: c.image }} style={m.avatar} />
                      : <View style={m.avatarPlaceholder}><Text style={m.avatarText}>{c.firstName[0]}{c.lastName[0]}</Text></View>
                    }
                    <View style={m.rowInfo}>
                      <Text style={[m.rowName, !selectable && m.rowNameDimmed]}>{c.firstName} {c.lastName}</Text>
                      <Text style={m.rowSub}>{c.isSelf ? 'You' : age !== null ? `age ${age} · Junior member` : 'Junior member'}</Text>
                      {isLoading && <Text style={m.rowElig}>Checking eligibility...</Text>}
                      {isError && <Text style={[m.rowElig, { color: '#ef4444' }]}>Unable to check eligibility</Text>}
                      {!isLoading && !isError && alreadyBooked && <Text style={m.rowElig}>Already booked</Text>}
                      {!isLoading && !isError && isFull && !alreadyBooked && <Text style={m.rowElig}>Class full</Text>}
                      {!isLoading && !isError && !alreadyBooked && !isFull && eligibleFree && <Text style={[m.rowElig, { color: '#4ade80' }]}>Included in plan</Text>}
                      {!isLoading && !isError && !alreadyBooked && !isFull && !eligibleFree && price > 0 && <Text style={[m.rowElig, { color: '#f59e0b' }]}>£{Number(price).toFixed(2)} · pay at checkout</Text>}
                      {!isLoading && !isError && !alreadyBooked && !isFull && !eligibleFree && !price && reason && <Text style={m.rowElig}>{reason}</Text>}
                    </View>
                    {selectable && (
                      <View style={[m.radio, isSelected && m.radioSelected]}>
                        {isSelected && <View style={m.radioInner} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={m.footer}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setBookModal(null)}>
                <Text style={m.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.confirmBtn, !selectedCandidate && m.confirmBtnDisabled]}
                onPress={handleModalConfirm} disabled={!selectedCandidate}>
                <Text style={m.confirmBtnText}>
                  {(() => {
                    if (!selectedCandidate) return 'Select a member';
                    const elig = eligibility[selectedCandidate];
                    if (elig?.eligibleForFree) return 'Book';
                    if (elig?.planPrice > 0) return `Pay & Book — £${Number(elig.planPrice).toFixed(2)}`;
                    return 'Select a member';
                  })()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  cancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  bookBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },
  cancelBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tagBooked: { backgroundColor: Colors.greenBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagBookedText: { color: Colors.greenText, fontSize: 11, fontWeight: '700' },
  tagIncluded: { backgroundColor: Colors.greenBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagIncludedText: { color: Colors.greenText, fontSize: 11 },
  tagPaid: { backgroundColor: Colors.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagPaidText: { color: Colors.amberText, fontSize: 11, fontWeight: '600' },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, marginBottom: 4 },
  headerClass: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  headerMeta: { fontSize: 12, color: '#a0a0a0', marginTop: 2 },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a22' },
  rowSelected: { backgroundColor: '#2a2a2a' },
  rowDisabled: { opacity: 0.5 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  rowNameDimmed: { color: '#a1a1aa' },
  rowSub: { fontSize: 12, color: '#a1a1aa' },
  rowElig: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
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
