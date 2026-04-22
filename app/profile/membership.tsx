import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { apiFetch, apiPost } from '@/lib/api';
import { useStripe } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';
import { WithTabBar } from '@/components/WithTabBar';
import { useStripeDeepLink } from '@/hooks/useStripeDeepLink';
import { useAuth } from '@/context/AuthContext';

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function formatGymSchedule(schedule: Record<string, any[]>, allowedDays: string[]) {
  // Mobile API returns 3-letter keys (Mon, Tue...) and 3-letter allowedDays
  const norm = allowedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1,3).toLowerCase());
  const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return DAY_ABBR
    .filter(d => norm.includes(d))
    .map(day => {
      const slots = schedule[day] ?? [];
      const times = slots.length > 0
        ? slots.map((s: any) => `${s.start}–${s.end}`).join(', ')
        : 'All day';
      return { dayLabel: day, times };
    });
}

function getClassDays(classRules: any[]) {
  const days: string[] = [];
  for (const rule of classRules ?? []) {
    for (const [day, max] of Object.entries(rule.maxPerDay ?? {})) {
      if ((max as number) > 0 && !days.includes(day.slice(0,3))) days.push(day.slice(0,3));
    }
  }
  return days;
}

function FeatureRow({ included, text, subLines }: { included: boolean; text: string; subLines?: string[] }) {
  return (
    <View style={fr.wrapper}>
      <View style={fr.row}>
        <Text style={{ color: included ? '#22c55e' : '#3f3f46', fontSize: 13, fontWeight: '700', width: 16 }}>{included ? '✓' : '✕'}</Text>
        <Text style={{ flex: 1, fontSize: 13, color: included ? '#d4d4d8' : '#8e8e93', lineHeight: 18 }}>{text}</Text>
      </View>
      {subLines && subLines.map((line, i) => (
        <View key={i} style={fr.subRow}>
          <Text style={fr.subText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}
const fr = StyleSheet.create({
  wrapper: { gap: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 2 },
  subRow: { paddingLeft: 24, paddingVertical: 1 },
  subText: { fontSize: 12, color: '#8e8e93', lineHeight: 16 },
});

export default function ProfileMembership() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [plansData, setPlansData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { refresh } = useAuth();

  async function load() {
    const [meData, plans] = await Promise.all([apiFetch('/me'), apiFetch('/plans')]);
    setMe(meData);
    setPlansData(plans);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  useStripeDeepLink({
    onSuccess: (type) => {
      if (type === 'subscription' || type === 'portal') {
        Alert.alert('Payment successful', 'Your plan has been updated.');
        load();
        refresh();
      }
    },
    onCancel: (type) => {
      if (type === 'subscription') Alert.alert('Cancelled', 'No charge was made.');
    },
    onPortalReturn: () => {
      load();
      refresh();
    },
  });

  const currentPlanId = plansData?.currentPlanId;
  const gymSchedule = plansData?.openGymSchedule ?? {};
  const sub = me?.subscription;
  const subStatus = sub?.status;

  // Filter — MONTHLY and PAYG only, no DAY_PASS
  const membershipPlans = (plansData?.plans ?? []).filter((p: any) => p.planType === 'MONTHLY' || p.planType === 'PAYG');

  function buildFeatures(p: any) {
    const features: { text: string; included: boolean; subLines?: string[] }[] = [];
    const isPAYG = p.planType === 'PAYG';
    if (p.accessMode === 'OPEN_GYM' && p.allowedDays?.length > 0) {
      const lines = formatGymSchedule(gymSchedule, p.allowedDays);
      if (lines.length > 0) {
        features.push({ text: 'Open Gym access', included: true, subLines: lines.map(l => `${l.dayLabel}: ${l.times}`) });
      } else {
        features.push({ text: 'Open Gym access', included: true, subLines: [] });
      }
    } else if (p.accessMode === 'NONE' || isPAYG) {
      features.push({ text: 'No open gym access', included: false, subLines: [] });
    }
    if (p.includesClasses) {
      const classDays = getClassDays(p.classRules);
      const dayStr = classDays.length > 0 ? ` (${classDays.join(' & ')})` : '';
      const credits = p.weeklyClassCredits ?? 0;
      features.push({ text: `${credits} class${credits !== 1 ? 'es' : ''} per week${dayStr} included`, included: true });
    }
    features.push({ text: 'Classes available to book & pay', included: true });
    features.push({ text: 'PT sessions available to book & pay', included: true });
    if (p.lockerIncluded) features.push({ text: 'Locker included', included: true });
    if (p.guestPasses > 0) features.push({ text: `${p.guestPasses} guest pass${p.guestPasses > 1 ? 'es' : ''}/month`, included: true });
    return features;
  }

  async function handleSelect(plan: any) {
    const isCurrentPlan = plan.id === currentPlanId;
    if (isCurrentPlan) return;
    setActionLoading(plan.id);
    try {
      if (plan.planType === 'PAYG') {
        await apiPost('/enrollment/payg', {});
        Alert.alert('Switched!', 'You are now on PAYG.');
        await load();
      } else {
        const res = await apiPost('/stripe/checkout', { type: 'subscription', planId: plan.id });
        await Linking.openURL(res.url);
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionLoading(null); }
  }

  if (loading) return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Membership' }} />
      <View style={s.center}><ActivityIndicator color="#fff" size="large" /></View>
    </WithTabBar>
  );

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Membership' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Membership Plans</Text>
          <Text style={s.pageSub}>Choose the plan that works for you</Text>
        </View>

        {/* Current plan status banner */}
        {currentPlanId && sub && (
          <View style={s.currentPlanBanner}>
            <View style={s.currentPlanBannerLeft}>
              <Text style={s.currentPlanBannerLabel}>CURRENT PLAN</Text>
              <Text style={s.currentPlanBannerName}>
                {membershipPlans.find((p: any) => p.id === currentPlanId)?.name ?? sub?.plan?.name ?? '—'}
              </Text>
            </View>
            <View style={[
              s.currentPlanStatusPill,
              subStatus === 'ACTIVE' ? s.statusGreen : s.statusAmber
            ]}>
              <View style={[s.statusDot, { backgroundColor: subStatus === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
              <Text style={[s.statusPillText, { color: subStatus === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>
                {subStatus}
              </Text>
            </View>
          </View>
        )}

        {/* Plan cards */}
        {membershipPlans.map((p: any) => {
          const isCurrentPlan = p.id === currentPlanId;
          const isPAYG = p.planType === 'PAYG';
          const features = buildFeatures(p);
          const isLoading = actionLoading === p.id;
          const isExpanded = expandedPlan === p.id;

          return (
            <View key={p.id} style={[s.planCard, isCurrentPlan && s.planCardCurrent]}>
              {/* Price + name header */}
              <View style={s.planHeader}>
                <View style={s.planHeaderLeft}>
                  <Text style={s.planPrice}>
                    {p.price === 0 ? 'Free' : `£${p.price}`}
                    {p.price > 0 && !isPAYG && <Text style={s.planPriceSub}>/mo</Text>}
                  </Text>
                  <Text style={s.planName}>{p.name}</Text>
                </View>
                <View style={s.badges}>
                  {isPAYG && <View style={s.paygBadge}><Text style={s.paygBadgeText}>PAYG</Text></View>}
                  {isCurrentPlan && <View style={s.currentBadge}><Text style={s.currentBadgeText}>● Current</Text></View>}
                </View>
              </View>

              {/* Description */}
              {p.description && <Text style={s.planDesc}>{p.description}</Text>}

              {/* See what's included toggle */}
              <TouchableOpacity
                style={s.detailsToggle}
                onPress={() => setExpandedPlan(isExpanded ? null : p.id)}
                activeOpacity={0.7}>
                <Text style={s.detailsToggleText}>{isExpanded ? 'Hide details' : "See what's included"}</Text>
                <Text style={[s.detailsChevron, isExpanded && s.detailsChevronUp]}>⌄</Text>
              </TouchableOpacity>

              {/* Expandable features */}
              {isExpanded && (
                <View style={s.features}>
                  {features.map((feat: any, i: number) => (
                    <FeatureRow key={i} included={feat.included} text={feat.text} subLines={feat.subLines} />
                  ))}
                </View>
              )}

              {/* Action — always visible */}
              {isCurrentPlan && subStatus === 'ACTIVE' ? (
                <View style={s.activeRow}>
                  <Text style={s.activeText}>✓ Your current plan</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[s.selectBtn, isLoading && { opacity: 0.6 }]}
                    onPress={() => handleSelect(p)}
                    disabled={isLoading}
                    activeOpacity={0.8}>
                    <Text style={s.selectBtnText}>
                      {isLoading ? 'Loading...' : isPAYG ? 'Switch to PAYG' : `Switch Plan — £${p.price}/mo`}
                    </Text>
                  </TouchableOpacity>
                  {!isPAYG && <Text style={s.disclaimer}>Cancel anytime. Access continues until end of billing period. No refunds.</Text>}
                </>
              )}
            </View>
          );
        })}

        {/* Cancel note */}
        {sub && sub.planType !== 'PAYG' && sub.stripeCustomerId && (
          <View style={s.cancelCard}>
            <Text style={s.cancelLabel}>CANCEL SUBSCRIPTION</Text>
            <Text style={s.cancelDesc}>You can cancel anytime via the Billing Portal above. Access continues until the end of your current billing period.</Text>
          </View>
        )}
        {sub && sub.planType === 'PAYG' && (
          <View style={s.cancelCard}>
            <Text style={s.cancelLabel}>CANCEL MEMBERSHIP</Text>
            <Text style={s.cancelDesc}>To cancel your PAYG membership, contact gym staff.</Text>
          </View>
        )}

      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  pageHeader: { alignItems: 'center', paddingVertical: 8 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  pageSub: { fontSize: 13, color: '#a1a1aa', marginTop: 4 },
  planCard: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  planCardCurrent: { borderColor: '#22c55e', borderWidth: 1.5 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planHeaderLeft: { flex: 1, gap: 2 },
  planPrice: { fontSize: 30, fontWeight: '800', color: '#fff' },
  planPriceSub: { fontSize: 14, fontWeight: '400', color: '#a1a1aa' },
  planName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  badges: { flexDirection: 'column', alignItems: 'flex-end', gap: 5 },
  paygBadge: { backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  paygBadgeText: { color: '#a1a1aa', fontSize: 10, fontWeight: '600' },
  currentBadge: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  currentBadgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  planDesc: { fontSize: 13, color: '#a1a1aa', lineHeight: 18 },
  detailsToggle: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsToggleText: { color: '#a0a0a0', fontSize: 13 },
  detailsChevron: { color: '#a1a1aa', fontSize: 18 },
  detailsChevronUp: { transform: [{ rotate: '180deg' }] },
  features: { borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 12, gap: 2 },
  activeRow: { alignItems: 'center', paddingVertical: 6 },
  activeText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  selectBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center' },
  selectBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
  currentPlanBanner: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentPlanBannerLeft: { gap: 2 },
  currentPlanBannerLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  currentPlanBannerName: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  currentPlanStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
  statusAmber: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  disclaimer: { fontSize: 11, color: '#3f3f46', textAlign: 'center', marginTop: -4 },
  cancelCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', gap: 6 },
  cancelLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  cancelDesc: { fontSize: 13, color: '#a0a0a0', lineHeight: 18 },
});
