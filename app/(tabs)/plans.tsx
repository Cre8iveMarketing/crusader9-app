import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { apiFetch, apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';

export default function Plans() {
  const { member, refresh } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { apiFetch('/plans').then(setPlans).finally(() => setLoading(false)); }, []);

  async function selectPlan(plan: any) {
    Alert.alert(`Join ${plan.name}`, `£${plan.price}/${plan.planType === 'MONTHLY' ? 'month' : 'day'} — you'll be redirected to complete payment.`, [
      { text: 'Cancel' },
      { text: 'Continue', onPress: async () => {
        try {
          const res = await apiPost('/stripe/checkout', { type: plan.planType === 'DAY_PASS' ? 'day_pass' : 'subscription', planId: plan.id });
          await Linking.openURL(res.url);
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.white} /></View>;

  const currentPlanId = member?.plan?.id;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {member?.plan && (
        <View style={s.currentCard}>
          <Text style={s.currentLabel}>Your Current Plan</Text>
          <Text style={s.currentName}>{member.plan.name}</Text>
          <Text style={s.currentStatus}>Status: {member.subscription?.status}</Text>
        </View>
      )}
      <Text style={s.sectionTitle}>All Plans</Text>
      {plans.map(plan => (
        <TouchableOpacity key={plan.id} style={[s.card, plan.id === currentPlanId && s.activePlan]} onPress={() => selectPlan(plan)}>
          <View style={s.cardHeader}>
            <Text style={s.planName}>{plan.name}</Text>
            <Text style={s.planPrice}>£{plan.price}<Text style={s.per}>/{plan.planType === 'MONTHLY' ? 'mo' : 'day'}</Text></Text>
          </View>
          {plan.description && <Text style={s.desc}>{plan.description}</Text>}
          {plan.id === currentPlanId
            ? <Text style={s.currentTag}>✓ Current Plan</Text>
            : <View style={s.selectBtn}><Text style={s.selectBtnText}>{member?.plan ? 'Switch to this plan' : 'Choose this plan'} →</Text></View>}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  currentCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  currentLabel: { color: Colors.textSub, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  currentName: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  currentStatus: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  activePlan: { borderColor: Colors.white },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  planPrice: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  per: { fontSize: 13, fontWeight: '400', color: Colors.textMuted },
  desc: { color: Colors.textMuted, fontSize: 13 },
  currentTag: { color: Colors.white, fontWeight: '700' },
  selectBtn: { backgroundColor: Colors.white, padding: 12, borderRadius: 8, alignItems: 'center' },
  selectBtnText: { color: Colors.bg, fontWeight: '700' },
});
