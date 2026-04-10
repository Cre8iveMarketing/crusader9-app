import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { Colors } from '@/constants/colors';

export default function Plans() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/plans').then(setPlans).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.white} /></View>;

  const monthly = plans.filter(p => p.planType === 'MONTHLY');
  const dayPass = plans.find(p => p.planType === 'DAY_PASS');

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
        <Text style={s.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>Choose Your Plan</Text>
      <Text style={s.subtitle}>Join Crusader 9 Boxing today</Text>

      {monthly.map(plan => (
        <TouchableOpacity key={plan.id} style={s.card}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { planId: plan.id } })}>
          <View style={s.cardHeader}>
            <Text style={s.planName}>{plan.name}</Text>
            <View style={s.priceBox}>
              <Text style={s.price}>£{plan.price}</Text>
              <Text style={s.per}>/mo</Text>
            </View>
          </View>
          {plan.description && <Text style={s.desc}>{plan.description}</Text>}
          <View style={s.joinBtn}><Text style={s.joinBtnText}>Join with this plan →</Text></View>
        </TouchableOpacity>
      ))}

      {dayPass && (
        <TouchableOpacity style={[s.card, s.cardAlt]}
          onPress={() => router.push({ pathname: '/(auth)/register', params: { planId: dayPass.id } })}>
          <View style={s.cardHeader}>
            <Text style={s.planName}>Day Pass</Text>
            <View style={s.priceBox}>
              <Text style={s.price}>£{dayPass.price}</Text>
              <Text style={s.per}>/day</Text>
            </View>
          </View>
          {dayPass.description && <Text style={s.desc}>{dayPass.description}</Text>}
          <View style={[s.joinBtn, s.joinBtnAlt]}><Text style={s.joinBtnTextAlt}>Register with day pass →</Text></View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, gap: 14, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  backRow: { marginBottom: 8 },
  backText: { color: Colors.textMuted, fontSize: 14 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardAlt: { borderColor: Colors.borderHigh },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { color: Colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  priceBox: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { color: Colors.white, fontSize: 24, fontWeight: '800' },
  per: { color: Colors.textMuted, fontSize: 13 },
  desc: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  joinBtn: { backgroundColor: Colors.white, padding: 12, borderRadius: 8, alignItems: 'center' },
  joinBtnAlt: { backgroundColor: Colors.surfaceHigh },
  joinBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 14 },
  joinBtnTextAlt: { color: Colors.text, fontWeight: '600', fontSize: 14 },
});
