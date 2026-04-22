import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch, apiPost } from '@/lib/api';
import { WithTabBar } from '@/components/WithTabBar';
import { useStripeDeepLink } from '@/hooks/useStripeDeepLink';
import { useAuth } from '@/context/AuthContext';

const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function formatGymSchedule(schedule: Record<string, any[]>, allowedDays: string[]) {
  const norm = allowedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1,3).toLowerCase());
  return DAY_ORDER.filter(d => norm.includes(d)).map(day => {
    const slots = schedule[day] ?? [];
    return { dayLabel: day, times: slots.length > 0 ? slots.map((s: any) => `${s.start}–${s.end}`).join(', ') : 'All day' };
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
    <View style={{ gap: 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 2 }}>
        <Text style={{ color: included ? '#22c55e' : '#3f3f46', fontSize: 13, fontWeight: '700', width: 16 }}>{included ? '✓' : '✕'}</Text>
        <Text style={{ flex: 1, fontSize: 13, color: included ? '#d4d4d8' : '#8e8e93', lineHeight: 18 }}>{text}</Text>
      </View>
      {subLines?.map((line, i) => (
        <View key={i} style={{ paddingLeft: 24, paddingVertical: 1 }}>
          <Text style={{ fontSize: 12, color: '#8e8e93', lineHeight: 16 }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ChildSubscription() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [child, setChild] = useState<any>(null);
  const [plansData, setPlansData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { refresh } = useAuth();

  async function load() {
    const [childData, plans] = await Promise.all([
      apiFetch(`/family/children/${id}`),
      apiFetch('/plans'),
    ]);
    setChild(childData);
    setPlansData(plans);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [id]);

  useStripeDeepLink({
    onSuccess: (type) => {
      if (type === 'subscription' || type === 'portal') {
        Alert.alert('Payment successful', `${child?.firstName ?? 'Child'}'s plan has been updated.`);
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

  async function handleBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await apiPost('/stripe/portal', {});
      await Linking.openURL(res.url);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not open billing portal');
    } finally { setPortalLoading(false); }
  }

  async function handleSelect(plan: any) {
    setActionLoading(plan.id);
    try {
      if (plan.planType === 'PAYG') {
        await apiPost('/enrollment/payg', { forMemberId: id });
        Alert.alert('Switched!', `${child?.firstName} is now on PAYG.`);
        await load();
      } else {
        const res = await apiPost('/stripe/checkout', { type: 'subscription', planId: plan.id, forMemberId: id });
        await Linking.openURL(res.url);
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionLoading(null); }
  }

  if (loading) return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Subscription' }} />
      <View style={s.center}><ActivityIndicator color="#fff" size="large" /></View>
    </WithTabBar>
  );

  const sub = child?.subscription;
  const subStatus = sub?.status;
  const currentPlanId = sub?.planId;
  const gymSchedule = plansData?.openGymSchedule ?? {};

  // MONTHLY + PAYG only, no DAY_PASS
  const membershipPlans = (plansData?.plans ?? []).filter((p: any) =>
    p.planType === 'MONTHLY' || p.planType === 'PAYG'
  );

  function buildFeatures(p: any) {
    const features: { text: string; included: boolean; subLines?: string[] }[] = [];
    const isPAYG = p.planType === 'PAYG';
    if (p.accessMode === 'OPEN_GYM' && p.allowedDays?.length > 0) {
      const lines = formatGymSchedule(gymSchedule, p.allowedDays);
      if (lines.length > 0) {
        features.push({ text: 'Open Gym access', included: true, subLines: lines.map(l => `${l.dayLabel}: ${l.times}`) });
      } else {
        features.push({ text: 'Open Gym access', included: true });
      }
    } else if (p.accessMode === 'NONE' || isPAYG) {
      features.push({ text: 'No open gym access', included: false });
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

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Subscription' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Current plan banner */}
        {currentPlanId && sub && (
          <View style={s.currentBanner}>
            <View>
              <Text style={s.currentBannerLabel}>CURRENT PLAN</Text>
              <Text style={s.currentBannerName}>
                {membershipPlans.find((p: any) => p.id === currentPlanId)?.name ?? '—'}
              </Text>
            </View>
            <View style={[s.statusPill, subStatus === 'ACTIVE' ? s.pillGreen : s.pillAmber]}>
              <View style={[s.statusDot, { backgroundColor: subStatus === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
              <Text style={[s.statusText, { color: subStatus === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>{subStatus}</Text>
            </View>
          </View>
        )}

        {/* Billing portal — only for Monthly with Stripe */}
        {sub?.stripeCustomerId && sub?.plan?.planType !== 'PAYG' && (
          <View style={s.billingCard}>
            <View style={s.billingCardLeft}>
              <Text style={s.billingCardTitle}>Billing & Payment</Text>
              <Text style={s.billingCardSub}>Billed to your account · manage card, invoices, cancel</Text>
            </View>
            <TouchableOpacity
              style={[s.billingBtn, portalLoading && { opacity: 0.6 }]}
              onPress={handleBillingPortal}
              disabled={portalLoading}
              activeOpacity={0.8}>
              <Text style={s.billingBtnText}>{portalLoading ? '...' : 'Manage →'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Page header */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Change Plan</Text>
          <Text style={s.pageSub}>Choose a plan for {child?.firstName}</Text>
        </View>

        {/* No plan state */}
        {!sub && (
          <View style={s.noPlanCard}>
            <Text style={s.noPlanTitle}>No active plan</Text>
            <Text style={s.noPlanDesc}>Choose a plan to start booking classes for {child?.firstName}.</Text>
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
              <View style={s.planHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.planPrice}>
                    {p.price === 0 ? 'Free' : `£${p.price}`}
                    {p.price > 0 && !isPAYG && <Text style={s.planPriceSub}>/mo</Text>}
                  </Text>
                  <Text style={s.planName}>{p.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  {isPAYG && <View style={s.paygBadge}><Text style={s.paygBadgeText}>PAYG</Text></View>}
                  {isCurrentPlan && <View style={s.currentBadge}><Text style={s.currentBadgeText}>● Current</Text></View>}
                </View>
              </View>

              {p.description && <Text style={s.planDesc}>{p.description}</Text>}

              <TouchableOpacity
                style={s.detailsToggle}
                onPress={() => setExpandedPlan(isExpanded ? null : p.id)}
                activeOpacity={0.7}>
                <Text style={s.detailsToggleText}>{isExpanded ? 'Hide details' : "See what's included"}</Text>
                <Text style={[s.detailsChevron, isExpanded && { transform: [{ rotate: '180deg' }] }]}>⌄</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={s.features}>
                  {features.map((feat, i) => (
                    <FeatureRow key={i} included={feat.included} text={feat.text} subLines={feat.subLines} />
                  ))}
                </View>
              )}

              {isCurrentPlan && subStatus === 'ACTIVE' ? (
                <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                  <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '600' }}>✓ {child?.firstName}'s current plan</Text>
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
                  {!isPAYG && <Text style={s.disclaimer}>Cancel anytime. Access continues until end of billing period.</Text>}
                </>
              )}
            </View>
          );
        })}

      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  currentBanner: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentBannerLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  currentBannerName: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
  pillAmber: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  billingCard: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', gap: 12 },
  billingCardLeft: { flex: 1, gap: 3 },
  billingCardTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  billingCardSub: { fontSize: 12, color: '#a1a1aa', lineHeight: 16 },
  billingBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  billingBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  pageHeader: { alignItems: 'center', paddingVertical: 4 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  pageSub: { fontSize: 13, color: '#a1a1aa', marginTop: 4 },
  noPlanCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', gap: 6 },
  noPlanTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  noPlanDesc: { fontSize: 13, color: '#a0a0a0' },
  planCard: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  planCardCurrent: { borderColor: '#22c55e', borderWidth: 1.5 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planPrice: { fontSize: 30, fontWeight: '800', color: '#fff' },
  planPriceSub: { fontSize: 14, fontWeight: '400', color: '#a1a1aa' },
  planName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  paygBadge: { backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  paygBadgeText: { color: '#a1a1aa', fontSize: 10, fontWeight: '600' },
  currentBadge: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  currentBadgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  planDesc: { fontSize: 13, color: '#a1a1aa', lineHeight: 18 },
  detailsToggle: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsToggleText: { color: '#a0a0a0', fontSize: 13 },
  detailsChevron: { color: '#a1a1aa', fontSize: 18 },
  features: { borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 12, gap: 2 },
  selectBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center' },
  selectBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
  disclaimer: { fontSize: 11, color: '#3f3f46', textAlign: 'center' },
});
