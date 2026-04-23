import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, Image } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { apiPost } from '@/lib/api';

const DAY_PASS_PRICE = 7.5;
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface Props {
  gymSchedule: Record<string, { start: string; end: string }[]>;
  closedDates: string[];
  forMemberId?: string;        // hardcoded child — skips picker
  showFamilyPicker?: boolean;  // parent context — shows picker first
  family?: { id: string; firstName: string; lastName: string; image: string | null }[];
  onPurchased?: () => void;
}

function getSixWeeks() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const mon = new Date(today);
  const dow = today.getDay();
  mon.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(mon);
      date.setDate(mon.getDate() + w * 7 + d);
      week.push(date);
    }
    weeks.push(week);
  }
  return weeks;
}

function dateStr(d: Date) { return d.toISOString().split('T')[0]; }

export function DayPassPurchase({ gymSchedule, closedDates, forMemberId, showFamilyPicker, family, onPurchased }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [buying, setBuying] = useState(false);
  const [pickedMemberId, setPickedMemberId] = useState<string | null>(null); // null = self
  const [pickerVisible, setPickerVisible] = useState(false);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // forMemberId prop (child screen) takes priority; otherwise use picker
  const effectiveForMemberId = forMemberId ?? (pickedMemberId === 'self' ? null : pickedMemberId);

  const closedSet = useMemo(() => new Set(closedDates), [closedDates]);
  const allWeeks = useMemo(() => getSixWeeks(), []);
  const visibleWeeks = showAll ? allWeeks : allWeeks.slice(0, 2);

  const todayStr = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.toISOString().split('T')[0];
  }, []);

  function isAvailable(date: Date) {
    const ds = dateStr(date);
    if (ds < todayStr) return false;
    if (closedSet.has(ds)) return false;
    const dow = date.getDay();
    const abbr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
    return !!(gymSchedule[abbr]?.length > 0);
  }

  function isClosed(date: Date) {
    return closedSet.has(dateStr(date));
  }

  function toggle(date: Date) {
    if (!isAvailable(date)) return;
    const ds = dateStr(date);
    const s = new Set(selected);
    s.has(ds) ? s.delete(ds) : s.add(ds);
    setSelected(s);
    setFocusedDate(ds); // always focus the tapped date
  }

  function getHoursForDate(ds: string) {
    const date = new Date(ds + 'T12:00:00');
    const dow = date.getDay();
    const abbr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
    return gymSchedule[abbr] ?? [];
  }

  function formatDayFull(ds: string) {
    return new Date(ds + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  // Month headers — show when week crosses into a new month
  function getMonthHeader(wi: number): string | null {
    const week = allWeeks[wi];
    if (!week) return null;
    const midMonth = week[2].getMonth();
    if (wi === 0) return MONTH_NAMES[midMonth];
    const prevMidMonth = allWeeks[wi - 1][2].getMonth();
    return midMonth !== prevMidMonth ? MONTH_NAMES[midMonth] : null;
  }

  async function handleBuy() {
    if (selected.size === 0) return;
    setBuying(true);
    try {
      const dates = [...selected].sort();
      const intentRes = await apiPost('/stripe/payment-intent', {
        type: 'day_pass',
        dates,
        ...(effectiveForMemberId && { forMemberId: effectiveForMemberId }),
      });
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intentRes.clientSecret,
        merchantDisplayName: 'Crusader 9 Boxing',
        style: 'alwaysDark',
        returnURL: 'crusader9://stripe-success',
      });
      if (initError) { Alert.alert('Error', initError.message); return; }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') Alert.alert('Payment failed', presentError.message);
        return;
      }
      await apiPost('/stripe/confirm-booking', {
        paymentIntentId: intentRes.clientSecret.split('_secret_')[0],
        type: 'day_pass',
        dates,
        ...(effectiveForMemberId && { forMemberId: effectiveForMemberId }),
      });
      setSelected(new Set());
      Alert.alert('Purchased!', `${dates.length} day pass${dates.length > 1 ? 'es' : ''} added to your account.`);
      onPurchased?.();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBuying(false); }
  }

  const total = selected.size * DAY_PASS_PRICE;
  const selectedDates = [...selected].sort();

  return (
    <View style={s.card}>
      {/* Price header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.titleRow}>
            <Text style={s.title}>Day Pass</Text>
            <View style={s.dropInBadge}><Text style={s.dropInText}>Drop-in</Text></View>
          </View>
          <Text style={s.subtitle}>Open gym access · valid one day only</Text>
        </View>
        <View style={s.priceBadge}>
          <Text style={s.priceText}>£{DAY_PASS_PRICE.toFixed(2)}</Text>
          <Text style={s.perDay}>per day</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* Who's this for? row (parent context only) */}
      {showFamilyPicker && family && family.length > 0 && (
        <TouchableOpacity style={s.whoForRow} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
          <View style={s.whoForLeft}>
            <Text style={s.whoForLabel}>BOOKING FOR</Text>
            <Text style={s.whoForName}>
              {pickedMemberId === null || pickedMemberId === 'self'
                ? 'You'
                : family.find(c => c.id === pickedMemberId)?.firstName ?? 'You'}
            </Text>
          </View>
          <Text style={s.whoForChange}>Change →</Text>
        </TouchableOpacity>
      )}

      {/* Day column headers */}
      <View style={s.dayHeaders}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <Text key={i} style={s.dayHeader}>{d}</Text>
        ))}
      </View>

      {/* Calendar */}
      {visibleWeeks.map((week, wi) => {
        const monthHeader = getMonthHeader(wi);
        return (
          <View key={wi}>
            {monthHeader && (
              <Text style={s.monthHeader}>{monthHeader}</Text>
            )}
            <View style={s.weekRow}>
              {week.map((date, di) => {
                const ds = dateStr(date);
                const available = isAvailable(date);
                const closed = isClosed(date);
                const past = ds < todayStr;
                const sel = selected.has(ds);
                const today = ds === todayStr;

                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      s.dayBtn,
                      sel && s.dayBtnSelected,
                      today && !sel && s.dayBtnToday,
                      !available && s.dayBtnDisabled,
                    ]}
                    onPress={() => toggle(date)}
                    disabled={!available}
                    activeOpacity={0.7}>
                    <Text style={[
                      s.dayNum,
                      sel && s.dayNumSelected,
                      past && s.dayNumPast,
                      !available && !past && s.dayNumUnavailable,
                    ]}>
                      {date.getDate()}
                    </Text>
                    {available && !sel && <View style={s.availDot} />}
                    {closed && !past && <View style={s.closedDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#22c55e' }]} /><Text style={s.legendText}>Available</Text></View>
        <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={s.legendText}>Closed</Text></View>
        <View style={s.legendItem}><View style={[s.legendSquare, { backgroundColor: '#22c55e' }]} /><Text style={s.legendText}>Selected</Text></View>
      </View>

      {/* Focused date info panel */}
      {focusedDate && selected.has(focusedDate) && (
        <View style={s.dateInfoPanel}>
          <View style={s.dateInfoHeader}>
            <Text style={s.dateInfoDay}>{formatDayFull(focusedDate)}</Text>
            <TouchableOpacity onPress={() => setFocusedDate(null)}>
              <Text style={s.dateInfoClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.dateInfoLabel}>OPEN GYM HOURS</Text>
          <View style={s.dateInfoSlots}>
            {getHoursForDate(focusedDate).map((slot: any, i: number) => (
              <View key={i} style={s.timeSlot}>
                <Text style={s.timeSlotText}>{slot.start}–{slot.end}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Show more / less */}
      <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAll(!showAll)} activeOpacity={0.7}>
        <Text style={s.showMoreText}>{showAll ? 'Show fewer dates ↑' : 'Show more dates ↓ (up to 6 weeks)'}</Text>
      </TouchableOpacity>

      {/* Summary + buy */}
      {selected.size > 0 ? (
        <View style={s.summary}>
          <View style={s.summaryTop}>
            <View>
              <Text style={s.summaryCount}>{selected.size} pass{selected.size > 1 ? 'es' : ''} selected</Text>
              <Text style={s.summaryDates} numberOfLines={2}>
                {selectedDates.map(ds => {
                  const d = new Date(ds + 'T12:00:00');
                  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                }).join(', ')}
              </Text>
            </View>
            <Text style={s.summaryTotal}>£{total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[s.buyBtn, buying && { opacity: 0.6 }]}
            onPress={handleBuy}
            disabled={buying}
            activeOpacity={0.8}>
            {buying
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.buyBtnText}>Buy {selected.size} day pass{selected.size > 1 ? 'es' : ''} · £{total.toFixed(2)}</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.noSelectionBtn}>
          <Text style={s.noSelectionText}>Tap dates above to select</Text>
        </View>
      )}

      {/* Family picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={pm.sheet} onStartShouldSetResponder={() => true}>
            <View style={pm.header}>
              <Text style={pm.headerLabel}>WHO'S THIS FOR?</Text>
              <Text style={pm.headerSub}>Day passes will be added to their account</Text>
            </View>
            {/* Self option */}
            <TouchableOpacity style={[pm.row, (pickedMemberId === null || pickedMemberId === 'self') && pm.rowSelected]}
              onPress={() => { setPickedMemberId('self'); setPickerVisible(false); }} activeOpacity={0.7}>
              <View style={pm.avatarPlaceholder}><Text style={pm.avatarText}>Me</Text></View>
              <View style={pm.rowInfo}>
                <Text style={pm.rowName}>You</Text>
                <Text style={pm.rowSub}>Book for yourself</Text>
              </View>
              {(pickedMemberId === null || pickedMemberId === 'self') && (
                <View style={pm.radioSelected}><View style={pm.radioInner} /></View>
              )}
              {pickedMemberId !== null && pickedMemberId !== 'self' && <View style={pm.radio} />}
            </TouchableOpacity>
            {/* Family members */}
            {family?.map(c => (
              <TouchableOpacity key={c.id} style={[pm.row, pm.rowBorder, pickedMemberId === c.id && pm.rowSelected]}
                onPress={() => { setPickedMemberId(c.id); setPickerVisible(false); }} activeOpacity={0.7}>
                {c.image
                  ? <Image source={{ uri: c.image }} style={pm.avatar} />
                  : <View style={pm.avatarPlaceholder}><Text style={pm.avatarText}>{c.firstName[0]}{c.lastName[0]}</Text></View>
                }
                <View style={pm.rowInfo}>
                  <Text style={pm.rowName}>{c.firstName} {c.lastName}</Text>
                  <Text style={pm.rowSub}>Junior member</Text>
                </View>
                {pickedMemberId === c.id
                  ? <View style={pm.radioSelected}><View style={pm.radioInner} /></View>
                  : <View style={pm.radio} />
                }
              </TouchableOpacity>
            ))}
            <View style={pm.footer}>
              <TouchableOpacity style={pm.cancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={pm.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#1a1a1a', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', padding: 18, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  dropInBadge: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  dropInText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  subtitle: { fontSize: 12, color: '#a1a1aa' },
  priceBadge: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 64 },
  priceText: { color: '#4ade80', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  perDay: { color: '#a0a0a0', fontSize: 10, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#2a2a2a' },
  dayHeaders: { flexDirection: 'row', gap: 3 },
  dayHeader: { flex: 1, textAlign: 'center', color: '#505050', fontSize: 11, fontWeight: '700' },
  monthHeader: { fontSize: 12, fontWeight: '700', color: '#a0a0a0', marginTop: 6, marginBottom: 4 },
  weekRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  dayBtn: { flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: '#242424', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  dayBtnSelected: { backgroundColor: '#22c55e' },
  dayBtnToday: { borderWidth: 1.5, borderColor: '#22c55e', backgroundColor: '#242424' },
  dayBtnDisabled: { backgroundColor: 'transparent' },
  dayNum: { fontSize: 13, fontWeight: '700', color: '#fff' },
  dayNumSelected: { color: '#000' },
  dayNumPast: { color: '#282828' },
  dayNumUnavailable: { color: '#2a2a2a' },
  availDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#22c55e', position: 'absolute', bottom: 4 },
  closedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ef4444', position: 'absolute', bottom: 4 },
  legend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendSquare: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: '#a1a1aa', fontSize: 10 },
  showMoreBtn: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10, alignItems: 'center' },
  showMoreText: { color: '#a0a0a0', fontSize: 13, fontWeight: '600' },
  summary: { gap: 10, borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 10 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryCount: { fontSize: 15, fontWeight: '700', color: '#fff' },
  summaryDates: { fontSize: 12, color: '#a0a0a0', marginTop: 2, maxWidth: 220 },
  summaryTotal: { fontSize: 18, fontWeight: '800', color: '#4ade80' },
  buyBtn: { backgroundColor: '#22c55e', padding: 14, borderRadius: 12, alignItems: 'center' },
  buyBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  noSelectionBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center' },
  noSelectionText: { color: '#3f3f46', fontSize: 14, fontWeight: '600' },
  whoForRow: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whoForLeft: { gap: 2 },
  whoForLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  whoForName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  whoForChange: { color: '#a0a0a0', fontSize: 13 },
  dateInfoPanel: { backgroundColor: '#242424', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', gap: 8 },
  dateInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInfoDay: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dateInfoClose: { color: '#a1a1aa', fontSize: 16, padding: 2 },
  dateInfoLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  dateInfoSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlot: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  timeSlotText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
});

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', gap: 4 },
  headerLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  headerSub: { fontSize: 14, fontWeight: '700', color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  rowSelected: { backgroundColor: '#2a2a2a' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  rowSub: { fontSize: 12, color: '#a1a1aa' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#3f3f46' },
  radioSelected: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#fff' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#a0a0a0', fontSize: 14 },
});
