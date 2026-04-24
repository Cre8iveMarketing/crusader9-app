import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Image,
  Platform, Alert, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { SvgXml } from 'react-native-svg';
import { useStripe } from '@stripe/stripe-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenGym { allowed: boolean; slots: {start:string;end:string}[]; gymSlots: {start:string;end:string}[]; reason: string|null; }
interface ClassEvent { id:string; type:'class'; name:string; color:string; startsAt:string; endsAt:string; location:string; instructor:string|null; spotsLeft:number; capacity:number; bookedCount:number; isBooked:boolean; myBookingId:string|null; planPrice:number|null; canBook:boolean; includedInPlan:boolean; allowedByRule:boolean; }
interface PtEvent { id:string; type:'pt'; name:string; color:string; startsAt:string; endsAt:string; status:string; instructor:string; }
type GymEvent = ClassEvent | PtEvent;
interface DiaryDay { date:string; dayName:string; gymClosed:boolean; openGym:OpenGym; events:GymEvent[]; }
interface DiaryData { plan:{name:string;planType:string;accessMode:string;subStatus:string|null}|null; days:DiaryDay[]; }
interface Child { id:string; memberId:string; firstName:string; lastName:string; dateOfBirth:string|null; image:string|null; plan:{name:string}|null; subscription:{status:string}|null; nextBooking:{Class:{ClassType:{name:string};startsAt:string}}|null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/London' });
}
function fmtDateShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', timeZone:'Europe/London' });
}
function fmtDateFull(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', timeZone:'Europe/London' });
}
function isToday(dateStr: string) { return new Date().toISOString().startsWith(dateStr); }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function getAge(dob: string | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const chevronRight = (color: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>`;


// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { member } = useAuth();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [diary, setDiary] = useState<DiaryData | null>(null);
  const [family, setFamily] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState(false);
  const [downloadingWallet, setDownloadingWallet] = useState(false);
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const [bookModal, setBookModal] = useState<{ ev: ClassEvent; candidates: any[] } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, any>>({});

  const loadData = useCallback(async () => {
    try {
      const [diaryData, familyData] = await Promise.all([
        apiFetch('/diary'),
        apiFetch('/family').catch(() => ({ children: [] })),
      ]);
      setDiary(diaryData);
      setFamily(familyData.children ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadData().finally(() => setLoading(false)); }, []);

  async function onRefresh() { setRefreshing(true); await loadData(); setRefreshing(false); }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleBook(ev: ClassEvent) {
    if (activeClassId === ev.id) return;
    // If parent has children, show member picker
    if (family.length > 0 && member) {
      const candidates = [
        { id: (member as any).memberInternalId ?? member.id, firstName: member.firstName, lastName: member.lastName, image: member.image, isSelf: true, dateOfBirth: null },
        ...family.map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, image: c.image, isSelf: false, dateOfBirth: c.dateOfBirth })),
      ];
      setBookModal({ ev, candidates });
      setSelectedCandidate(null);
      setEligibility({});
      candidates.forEach(async (c) => {
        try {
          const res = await apiFetch(`/classes/${ev.id}/eligibility?for=${c.id}`);
          setEligibility(prev => ({ ...prev, [c.id]: res }));
        } catch {
          setEligibility(prev => ({ ...prev, [c.id]: { error: true } }));
        }
      });
      return;
    }

    // No children — book directly for self
    await proceedWithBooking(ev, null);
  }

  async function proceedWithBooking(ev: ClassEvent, forMemberId: string | null) {
    setActiveClassId(ev.id);
    try {
      const targetId = forMemberId ?? (member as any)?.memberInternalId ?? member?.id ?? '';
      const elig = await apiFetch(`/classes/${ev.id}/eligibility?for=${targetId}`);

      if (elig.eligibleForFree) {
        await apiPost('/classes/' + ev.id + '/book', forMemberId ? { forMemberId } : {});
        showToast('Booked!', true);
        await loadData();
        return;
      }

      const intentRes = await apiPost('/stripe/payment-intent', {
        type: 'class_booking',
        classId: ev.id,
        forMemberId: forMemberId ?? '',
      });
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intentRes.clientSecret,
        merchantDisplayName: 'Crusader 9 Boxing',
        style: 'alwaysDark',
        returnURL: 'crusader9://stripe-success',
        applePay: { merchantCountryCode: 'GB' },
      });
      if (initError) { showToast(initError.message, false); return; }

      setActiveClassId(null);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment failed', `code=${presentError.code} message=${presentError.message}`);
        }
        return;
      }

      showToast('Booked!', true);
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Booking failed', false);
    } finally {
      setActiveClassId(null);
    }
  }

  async function handleModalConfirm() {
    if (!bookModal || !selectedCandidate) return;
    const candidate = bookModal.candidates.find(c => c.id === selectedCandidate);
    const forMemberId = candidate?.isSelf ? null : selectedCandidate;
    const ev = bookModal.ev;
    setBookModal(null);
    // Wait for iOS to fully dismiss the RN Modal before presenting Stripe
    await new Promise(resolve => setTimeout(resolve, 350));
    await proceedWithBooking(ev, forMemberId);
  }

  async function handleCancel(ev: ClassEvent) {
    Alert.alert('Cancel Booking', 'Are you sure?', [
      { text: 'No' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        setActiveClassId(ev.id);
        try { await apiDelete('/classes/' + ev.id + '/book'); showToast('Booking cancelled', true); await loadData(); }
        catch (e: any) { showToast(e.message || 'Failed', false); }
        finally { setActiveClassId(null); }
      }},
    ]);
  }

  async function handleGoogleWallet() {
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const res = await fetch('https://app.crusader9.co.uk/api/mobile/google-wallet-pass', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      await Linking.openURL(data.saveUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleAppleWallet() {
    setDownloadingWallet(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const url = `https://app.crusader9.co.uk/api/member/wallet?token=${token}&returnUrl=crusader9://`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', 'Could not open Apple Wallet. Please try again.');
    } finally { setDownloadingWallet(false); }
  }

  const todayDay = diary?.days.find(d => isToday(d.date));
  const restDays = diary?.days.filter(d => !isToday(d.date)) ?? [];
  const subStatus = diary?.plan?.subStatus;

  if (loading) return <View style={s.loadingContainer}><ActivityIndicator color="#fff" size="large" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>

      {/* Toast */}
      {toast && (
        <View style={[s.toast, toast.ok ? s.toastOk : s.toastErr]}>
          <Text style={[s.toastText, { color: toast.ok ? '#4ade80' : '#fca5a5' }]}>{toast.msg}</Text>
        </View>
      )}

      {/* Header */}
      <Text style={s.greeting}>{getGreeting()}, <Text style={s.greetingName}>{member?.firstName}.</Text></Text>

      {/* QR Member Card */}
      {member && (
        <View style={s.memberCard}>
          {/* Top row — avatar + name + plan pill */}
          <View style={s.memberCardTop}>
            <TouchableOpacity onPress={() => setQrModal(true)} activeOpacity={0.8}>
              {member.image
                ? <Image source={{ uri: member.image }} style={s.memberAvatar} />
                : <View style={[s.memberAvatar, s.memberAvatarPlaceholder]}>
                    <Text style={s.memberAvatarText}>{member.firstName?.[0]}{member.lastName?.[0]}</Text>
                  </View>
              }
            </TouchableOpacity>
            <View style={s.memberNameBlock}>
              <Text style={s.memberName}>{member.firstName} {member.lastName}</Text>
              <Text style={s.memberIdText}>{member.memberId}</Text>
              <View style={s.memberPlanRow}>
                {diary?.plan && (
                  <View style={[s.planPill, { borderColor: subStatus === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)', backgroundColor: subStatus === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)' }]}>
                    <View style={[s.statusDot, { backgroundColor: subStatus === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
                    <Text style={[s.planPillText, { color: subStatus === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>{diary.plan.name}</Text>
                  </View>
                )}
              </View>
            </View>
            {/* QR small */}
            <TouchableOpacity onPress={() => setQrModal(true)} style={s.qrThumb} activeOpacity={0.8}>
              {member.qrCode && <Image source={{ uri: member.qrCode }} style={s.qrThumbImage} />}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.memberCardDivider} />

          {/* Bottom row — hint + wallet */}
          <View style={s.memberCardBottom}>
            <Text style={s.qrHint}>Tap QR to enlarge · Show at front desk</Text>
            {Platform.OS === 'ios' && (
              <TouchableOpacity onPress={handleAppleWallet} disabled={downloadingWallet} activeOpacity={0.8}>
                {downloadingWallet
                  ? <View style={s.walletGenerating}><Text style={s.walletGeneratingText}>Generating...</Text></View>
                  : <Image source={require('../../assets/add-to-apple-wallet.png')} style={s.walletBadge} resizeMode="contain" />
                }
              </TouchableOpacity>
            )}
            {Platform.OS === 'android' && (
              <TouchableOpacity onPress={handleGoogleWallet} activeOpacity={0.8}>
                <Image source={require('../../assets/google-wallet-badge.png')} style={s.walletBadge} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Family Section */}
      {family.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>YOUR FAMILY</Text>
          {family.map(child => {
            const age = getAge(child.dateOfBirth);
            const nextClass = child.nextBooking?.Class;
            return (
              <TouchableOpacity key={child.id} style={s.familyCard} onPress={() => router.push('/profile/family')} activeOpacity={0.7}>
                <View style={s.familyAvatarWrap}>
                  {child.image
                    ? <Image source={{ uri: child.image }} style={s.familyAvatarImg} />
                    : <View style={s.familyAvatarImgPlaceholder}><Text style={s.familyAvatarText}>{child.firstName[0]}{child.lastName[0]}</Text></View>
                  }
                </View>
                <View style={s.familyInfo}>
                  <Text style={s.familyName} numberOfLines={1}>{child.firstName} {child.lastName}</Text>
                  <Text style={s.familyMeta}>{age !== null ? `age ${age} · ` : ''}Junior member</Text>
                  {nextClass && <Text style={s.familyNext} numberOfLines={1}>Next: {nextClass.ClassType?.name} · {fmtTime(nextClass.startsAt)}</Text>}
                </View>
                <Text style={s.familyManageArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Today */}
      {todayDay && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>TODAY</Text>
          <TodayCard day={todayDay} activeClassId={activeClassId} hasFamily={family.length > 0} onBook={handleBook} onCancel={handleCancel} />
        </View>
      )}

      {/* Rest of week */}
      {restDays.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>THIS WEEK</Text>
          {restDays.map(day => (
            <FutureDayCard key={day.date} day={day} activeClassId={activeClassId} hasFamily={family.length > 0} onBook={handleBook} onCancel={handleCancel} />
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

      {/* Who's this class for? Modal */}
      <Modal visible={!!bookModal} transparent animationType="none" onRequestClose={() => setBookModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setBookModal(null)}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.header}>
              <Text style={m.headerLabel}>WHO'S THIS CLASS FOR?</Text>
              <Text style={m.headerClass}>{bookModal?.ev?.name}</Text>
              <Text style={m.headerMeta}>
                {bookModal?.ev?.startsAt ? new Date(bookModal.ev.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : ''}
                {bookModal?.ev?.location ? ' · ' + bookModal.ev.location : ''}
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
    </ScrollView>
  );
}

// ─── Diary Components ─────────────────────────────────────────────────────────

function OpenGymRow({ day }: { day: DiaryDay }) {
  const router = useRouter();

  if (day.gymClosed) return (
    <View style={s.gymRow}>
      <Text style={s.gymClosedText}>🔒  Gym closed{day.openGym.reason && day.openGym.reason !== 'Gym closed' ? ` — ${day.openGym.reason}` : ''}</Text>
    </View>
  );

  if (day.openGym.allowed) return (
    <View style={[s.gymRow, s.gymOpenRow]}>
      <Text style={s.gymOpenLabel}>Open gym — you're good to go</Text>
      <View style={s.slotRow}>
        {day.openGym.slots.map((sl, i) => (
          <View key={i} style={s.slotBadge}><Text style={s.slotText}>{sl.start}–{sl.end}</Text></View>
        ))}
      </View>
    </View>
  );

  // Not allowed — show locked times + upgrade link if gymSlots available
  const gymSlots = day.openGym.gymSlots ?? [];
  return (
    <View style={s.gymRow}>
      <View style={s.gymLockedRow}>
        <Text style={s.gymNotAvailText}>
          {day.openGym.reason ?? 'Open gym not available'}
        </Text>
        {gymSlots.length > 0 && (
          <View style={s.slotRow}>
            {gymSlots.map((sl, i) => (
              <View key={i} style={s.slotBadgeLocked}>
                <Text style={s.gymLockIcon}>🔒</Text>
                <Text style={s.slotTextLocked}>{sl.start}–{sl.end}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={() => router.push('/(tabs)/plans')} style={s.upgradeBtn} activeOpacity={0.8}>
          <Text style={s.upgradeBtnText}>Upgrade Plan →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ClassRow({ ev, activeClassId, hasFamily, onBook, onCancel }: { ev: ClassEvent; activeClassId: string|null; hasFamily: boolean; onBook: (e:ClassEvent)=>void; onCancel: (e:ClassEvent)=>void }) {
  const isLoading = activeClassId === ev.id;
  const isFull = ev.spotsLeft === 0 && !ev.isBooked;
  const barColor = ev.isBooked ? '#22c55e' : ev.includedInPlan ? '#6366f1' : ev.planPrice && ev.planPrice > 0 ? '#f59e0b' : '#3f3f46';

  return (
    <View style={s.eventRow}>
      <View style={[s.eventBar, { backgroundColor: barColor }]} />
      <View style={s.eventInfo}>
        <View style={s.eventTitleRow}>
          <Text style={s.eventTitle}>{ev.name}</Text>
          {ev.isBooked && <View style={s.tagGreen}><Text style={s.tagGreenText}>✓ Booked</Text></View>}
          {ev.isBooked && hasFamily && <View style={s.tagGreen}><Text style={s.tagGreenText}>✓ You're booked</Text></View>}
          {!ev.isBooked && ev.includedInPlan && <View style={s.tagGreen}><Text style={s.tagGreenText}>Included</Text></View>}
          {!ev.isBooked && !ev.includedInPlan && ev.planPrice !== null && ev.planPrice > 0 && <View style={s.tagAmber}><Text style={s.tagAmberText}>£{ev.planPrice.toFixed(2)}</Text></View>}
        </View>
        <Text style={s.eventMeta}>{fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}{ev.instructor ? ` · ${ev.instructor}` : ''}{ev.location ? ` · ${ev.location}` : ''}</Text>
        {!ev.isBooked && !isFull && <Text style={[s.spotsText, ev.spotsLeft <= 3 ? {color:'#f59e0b'} : {}]}>{ev.spotsLeft} spot{ev.spotsLeft !== 1 ? 's' : ''} left</Text>}
        {isFull && <Text style={[s.spotsText, {color:'#ef4444'}]}>Full</Text>}
      </View>
      <View style={s.eventAction}>
        {isFull && !ev.isBooked ? null : (
          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            {ev.isBooked && (
              <TouchableOpacity style={s.btnGrey} onPress={() => onCancel(ev)} disabled={isLoading}>
                <Text style={s.btnGreyText}>{isLoading ? '...' : 'Cancel'}</Text>
              </TouchableOpacity>
            )}
            {(!ev.isBooked || hasFamily) && (ev.includedInPlan || ev.planPrice === 0 || (ev.planPrice !== null && ev.planPrice > 0)) && (
              <TouchableOpacity style={s.btnWhite} onPress={() => onBook(ev)} disabled={isLoading}>
                <Text style={s.btnWhiteText}>
                  {isLoading ? '...' : ev.isBooked ? 'Book for family' : ev.planPrice !== null && ev.planPrice > 0 && !ev.includedInPlan ? 'Pay & Book' : 'Book'}
                </Text>
              </TouchableOpacity>
            )}
            {!ev.isBooked && !ev.includedInPlan && ev.planPrice === null && !ev.allowedByRule && (
              <Text style={s.naText}>Not on{'\n'}your plan</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function PtRow({ ev }: { ev: PtEvent }) {
  return (
    <View style={[s.eventRow, s.ptRowBg]}>
      <View style={[s.eventBar, { backgroundColor: '#8b5cf6' }]} />
      <View style={s.eventInfo}>
        <View style={s.eventTitleRow}>
          <View style={s.tagPurple}><Text style={s.tagPurpleText}>PT</Text></View>
          <Text style={s.eventTitle}>{ev.instructor}</Text>
        </View>
        <Text style={s.eventMeta}>{fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}</Text>
      </View>
      <View style={[s.statusPill, ev.status === 'CONFIRMED' ? s.statusGreen : ev.status === 'PENDING' ? s.statusAmber : s.statusGrey]}>
        <Text style={s.statusPillText}>{ev.status}</Text>
      </View>
    </View>
  );
}

function TodayCard({ day, activeClassId, hasFamily, onBook, onCancel }: { day:DiaryDay; activeClassId:string|null; hasFamily: boolean; onBook:(e:ClassEvent)=>void; onCancel:(e:ClassEvent)=>void }) {
  const classEvents = day.events.filter((e): e is ClassEvent => e.type === 'class');
  const ptEvents = day.events.filter((e): e is PtEvent => e.type === 'pt');
  return (
    <View style={s.dayCard}>
      <View style={s.dayCardHeader}>
        <View style={s.todayBadge}><Text style={s.todayBadgeText}>TODAY</Text></View>
        <Text style={s.dayCardDate}>{fmtDateFull(day.date)}</Text>
      </View>
      <OpenGymRow day={day} />
      {classEvents.length > 0 && (
        <>
          <View style={s.eventsLabel}><Text style={s.eventsLabelText}>CLASSES</Text></View>
          {classEvents.map(ev => <ClassRow key={ev.id} ev={ev} activeClassId={activeClassId} hasFamily={hasFamily} onBook={onBook} onCancel={onCancel} />)}
        </>
      )}
      {ptEvents.length > 0 && (
        <>
          <View style={s.eventsLabel}><Text style={s.eventsLabelText}>PT SESSIONS</Text></View>
          {ptEvents.map(ev => <PtRow key={ev.id} ev={ev} />)}
        </>
      )}
      {classEvents.length === 0 && ptEvents.length === 0 && (
        <Text style={s.noEventsText}>No classes or sessions scheduled</Text>
      )}
    </View>
  );
}

function FutureDayCard({ day, activeClassId, hasFamily, onBook, onCancel }: { day:DiaryDay; activeClassId:string|null; hasFamily: boolean; onBook:(e:ClassEvent)=>void; onCancel:(e:ClassEvent)=>void }) {
  const [expanded, setExpanded] = useState(false);
  const classEvents = day.events.filter((e): e is ClassEvent => e.type === 'class');
  const ptEvents = day.events.filter((e): e is PtEvent => e.type === 'pt');
  const classCount = classEvents.length;
  const ptCount = ptEvents.length;
  return (
    <View style={[s.dayCard, s.dayCardMargin]}>
      <TouchableOpacity style={s.futureDayHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={s.futureDayLeft}>
          <Text style={s.futureDayDate}>{fmtDateShort(day.date)}</Text>
          <View style={s.futureBadges}>
            {classCount > 0 && <View style={s.countBadge}><Text style={s.countBadgeText}>{classCount} class{classCount !== 1 ? 'es' : ''}</Text></View>}
            {ptCount > 0 && <View style={s.countBadgePurple}><Text style={s.countBadgePurpleText}>{ptCount} PT</Text></View>}
          </View>
        </View>
        <View style={s.futureDayRight}>
          {day.gymClosed ? <Text style={s.closedText}>Closed</Text>
            : day.openGym.allowed ? <View style={[s.statusDot, {backgroundColor:'#22c55e'}]} />
            : <View style={[s.statusDot, {backgroundColor:'#3f3f46'}]} />
          }
          <Text style={[s.chevron, expanded && s.chevronUp]}>›</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <>
          <OpenGymRow day={day} />
          {classEvents.length > 0 && (
            <>
              <View style={s.eventsLabel}><Text style={s.eventsLabelText}>CLASSES</Text></View>
              {classEvents.map(ev => <ClassRow key={ev.id} ev={ev} activeClassId={activeClassId} hasFamily={hasFamily} onBook={onBook} onCancel={onCancel} />)}
            </>
          )}
          {ptEvents.length > 0 && (
            <>
              <View style={s.eventsLabel}><Text style={s.eventsLabelText}>PT SESSIONS</Text></View>
              {ptEvents.map(ev => <PtRow key={ev.id} ev={ev} />)}
            </>
          )}
          {classEvents.length === 0 && ptEvents.length === 0 && <Text style={s.noEventsText}>No classes or sessions scheduled</Text>}
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },

  // Toast
  toast: { marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12 },
  toastOk: { backgroundColor: 'rgba(20,83,45,0.9)', borderWidth: 1, borderColor: '#166534' },
  toastErr: { backgroundColor: 'rgba(127,29,29,0.9)', borderWidth: 1, borderColor: '#991b1b' },
  toastText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Header
  greeting: { fontSize: 16, color: '#a0a0a0', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  greetingName: { fontSize: 16, color: '#ffffff', fontWeight: '800' },
  planPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  planPillText: { fontSize: 11, fontWeight: '700' },

  // Member Card
  memberCard: { marginHorizontal: 16, backgroundColor: '#141414', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1e1e1e', gap: 14 },
  memberCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 52, height: 52, borderRadius: 26 },
  memberAvatarPlaceholder: { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  memberNameBlock: { flex: 1, gap: 3 },
  memberName: { color: '#ffffff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  memberIdText: { color: '#71717a', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  memberPlanRow: { flexDirection: 'row', marginTop: 2 },
  qrThumb: { backgroundColor: '#ffffff', borderRadius: 10, padding: 4, width: 60, height: 60, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  qrThumbImage: { width: 52, height: 52, borderRadius: 4 },
  memberCardDivider: { height: 1, backgroundColor: '#1e1e1e' },
  memberCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qrHint: { fontSize: 11, color: '#3f3f46', flex: 1 },
  walletBadge: { width: 130, height: 42 },
  walletGenerating: { width: 130, height: 42, backgroundColor: '#1a1a1a', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46' },
  walletGeneratingText: { color: '#a0a0a0', fontSize: 11 },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 20, gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1.2 },

  // List Card (family)
  listCard: { backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginLeft: 68 },

  // Family
  familyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', gap: 12 },
  familyAvatarWrap: {},
  familyAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  familyAvatarImgPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  familyAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  familyInfo: { flex: 1, gap: 2, minWidth: 0 },
  familyName: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  familyMeta: { fontSize: 12, color: '#a1a1aa' },
  familyNext: { fontSize: 12, color: '#22c55e', marginTop: 2 },
  familyManageArrow: { color: '#3f3f46', fontSize: 22 },

  // Day Cards
  dayCard: { backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden' },
  dayCardMargin: { marginTop: 8 },
  dayCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  todayBadge: { backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  todayBadgeText: { color: '#0a0a0a', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dayCardDate: { fontSize: 16, fontWeight: '600', color: '#ffffff' },

  // Future day header
  futureDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  futureDayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  futureDayDate: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  futureBadges: { flexDirection: 'row', gap: 6 },
  countBadge: { backgroundColor: '#2a2a2a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  countBadgeText: { color: '#a0a0a0', fontSize: 11, fontWeight: '600' },
  countBadgePurple: { backgroundColor: 'rgba(139,92,246,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  countBadgePurpleText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },
  futureDayRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closedText: { fontSize: 12, color: '#ef4444' },
  chevron: { fontSize: 20, color: '#a1a1aa', transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },

  // Gym rows
  gymRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  gymOpenRow: { backgroundColor: 'rgba(34,197,94,0.05)' },
  gymClosedText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  gymOpenLabel: { fontSize: 13, color: '#4ade80', fontWeight: '600', marginBottom: 6 },
  gymNotAvailText: { fontSize: 13, color: '#a1a1aa' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotBadge: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  slotText: { color: '#4ade80', fontSize: 12 },
  gymLockedRow: { gap: 6 },
  slotBadgeLocked: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  gymLockIcon: { fontSize: 10 },
  slotTextLocked: { color: '#f87171', fontSize: 12 },
  upgradeBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  upgradeBtnText: { color: '#f59e0b', fontSize: 14, fontWeight: '700' },

  // Events
  eventsLabel: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  eventsLabelText: { fontSize: 10, color: '#a1a1aa', fontWeight: '700', letterSpacing: 1 },
  eventRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(42,42,42,0.6)', gap: 10 },
  ptRowBg: { backgroundColor: 'rgba(139,92,246,0.05)' },
  eventBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, minHeight: 40 },
  eventInfo: { flex: 1, gap: 3 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  eventMeta: { fontSize: 12, color: '#a1a1aa' },
  spotsText: { fontSize: 11, color: '#a1a1aa' },
  eventAction: { alignItems: 'flex-end' },
  noEventsText: { fontSize: 13, color: '#a1a1aa', textAlign: 'center', padding: 14 },

  // Tags
  tagGreen: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagGreenText: { color: '#4ade80', fontSize: 10, fontWeight: '600' },
  tagAmber: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagAmberText: { color: '#fbbf24', fontSize: 10, fontWeight: '600' },
  tagPurple: { backgroundColor: 'rgba(139,92,246,0.2)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagPurpleText: { color: '#a78bfa', fontSize: 10, fontWeight: '600' },

  // Buttons
  btnWhite: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnWhiteText: { color: '#0a0a0a', fontWeight: '700', fontSize: 13 },
  btnGrey: { backgroundColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnGreyText: { color: '#a0a0a0', fontSize: 13, fontWeight: '600' },
  naText: { color: '#a1a1aa', fontSize: 11, textAlign: 'right' },

  // PT status
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusGreen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  statusAmber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  statusGrey: { backgroundColor: '#2a2a2a' },
  statusPillText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },

  // QR Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1a1a1a', borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, marginHorizontal: 24 },
  qrModalImage: { width: 260, height: 260, borderRadius: 12, backgroundColor: '#ffffff' },
  modalName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  modalId: { fontSize: 12, color: '#a1a1aa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  modalClose: { backgroundColor: '#2a2a2a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  modalCloseText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
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
