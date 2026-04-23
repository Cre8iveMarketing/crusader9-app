import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, Platform, RefreshControl
} from 'react-native';
import { apiFetch, apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { addDays, format } from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Plan {
  id: string; name: string; slug: string; description: string; price: number;
  planType: string; accessMode: string; allowedDays: string[]; accessStart: string | null;
  accessEnd: string | null; accessSchedule: any; includesClasses: boolean;
  weeklyClassCredits: number; classCredits: number; lockerIncluded: boolean;
  guestPasses: number; stripePriceId: string | null;
  classRules: { maxPerDay: any; maxPerWeek: number; classTypeName: string }[];
}

interface PlansData {
  currentPlanId: string | null; subStatus: string | null;
  closedDates: string[]; openGymSchedule: Record<string, { start: string; end: string }[]>;
  plans: Plan[];
}

function formatSchedule(schedule: Record<string, { start: string; end: string }[]>): string {
  return DAY_ORDER
    .filter(d => schedule[d]?.length > 0)
    .map(d => `${d}: ${schedule[d].map(s => `${s.start}–${s.end}`).join(', ')}`)
    .join('\n');
}

function PlanCard({ plan, currentPlanId, subStatus, closedDates, openGymSchedule, onSelect }: {
  plan: Plan; currentPlanId: string | null; subStatus: string | null;
  closedDates: string[]; openGymSchedule: Record<string, any>; onSelect: (p: Plan, dates?: string[]) => void;
}) {
  const isCurrent = plan.id === currentPlanId;
  const isDayPass = plan.planType === 'DAY_PASS';
  const isPAYG = plan.planType === 'PAYG';
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const calDates = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i);
    return d.toISOString().split('T')[0];
  });

  function toggleDate(date: string) {
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  }

  const schedule = openGymSchedule;
  const scheduleStr = Object.keys(schedule).length > 0 ? formatSchedule(schedule) : null;

  const priceStr = isPAYG ? 'Free' :
    isDayPass ? `£${plan.price.toFixed(2)}/day` :
    `£${plan.price.toFixed(2)}/mo`;

  return (
    <View style={[s.card, isCurrent && s.cardCurrent]}>
      {isCurrent && (
        <View style={s.currentBadge}><Text style={s.currentBadgeText}>Current Plan</Text></View>
      )}
      {isDayPass && (
        <View style={s.dropInBadge}><Text style={s.dropInBadgeText}>Drop-in</Text></View>
      )}

      <View style={s.cardHeader}>
        <Text style={s.planPrice}>{priceStr}</Text>
        <Text style={s.planName}>{plan.name}</Text>
      </View>

      {plan.description && <Text style={s.planDesc}>{plan.description}</Text>}

      {/* See what's included toggle */}
      {!isDayPass && (
        <TouchableOpacity
          style={s.detailsToggle}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}>
          <Text style={s.detailsToggleText}>{isExpanded ? 'Hide details' : "See what's included"}</Text>
          <Text style={[s.detailsChevron, isExpanded && s.detailsChevronUp]}>⌄</Text>
        </TouchableOpacity>
      )}

      {/* Features — always visible on day pass, toggleable on membership plans */}
      {(isDayPass || isExpanded) && (
      <View style={s.features}>
        {/* Open gym access */}
        {plan.accessMode !== 'NONE' && scheduleStr && (
          <View style={s.featureRow}>
            <Text style={s.featureTick}>✓</Text>
            <View style={s.featureTextBlock}>
              <Text style={s.featureText}>Open Gym access</Text>
              <Text style={s.featureSubText}>{scheduleStr}</Text>
            </View>
          </View>
        )}

        {/* Class credits */}
        {plan.includesClasses && plan.weeklyClassCredits > 0 && (
          <View style={s.featureRow}>
            <Text style={s.featureTick}>✓</Text>
            <Text style={s.featureText}>
              {plan.weeklyClassCredits} coach-led class{plan.weeklyClassCredits !== 1 ? 'es' : ''} per week included
              {plan.classRules.length > 0 && ` (${plan.classRules.map(r => r.classTypeName).join(', ')})`}
            </Text>
          </View>
        )}

        {/* Classes available */}
        <View style={s.featureRow}>
          <Text style={plan.planType !== 'NONE' ? s.featureTick : s.featureCross}>
            {plan.planType !== 'NONE' ? '✓' : '✗'}
          </Text>
          <Text style={s.featureText}>Classes available to book & pay</Text>
        </View>

        {/* PT */}
        <View style={s.featureRow}>
          <Text style={plan.planType !== 'NONE' ? s.featureTick : s.featureCross}>
            {plan.planType !== 'NONE' ? '✓' : '✗'}
          </Text>
          <Text style={s.featureText}>PT sessions available to book & pay</Text>
        </View>

        {/* Day pass specifics */}
        {isDayPass && (
          <>
            <View style={s.featureRow}>
              <Text style={s.featureTick}>✓</Text>
              <Text style={s.featureText}>Valid for one day only</Text>
            </View>
            <View style={s.featureRow}>
              <Text style={s.featureCross}>✗</Text>
              <Text style={s.featureTextMuted}>Classes not included</Text>
            </View>
            <View style={s.featureRow}>
              <Text style={s.featureCross}>✗</Text>
              <Text style={s.featureTextMuted}>PT not included</Text>
            </View>
          </>
        )}
      </View>
      )}

      {/* Day pass calendar */}
      {isDayPass && (
        <View style={s.calendar}>
          <Text style={s.calLabel}>SELECT DATES</Text>
          <View style={s.calHeader}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <Text key={i} style={s.calDayLabel}>{d}</Text>
            ))}
          </View>
          <View style={s.calGrid}>
            {(() => {
              // Find what day of week the first date falls on (0=Sun...6=Sat)
              // Convert to Mon-based offset (Mon=0, Tue=1...Sun=6)
              const firstDate = new Date(calDates[0] + 'T12:00:00');
              const firstDow = firstDate.getDay(); // 0=Sun
              const offset = firstDow === 0 ? 6 : firstDow - 1; // Mon-based
              const cells: React.ReactNode[] = [];
              // Add empty cells for offset
              for (let i = 0; i < offset; i++) {
                cells.push(<View key={`empty-${i}`} style={s.calDay} />);
              }
              // Add date cells
              calDates.forEach(date => {
                const d = new Date(date + 'T12:00:00');
                const isClosed = closedDates.includes(date);
                const isSelected = selectedDates.includes(date);
                cells.push(
                  <TouchableOpacity
                    key={date}
                    style={[s.calDay, isSelected && s.calDaySelected, isClosed && s.calDayClosed]}
                    onPress={() => !isClosed && toggleDate(date)}
                    disabled={isClosed}
                  >
                    <Text style={[s.calDayText, isSelected && s.calDayTextSelected, isClosed && s.calDayTextClosed]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              });
              return cells;
            })()}
          </View>
        </View>
      )}

      {/* Action button */}
      {!isCurrent && (
        <TouchableOpacity
          style={[s.actionBtn, isDayPass && selectedDates.length === 0 && s.actionBtnDisabled]}
          onPress={() => onSelect(plan, isDayPass ? selectedDates : undefined)}
          disabled={isDayPass && selectedDates.length === 0}
        >
          <Text style={s.actionBtnText}>
            {isDayPass
              ? selectedDates.length === 0 ? 'Select dates above' : `Buy Day Pass${selectedDates.length > 1 ? ` (${selectedDates.length} days)` : ''}`
              : isPAYG ? 'Switch to PAYG (Free)'
              : `Switch Plan — £${plan.price.toFixed(2)}/mo`}
          </Text>
        </TouchableOpacity>
      )}

      {isCurrent && (
        <View style={s.currentInfo}>
          <Text style={s.currentInfoText}>
            {subStatus === 'ACTIVE' ? '✓ Active membership' : subStatus ?? ''}
          </Text>
        </View>
      )}

      {!isCurrent && !isDayPass && (
        <Text style={s.cancelNote}>Cancel anytime. Access continues until end of billing period. No refunds.</Text>
      )}
    </View>
  );
}

export default function Plans() {
  const { member } = useAuth();
  const { forChild } = useLocalSearchParams<{ forChild?: string }>();
  const [data, setData] = useState<PlansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [childContext, setChildContext] = useState<{ id: string; firstName: string; lastName: string; subscription: any } | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  async function loadPlans() {
    const d = await apiFetch('/plans');
    if (Array.isArray(d)) {
      setData({ currentPlanId: null, subStatus: null, closedDates: [], openGymSchedule: {}, plans: d });
    } else {
      setData(d);
    }
  }

  useEffect(() => { loadPlans().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    if (!forChild) { setChildContext(null); return; }
    apiFetch(`/family/children/${forChild}`)
      .then(c => setChildContext({ id: c.id, firstName: c.firstName, lastName: c.lastName, subscription: c.subscription }))
      .catch(() => setChildContext(null));
  }, [forChild]);

  useFocusEffect(useCallback(() => {
    loadPlans();
  }, []));

  async function onRefresh() { setRefreshing(true); await loadPlans(); setRefreshing(false); }

  async function handleSelect(plan: Plan, dates?: string[]) {
    const forMemberId = childContext?.id;
    try {
      if (plan.planType === 'DAY_PASS') {
        if (!dates || dates.length === 0) { Alert.alert('Select dates', 'Please select at least one date'); return; }
        const intentRes = await apiPost('/stripe/payment-intent', { type: 'day_pass', dates, ...(forMemberId && { forMemberId }) });
        const { error: initError } = await initPaymentSheet({ paymentIntentClientSecret: intentRes.clientSecret, merchantDisplayName: 'Crusader 9 Boxing', style: 'alwaysDark', returnURL: 'crusader9://stripe-success' });
        if (initError) { Alert.alert('Error', initError.message); return; }
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) { if (presentError.code !== 'Canceled') Alert.alert('Payment failed', presentError.message); return; }
        await apiPost('/stripe/confirm-booking', { paymentIntentId: intentRes.clientSecret.split('_secret_')[0], type: 'day_pass', dates, ...(forMemberId && { forMemberId }) });
        Alert.alert('Day Pass purchased!', `Access confirmed for ${dates.length} day${dates.length > 1 ? 's' : ''}.`);
        await loadPlans();
      } else if (plan.planType === 'PAYG') {
        await apiPost('/enrollment/payg', forMemberId ? { forMemberId } : {});
        Alert.alert('Enrolled!', childContext ? `${childContext.firstName} is now on PAYG.` : 'You are now on PAYG.');
        await loadPlans();
      } else {
        const res = await apiPost('/stripe/checkout', { type: 'subscription', planId: plan.id, ...(forMemberId && { forMemberId }) });
        await Linking.openURL(res.url);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong');
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.white} size="large" /></View>;

  const effectiveCurrentPlanId = childContext
    ? childContext.subscription?.planId ?? null
    : data?.currentPlanId ?? null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}>
      <Text style={s.pageTitle}>Membership Plans</Text>
      <Text style={s.pageSub}>Choose the plan that works for you</Text>

      {childContext && (
        <View style={s.childContextBanner}>
          <Text style={s.childContextText}>Choosing a plan for <Text style={s.childContextName}>{childContext.firstName} {childContext.lastName}</Text></Text>
          <TouchableOpacity onPress={() => setChildContext(null)}>
            <Text style={s.childContextClear}>✕ Back to my plans</Text>
          </TouchableOpacity>
        </View>
      )}

      {data?.currentPlanId && !childContext && (
        <View style={s.currentPlanBanner}>
          <Text style={s.currentPlanBannerLabel}>CURRENT PLAN</Text>
          <Text style={s.currentPlanBannerName}>
            {data.plans.find(p => p.id === data.currentPlanId)?.name ?? ''}
          </Text>
          <Text style={[s.currentPlanBannerStatus, { color: data.subStatus === 'ACTIVE' ? Colors.green : Colors.amber }]}>
            {data.subStatus}
          </Text>
        </View>
      )}

      {data?.plans.map(plan => (
        <PlanCard
          key={plan.id}
          plan={plan}
          currentPlanId={effectiveCurrentPlanId}
          subStatus={data.subStatus}
          closedDates={data.closedDates}
          openGymSchedule={data.openGymSchedule}
          onSelect={handleSelect}
        />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 14, color: Colors.textMuted, marginTop: -8 },

  currentPlanBanner: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#22c55e33', flexDirection: 'row', alignItems: 'center', gap: 10 },
  currentPlanBannerLabel: { fontSize: 10, fontWeight: '700', color: Colors.textFaint, letterSpacing: 1 },
  currentPlanBannerName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  currentPlanBannerStatus: { fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2a2a2a', gap: 12 },
  cardCurrent: { borderColor: '#22c55e55' },
  currentBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  currentBadgeText: { color: '#4ade80', fontSize: 11, fontWeight: '700' },
  dropInBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dropInBadgeText: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },

  cardHeader: { gap: 4 },
  planName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  planPrice: { fontSize: 26, fontWeight: '800', color: Colors.text },
  planDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  detailsToggle: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsToggleText: { color: '#a0a0a0', fontSize: 13 },
  detailsChevron: { color: '#a1a1aa', fontSize: 18 },
  detailsChevronUp: { transform: [{ rotate: '180deg' }] },

  features: { gap: 8 },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureTick: { color: '#4ade80', fontSize: 13, fontWeight: '700', width: 14 },
  featureCross: { color: '#a1a1aa', fontSize: 13, width: 14 },
  featureText: { color: Colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  featureTextMuted: { color: Colors.textFaint, fontSize: 13, flex: 1 },
  featureTextBlock: { flex: 1 },
  featureSubText: { color: Colors.textFaint, fontSize: 11, marginTop: 2, lineHeight: 16 },

  calendar: { gap: 8, paddingTop: 4 },
  calLabel: { fontSize: 10, fontWeight: '700', color: Colors.textFaint, letterSpacing: 1 },
  calHeader: { flexDirection: 'row' },
  calDayLabel: { color: '#a1a1aa', fontSize: 11, width: '14.28%', textAlign: 'center', marginBottom: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDay: { width: '14.28%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#242424', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  calDaySelected: { backgroundColor: Colors.white },
  calDayClosed: { opacity: 0.25 },
  calDayText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  calDayTextSelected: { color: Colors.bg },
  calDayTextClosed: { color: Colors.textFaint },

  actionBtn: { backgroundColor: Colors.white, padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnDisabled: { backgroundColor: '#2a2a2a' },
  actionBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 15 },
  currentInfo: { alignItems: 'center', paddingVertical: 4 },
  currentInfoText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  cancelNote: { color: Colors.textFaint, fontSize: 11, textAlign: 'center' },
  childContextBanner: { backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', borderRadius: 12, padding: 14, gap: 6 },
  childContextText: { color: '#a0a0a0', fontSize: 14 },
  childContextName: { color: '#ffffff', fontWeight: '700' },
  childContextClear: { color: '#8b5cf6', fontSize: 13, fontWeight: '600' },
});
