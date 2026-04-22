import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { apiFetch, apiPost } from '@/lib/api';
import { format } from 'date-fns';
import { WithTabBar } from '@/components/WithTabBar';
import { useStripeDeepLink } from '@/hooks/useStripeDeepLink';
import { useAuth } from '@/context/AuthContext';

function fmtDate(iso: string) { try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; } }
function fmtDateTime(iso: string) { try { return format(new Date(iso), 'd MMM yyyy · HH:mm'); } catch { return iso; } }

function descIcon(desc: string) {
  if (!desc) return '💳';
  if (desc.toLowerCase().includes('class')) return '🥊';
  if (desc.toLowerCase().includes('pt') || desc.toLowerCase().includes('session')) return '🏋️';
  if (desc.toLowerCase().includes('day pass')) return '🎟️';
  if (desc.toLowerCase().includes('subscription')) return '📅';
  return '💳';
}

export default function ProfileBilling() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const { refresh } = useAuth();

  async function loadBilling() {
    try { setData(await apiFetch('/billing')); } catch {}
  }

  useEffect(() => { loadBilling().finally(() => setLoading(false)); }, []);

  useStripeDeepLink({
    onSuccess: (type) => {
      if (type === 'subscription' || type === 'portal') {
        loadBilling();
        refresh();
      }
    },
    onCancel: () => {},
    onPortalReturn: () => {
      loadBilling();
      refresh();
    },
  });

  async function handleBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await apiPost('/stripe/portal', {});
      await Linking.openURL(res.url);
    } catch (e: any) { Alert.alert('Error', e.message ?? 'Could not open billing portal'); }
    finally { setPortalLoading(false); }
  }

  if (loading) return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Billing' }} />
      <View style={s.center}><ActivityIndicator color="#fff" size="large" /></View>
    </WithTabBar>
  );

  const sub = data?.subscription;
  const children = data?.children ?? [];
  const payments = data?.payments ?? [];
  const hasStripe = !!sub?.stripeCustomerId && sub?.plan?.planType !== 'PAYG';

  // Group payments by month
  const grouped: Record<string, any[]> = {};
  for (const p of payments) {
    const month = p.createdAt ? format(new Date(p.createdAt), 'MMMM yyyy') : 'Unknown';
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(p);
  }

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Billing' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Manage billing portal */}
        {hasStripe && (
          <View style={s.portalCard}>
            <View style={s.portalLeft}>
              <Text style={s.portalTitle}>Stripe Billing Portal</Text>
              <Text style={s.portalSub}>Update payment method, download invoices, cancel subscription</Text>
            </View>
            <TouchableOpacity style={[s.portalBtn, portalLoading && { opacity: 0.6 }]}
              onPress={handleBillingPortal} disabled={portalLoading} activeOpacity={0.8}>
              <Text style={s.portalBtnText}>{portalLoading ? '...' : 'Open →'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Memberships */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>MEMBERSHIPS</Text>

          {/* Parent */}
          <View style={s.memberRow}>
            <View style={s.memberRowLeft}>
              <Text style={s.memberRowName}>You</Text>
              {sub ? (
                <>
                  <Text style={s.memberRowPlan}>{sub.plan?.name ?? 'Unknown plan'}</Text>
                  {sub.currentPeriodEnd && (
                    <Text style={s.memberRowRenewal}>
                      {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {fmtDate(sub.currentPeriodEnd)}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={s.memberRowPlan}>No active plan</Text>
              )}
            </View>
            {sub && (
              <View style={[s.statusPill, sub.status === 'ACTIVE' ? s.pillGreen : s.pillAmber]}>
                <View style={[s.statusDot, { backgroundColor: sub.status === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
                <Text style={[s.statusText, { color: sub.status === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>
                  {sub.plan?.planType === 'PAYG' ? 'PAYG' : sub.status}
                </Text>
              </View>
            )}
          </View>

          {/* Children */}
          {children.map((child: any) => (
            <View key={child.id} style={[s.memberRow, s.memberRowBorder]}>
              <View style={s.memberRowLeft}>
                <Text style={s.memberRowName}>{child.firstName} {child.lastName}</Text>
                {child.subscription ? (
                  <>
                    <Text style={s.memberRowPlan}>{child.subscription.plan?.name ?? 'Unknown plan'}</Text>
                    {child.subscription.currentPeriodEnd && (
                      <Text style={s.memberRowRenewal}>
                        {child.subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {fmtDate(child.subscription.currentPeriodEnd)}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={s.memberRowPlan}>No active plan</Text>
                )}
              </View>
              {child.subscription && (
                <View style={[s.statusPill, child.subscription.status === 'ACTIVE' ? s.pillGreen : s.pillAmber]}>
                  <View style={[s.statusDot, { backgroundColor: child.subscription.status === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
                  <Text style={[s.statusText, { color: child.subscription.status === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>
                    {child.subscription.plan?.planType === 'PAYG' ? 'PAYG' : child.subscription.status}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Payment history */}
        <Text style={s.sectionLabel}>PAYMENT HISTORY</Text>
        {payments.length === 0 && <Text style={s.empty}>No payments yet</Text>}

        {Object.entries(grouped).map(([month, monthPayments]) => (
          <View key={month} style={s.card}>
            <Text style={s.monthLabel}>{month}</Text>
            {(monthPayments as any[]).map((p: any, i: number) => (
              <View key={p.id} style={[s.paymentRow, i > 0 && s.paymentRowBorder]}>
                <Text style={s.paymentIcon}>{descIcon(p.description)}</Text>
                <View style={s.paymentInfo}>
                  <Text style={s.paymentDesc}>{p.description ?? 'Payment'}</Text>
                  <Text style={s.paymentMeta}>
                    {fmtDateTime(p.createdAt)} · <Text style={p.isSelf ? s.paymentForSelf : s.paymentFor}>{p.memberName}</Text>
                  </Text>
                </View>
                <Text style={s.paymentAmount}>£{Number(p.amount).toFixed(2)}</Text>
              </View>
            ))}
            {/* Month total */}
            <View style={s.monthTotal}>
              <Text style={s.monthTotalLabel}>Month total</Text>
              <Text style={s.monthTotalAmount}>
                £{(monthPayments as any[]).reduce((sum: number, p: any) => sum + Number(p.amount), 0).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}

      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  portalCard: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', gap: 12 },
  portalLeft: { flex: 1, gap: 3 },
  portalTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  portalSub: { fontSize: 12, color: '#a1a1aa', lineHeight: 16 },
  portalBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  portalBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memberRowBorder: { borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 10 },
  memberRowLeft: { flex: 1, gap: 2 },
  memberRowName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  memberRowPlan: { fontSize: 13, color: '#a0a0a0' },
  memberRowRenewal: { fontSize: 11, color: '#a1a1aa' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
  pillAmber: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  monthLabel: { fontSize: 13, fontWeight: '700', color: '#a0a0a0' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentRowBorder: { borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 10 },
  paymentIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  paymentInfo: { flex: 1, gap: 2 },
  paymentDesc: { fontSize: 14, fontWeight: '600', color: '#fff' },
  paymentMeta: { fontSize: 11, color: '#a1a1aa' },
  paymentFor: { color: '#a78bfa', fontWeight: '600' },
  paymentForSelf: { color: '#a0a0a0', fontWeight: '600' },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: '#fff' },
  monthTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 10, marginTop: 2 },
  monthTotalLabel: { fontSize: 12, color: '#a1a1aa', fontWeight: '600' },
  monthTotalAmount: { fontSize: 14, fontWeight: '800', color: '#fff' },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 32, fontSize: 14 },
});
