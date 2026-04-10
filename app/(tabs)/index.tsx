import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, Image, Alert, Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { useStripe } from '@stripe/stripe-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getToken } from '@/lib/auth';

interface OpenGym { allowed: boolean; slots: { start: string; end: string }[]; gymSlots: { start: string; end: string }[]; reason: string | null; }
interface ClassEvent { id: string; type: 'class'; name: string; color: string; startsAt: string; endsAt: string; location: string; instructor: string | null; spotsLeft: number; capacity: number; bookedCount: number; isBooked: boolean; myBookingId: string | null; planPrice: number | null; canBook: boolean; includedInPlan: boolean; allowedByRule: boolean; }
interface PtEvent { id: string; type: 'pt'; name: string; color: string; startsAt: string; endsAt: string; status: string; instructor: string; }
type GymEvent = ClassEvent | PtEvent;
interface DiaryDay { date: string; dayName: string; gymClosed: boolean; openGym: OpenGym; events: GymEvent[]; }
interface DiaryData { plan: { name: string; planType: string; accessMode: string; subStatus: string | null } | null; days: DiaryDay[]; }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}
function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
}
function fmtDateShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}
function isToday(dateStr: string) { return new Date().toISOString().startsWith(dateStr); }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

export default function Dashboard() {
  const { member } = useAuth();
  const [diary, setDiary] = useState<DiaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [downloadingWallet, setDownloadingWallet] = useState(false);

  async function handleAppleWallet() {
    setDownloadingWallet(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');

      console.log('Fetching wallet pass...');

      const response = await fetch('https://app.crusader9.co.uk/api/mobile/wallet-pass', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      console.log('Got base64, length:', base64.length);

      const fileUri = FileSystem.documentDirectory + 'crusader9.pkpass';
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' as any });

      console.log('Written, sharing...');

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.apple.pkpass',
        UTI: 'com.apple.pkpass',
        dialogTitle: 'Add to Apple Wallet',
      });
    } catch (e: any) {
      console.error('Wallet error:', e);
      Alert.alert('Wallet Error', e.message ?? 'Unknown error');
    } finally {
      setDownloadingWallet(false);
    }
  }

  const loadDiary = useCallback(async () => {
    try { const d = await apiFetch('/diary'); setDiary(d); } catch {}
  }, []);

  useEffect(() => { loadDiary().finally(() => setLoading(false)); }, []);

  async function onRefresh() { setRefreshing(true); await loadDiary(); setRefreshing(false); }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleBook(ev: ClassEvent) {
    setBookingId(ev.id);
    try {
      if (ev.planPrice !== null && ev.planPrice > 0) {
        const bookRes = await apiPost('/classes/' + ev.id + '/book', { pending: true });
        const intentRes = await apiPost('/stripe/payment-intent', { type: 'class_booking', classId: ev.id, bookingId: bookRes.bookingId });
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intentRes.clientSecret,
          merchantDisplayName: 'Crusader 9 Boxing',
          style: 'alwaysDark',
        });
        if (initError) { showToast(initError.message, false); return; }
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) { if (presentError.code !== 'Canceled') showToast(presentError.message, false); return; }
        await apiPost('/stripe/confirm-booking', {
          paymentIntentId: intentRes.clientSecret.split('_secret_')[0],
          type: 'class_booking',
          bookingId: bookRes.bookingId,
        });
        showToast('Booked!', true);
        await loadDiary();
      } else {
        await apiPost('/classes/' + ev.id + '/book', {});
        showToast('Booked!', true);
        await loadDiary();
      }
    } catch (e: any) { showToast(e.message || 'Booking failed', false); }
    finally { setBookingId(null); }
  }

  async function handleCancel(ev: ClassEvent) {
    if (!ev.myBookingId) return;
    Alert.alert('Cancel Booking', 'Are you sure?', [
      { text: 'No' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        setBookingId(ev.id);
        try { await apiDelete('/classes/' + ev.id + '/book'); showToast('Booking cancelled', true); await loadDiary(); }
        catch (e: any) { showToast(e.message || 'Failed', false); }
        finally { setBookingId(null); }
      }},
    ]);
  }

  const firstName = member?.firstName || '';
  const hasPlan = !!diary?.plan;
  const todayDay = diary?.days.find(d => isToday(d.date));
  const restDays = diary?.days.filter(d => !isToday(d.date)) || [];

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.white} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.white} />}>

      {/* Toast */}
      {toast && (
        <View style={[s.toast, toast.ok ? s.toastOk : s.toastErr]}>
          <Text style={[s.toastText, { color: toast.ok ? Colors.greenText : '#fca5a5' }]}>{toast.msg}</Text>
        </View>
      )}

      {/* Header */}
      <View style={s.header}>
        <Text style={s.greeting}>{getGreeting()}, {firstName}</Text>
        <View style={s.planRow}>
          {hasPlan ? (
            <View style={s.planBadge}>
              <Text style={s.planBadgeName}>{diary!.plan!.name}</Text>
              <View style={s.planStatusRow}>
                <View style={[s.dot, { backgroundColor: diary!.plan!.subStatus === 'ACTIVE' ? Colors.green : diary!.plan!.subStatus === 'PAUSED' ? Colors.amber : Colors.textFaint }]} />
                <Text style={s.planStatusText}>{diary!.plan!.subStatus ?? ''}</Text>
              </View>
            </View>
          ) : (
            <View style={s.planBadge}>
              <View style={s.planStatusRow}>
                <View style={[s.dot, { backgroundColor: Colors.textFaint }]} />
                <Text style={s.planStatusText}>No membership</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* QR Card */}
      {member && (
        <TouchableOpacity style={s.qrCard} onPress={() => setQrModal(true)} activeOpacity={0.85}>
          <View style={s.qrInner}>
            {member.qrCode && <Image source={{ uri: member.qrCode }} style={s.qrImage} />}
            <View>
              <Text style={s.qrName}>{member.firstName} {member.lastName}</Text>
              <Text style={s.qrId}>{member.memberId}</Text>
              {member.plan && (
                <View style={s.qrPlanRow}>
                  <Text style={s.qrPlanText}>{member.plan.name}</Text>
                  <View style={[s.dot, { backgroundColor: member.subscription?.status === 'ACTIVE' ? Colors.green : Colors.textFaint, marginLeft: 6 }]} />
                </View>
              )}
            </View>
          </View>
          <Text style={s.qrHint}>Tap to enlarge · Show at front desk to check in</Text>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={s.walletBtn} onPress={handleAppleWallet} disabled={downloadingWallet}>
              <Text style={s.walletBtnText}>{downloadingWallet ? 'Generating...' : '🍎 Add to Apple Wallet'}</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}

      {/* Today */}
      {todayDay && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>TODAY</Text>
          <TodayCard day={todayDay} bookingId={bookingId} onBook={handleBook} onCancel={handleCancel} />
        </View>
      )}

      {/* Rest of week */}
      {restDays.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>THIS WEEK</Text>
          {restDays.map(day => (
            <FutureDayCard key={day.date} day={day} bookingId={bookingId} onBook={handleBook} onCancel={handleCancel} />
          ))}
        </View>
      )}

      {/* QR Modal */}
      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setQrModal(false)}>
          <View style={s.modalBox}>
            {member?.qrCode && <Image source={{ uri: member.qrCode }} style={s.qrModalImage} />}
            <Text style={s.modalName}>{member?.firstName} {member?.lastName}</Text>
            <Text style={s.modalId}>{member?.memberId}</Text>
            <TouchableOpacity style={s.modalClose} onPress={() => setQrModal(false)}>
              <Text style={s.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

function OpenGymSection({ day }: { day: DiaryDay }) {
  if (day.gymClosed) return (
    <View style={s.gymRow}>
      <Text style={s.gymClosed}>🔒 Gym Closed{day.openGym.reason && day.openGym.reason !== 'Gym closed' ? ` — ${day.openGym.reason}` : ''}</Text>
    </View>
  );
  if (day.openGym.allowed) return (
    <View style={[s.gymRow, s.gymOpen]}>
      <Text style={s.gymOpenLabel}>Open Gym — you're good to go</Text>
      <View style={s.slotRow}>
        {day.openGym.slots.map((sl, i) => (
          <View key={i} style={s.slotBadge}><Text style={s.slotText}>{sl.start}–{sl.end}</Text></View>
        ))}
      </View>
    </View>
  );
  return (
    <View style={s.gymRow}>
      <Text style={s.gymClosedLabel}>Open gym not available{day.openGym.reason ? ` — ${day.openGym.reason}` : ''}</Text>
      {day.openGym.gymSlots.length > 0 && (
        <View style={s.slotRow}>
          {day.openGym.gymSlots.map((sl, i) => (
            <View key={i} style={s.slotBadgeDim}><Text style={s.slotTextDim}>🔒 {sl.start}–{sl.end}</Text></View>
          ))}
        </View>
      )}
    </View>
  );
}

function ClassRow({ ev, bookingId, onBook, onCancel }: { ev: ClassEvent; bookingId: string | null; onBook: (e: ClassEvent) => void; onCancel: (e: ClassEvent) => void; }) {
  const isFull = ev.spotsLeft === 0 && !ev.isBooked;
  const isLoading = bookingId === ev.id;
  const barColor = ev.isBooked ? Colors.green : ev.includedInPlan ? Colors.indigo : (ev.planPrice && ev.planPrice > 0) ? Colors.amber : Colors.borderHigh;

  return (
    <View style={s.eventRow}>
      <View style={[s.eventBar, { backgroundColor: barColor }]} />
      <View style={s.eventInfo}>
        <View style={s.eventTitleRow}>
          <Text style={s.eventTitle}>{ev.name}</Text>
          {ev.isBooked && <View style={s.tagGreen}><Text style={s.tagGreenText}>✓ Booked</Text></View>}
          {!ev.isBooked && ev.includedInPlan && <View style={s.tagGreen}><Text style={s.tagGreenText}>Included in plan</Text></View>}
          {!ev.isBooked && !ev.includedInPlan && ev.planPrice !== null && ev.planPrice > 0 && <View style={s.tagAmber}><Text style={s.tagAmberText}>£{ev.planPrice.toFixed(2)}</Text></View>}
        </View>
        <Text style={s.eventTime}>{fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}{ev.instructor ? ` · ${ev.instructor}` : ''}{ev.location ? ` · ${ev.location}` : ''}</Text>
        {!ev.isBooked && <Text style={[s.spots, ev.spotsLeft <= 3 && !isFull ? { color: Colors.amber } : isFull ? { color: Colors.red } : {}]}>{isFull ? 'Full' : `${ev.spotsLeft} spot${ev.spotsLeft !== 1 ? 's' : ''} left`}</Text>}
      </View>
      <View style={s.eventAction}>
        {ev.isBooked ? (
          <TouchableOpacity style={s.btnGrey} onPress={() => onCancel(ev)} disabled={isLoading}>
            <Text style={s.btnGreyText}>{isLoading ? '...' : 'Cancel'}</Text>
          </TouchableOpacity>
        ) : isFull ? <Text style={s.fullText}>Full</Text>
        : ev.includedInPlan || ev.planPrice === 0 ? (
          <TouchableOpacity style={s.btnWhite} onPress={() => onBook(ev)} disabled={isLoading}>
            <Text style={s.btnWhiteText}>{isLoading ? '...' : 'Book Now'}</Text>
          </TouchableOpacity>
        ) : ev.planPrice !== null && ev.planPrice > 0 ? (
          <TouchableOpacity style={s.btnWhite} onPress={() => onBook(ev)} disabled={isLoading}>
            <Text style={s.btnWhiteText}>{isLoading ? '...' : 'Pay & Book'}</Text>
          </TouchableOpacity>
        ) : !ev.allowedByRule ? (
          <Text style={s.naText}>Not on your plan</Text>
        ) : null}
      </View>
    </View>
  );
}

function PtRow({ ev }: { ev: PtEvent }) {
  return (
    <View style={[s.eventRow, s.ptRow]}>
      <View style={[s.eventBar, { backgroundColor: Colors.purple }]} />
      <View style={s.eventInfo}>
        <View style={s.eventTitleRow}>
          <View style={s.tagPurple}><Text style={s.tagPurpleText}>PT Session</Text></View>
          <Text style={s.eventTitle}>{ev.instructor}</Text>
        </View>
        <Text style={s.eventTime}>{fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}</Text>
      </View>
      <View style={[s.statusBadge, ev.status === 'CONFIRMED' ? s.statusGreen : ev.status === 'PENDING' ? s.statusAmber : s.statusGrey]}>
        <Text style={[s.statusText, ev.status === 'CONFIRMED' ? { color: Colors.greenText } : ev.status === 'PENDING' ? { color: Colors.amberText } : { color: Colors.textMuted }]}>{ev.status}</Text>
      </View>
    </View>
  );
}

function TodayCard({ day, bookingId, onBook, onCancel }: { day: DiaryDay; bookingId: string | null; onBook: (e: ClassEvent) => void; onCancel: (e: ClassEvent) => void; }) {
  const classEvents = day.events.filter((e): e is ClassEvent => e.type === 'class');
  const ptEvents = day.events.filter((e): e is PtEvent => e.type === 'pt');
  return (
    <View style={s.dayCard}>
      <View style={s.dayCardHeader}>
        <View style={s.todayBadge}><Text style={s.todayBadgeText}>Today</Text></View>
        <Text style={s.dayCardDate}>{fmtDate(day.date)}</Text>
      </View>
      <OpenGymSection day={day} />
      {classEvents.length > 0 && (
        <View>
          <View style={s.eventsHeader}><Text style={s.eventsLabel}>CLASSES</Text></View>
          {classEvents.map(ev => <ClassRow key={ev.id} ev={ev} bookingId={bookingId} onBook={onBook} onCancel={onCancel} />)}
        </View>
      )}
      {ptEvents.length > 0 && (
        <View>
          <View style={s.eventsHeader}><Text style={s.eventsLabel}>YOUR PT SESSIONS</Text></View>
          {ptEvents.map(ev => <PtRow key={ev.id} ev={ev} />)}
        </View>
      )}
      {classEvents.length === 0 && ptEvents.length === 0 && !day.gymClosed && (
        <Text style={s.noEvents}>No classes or sessions scheduled</Text>
      )}
    </View>
  );
}

function FutureDayCard({ day, bookingId, onBook, onCancel }: { day: DiaryDay; bookingId: string | null; onBook: (e: ClassEvent) => void; onCancel: (e: ClassEvent) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const classEvents = day.events.filter((e): e is ClassEvent => e.type === 'class');
  const ptEvents = day.events.filter((e): e is PtEvent => e.type === 'pt');
  const classCount = classEvents.length;
  const ptCount = ptEvents.length;

  return (
    <View style={s.dayCard}>
      <TouchableOpacity style={s.futureHeader} onPress={() => setExpanded(!expanded)}>
        <View style={s.futureTitleRow}>
          <Text style={s.futureDateText}>{fmtDateShort(day.date)}</Text>
          <View style={s.futureBadges}>
            {classCount > 0 && <View style={s.countBadge}><Text style={s.countBadgeText}>{classCount} class{classCount !== 1 ? 'es' : ''}</Text></View>}
            {ptCount > 0 && <View style={s.countBadgePurple}><Text style={s.countBadgePurpleText}>{ptCount} PT</Text></View>}
          </View>
        </View>
        <View style={s.futureRight}>
          {day.gymClosed ? <Text style={s.gymClosedTiny}>Closed</Text>
            : day.openGym.allowed ? (
              <View style={s.gymOpenTinyRow}>
                <View style={[s.dot, { backgroundColor: Colors.green }]} />
                <Text style={s.gymOpenTiny}>{day.openGym.slots.map(sl => `${sl.start}–${sl.end}`).join(', ')}</Text>
              </View>
            ) : <View style={[s.dot, { backgroundColor: Colors.textFaint }]} />
          }
          <Text style={[s.chevron, expanded && s.chevronUp]}>›</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View>
          <OpenGymSection day={day} />
          {classEvents.length > 0 && (
            <View>
              <View style={s.eventsHeader}><Text style={s.eventsLabel}>CLASSES</Text></View>
              {classEvents.map(ev => <ClassRow key={ev.id} ev={ev} bookingId={bookingId} onBook={onBook} onCancel={onCancel} />)}
            </View>
          )}
          {ptEvents.length > 0 && (
            <View>
              <View style={s.eventsHeader}><Text style={s.eventsLabel}>YOUR PT SESSIONS</Text></View>
              {ptEvents.map(ev => <PtRow key={ev.id} ev={ev} />)}
            </View>
          )}
          {classEvents.length === 0 && ptEvents.length === 0 && <Text style={s.noEvents}>No classes or sessions scheduled</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  toast: { padding: 12, borderRadius: 10, marginBottom: 4 },
  toastOk: { backgroundColor: 'rgba(20,83,45,0.8)', borderWidth: 1, borderColor: Colors.greenDim },
  toastErr: { backgroundColor: 'rgba(69,10,10,0.8)', borderWidth: 1, borderColor: Colors.red },
  toastText: { fontSize: 13, fontWeight: '600' },
  header: { gap: 8 },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.text },
  planRow: { flexDirection: 'row' },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  planBadgeName: { color: Colors.textSub, fontSize: 13 },
  planStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planStatusText: { color: Colors.textSub, fontSize: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  qrCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 18, gap: 10 },
  qrInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qrImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: Colors.white },
  qrName: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  qrId: { color: Colors.textFaint, fontSize: 11, fontFamily: 'monospace' },
  qrPlanRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  qrPlanText: { color: Colors.textSub, fontSize: 12 },
  qrHint: { color: '#3f3f46', fontSize: 11, textAlign: 'center' },
  section: { gap: 8 },
  sectionLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  dayCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: 'hidden' },
  dayCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  todayBadge: { backgroundColor: Colors.white, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  todayBadgeText: { color: Colors.bg, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  dayCardDate: { color: Colors.text, fontWeight: '600', fontSize: 16 },
  futureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  futureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  futureDateText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  futureBadges: { flexDirection: 'row', gap: 4 },
  countBadge: { backgroundColor: Colors.surfaceHigh, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  countBadgeText: { color: Colors.textSub, fontSize: 10 },
  countBadgePurple: { backgroundColor: Colors.purpleBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  countBadgePurpleText: { color: Colors.purpleText, fontSize: 10 },
  futureRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gymClosedTiny: { color: Colors.red, fontSize: 10 },
  gymOpenTinyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gymOpenTiny: { color: Colors.textMuted, fontSize: 10 },
  chevron: { color: Colors.textFaint, fontSize: 18, transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },
  gymRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  gymOpen: { backgroundColor: 'rgba(20,83,45,0.1)' },
  gymClosed: { color: Colors.red, fontSize: 13, fontWeight: '600' },
  gymOpenLabel: { color: Colors.greenText, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  gymClosedLabel: { color: Colors.textFaint, fontSize: 12, marginBottom: 4 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  slotBadge: { backgroundColor: Colors.greenBg, borderWidth: 1, borderColor: 'rgba(22,163,74,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  slotText: { color: Colors.greenText, fontSize: 11 },
  slotBadgeDim: { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.borderHigh, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  slotTextDim: { color: Colors.textMuted, fontSize: 11 },
  eventsHeader: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  eventsLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  eventRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(39,39,42,0.5)', gap: 10 },
  ptRow: { backgroundColor: 'rgba(59,7,100,0.08)' },
  eventBar: { width: 3, height: '100%', borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  eventInfo: { flex: 1, gap: 2 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  eventTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  eventTime: { color: Colors.textMuted, fontSize: 12 },
  spots: { color: Colors.textFaint, fontSize: 11 },
  tagGreen: { backgroundColor: Colors.greenBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tagGreenText: { color: Colors.greenText, fontSize: 10 },
  tagAmber: { backgroundColor: Colors.amberBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tagAmberText: { color: Colors.amberText, fontSize: 10 },
  tagPurple: { backgroundColor: Colors.purpleBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tagPurpleText: { color: Colors.purpleText, fontSize: 10 },
  eventAction: { alignItems: 'flex-end' },
  btnWhite: { backgroundColor: Colors.white, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnWhiteText: { color: Colors.bg, fontSize: 12, fontWeight: '600' },
  btnGrey: { backgroundColor: Colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnGreyText: { color: Colors.textSub, fontSize: 12 },
  fullText: { color: Colors.textFaint, fontSize: 12 },
  naText: { color: Colors.textFaint, fontSize: 11, textAlign: 'right', maxWidth: 90 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusGreen: { backgroundColor: Colors.greenBg },
  statusAmber: { backgroundColor: Colors.amberBg },
  statusGrey: { backgroundColor: Colors.surfaceHigh },
  statusText: { fontSize: 10, fontWeight: '700' },
  noEvents: { color: Colors.textFaint, fontSize: 12, textAlign: 'center', padding: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10, marginHorizontal: 24 },
  qrModalImage: { width: 240, height: 240, borderRadius: 12, backgroundColor: Colors.white },
  modalName: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  modalId: { color: Colors.textFaint, fontSize: 12, fontFamily: 'monospace' },
  modalClose: { backgroundColor: Colors.surfaceHigh, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  modalCloseText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  walletBtn: { backgroundColor: Colors.black, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  walletBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
});
