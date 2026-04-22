import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ImageBackground, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PublicPlans() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://app.crusader9.co.uk/api/plans')
      .then(r => r.json())
      .then(d => setPlans((d.plans ?? []).filter((p: any) => p.planType !== 'DAY_PASS')))
      .finally(() => setLoading(false));
  }, []);

  const monthlyPlans = plans.filter(p => p.planType === 'MONTHLY');
  const paygPlan = plans.find(p => p.planType === 'PAYG');
  const mostPopular = monthlyPlans.find(p => p.name.toLowerCase().includes('coach') || p.name.toLowerCase().includes('class')) ?? monthlyPlans[0];

  return (
    <ImageBackground source={require('../../assets/login-bg.jpg')} style={s.bg} resizeMode="cover">
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.content}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Text style={s.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Membership Plans</Text>
            <Text style={s.sub}>Choose the plan that works for you</Text>
          </View>

          {loading && <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />}

          {/* Plan cards */}
          {[...monthlyPlans, paygPlan].filter(Boolean).map(p => (
            <View key={p.id} style={[s.planCard, p.id === mostPopular?.id && s.planCardPopular]}>
              {p.id === mostPopular?.id && (
                <View style={s.popularBadge}>
                  <Text style={s.popularBadgeText}>Most popular</Text>
                </View>
              )}
              <View style={s.planTop}>
                <View style={s.planTitleBlock}>
                  <Text style={s.planName}>{p.name}</Text>
                  {p.planType === 'PAYG' && (
                    <View style={s.paygBadge}><Text style={s.paygBadgeText}>PAYG</Text></View>
                  )}
                </View>
                <Text style={s.planPrice}>
                  {p.price === 0 ? 'Free' : `£${p.price}`}
                  {p.price > 0 && <Text style={s.planPer}>/mo</Text>}
                </Text>
              </View>

              {p.description && <Text style={s.planDesc}>{p.description}</Text>}

              <TouchableOpacity
                style={[s.planBtn, p.planType === 'PAYG' && s.planBtnPayg]}
                onPress={() => router.push({ pathname: '/(auth)/register', params: { path: 'member', planId: p.id } })}
                activeOpacity={0.85}>
                <Text style={[s.planBtnText, p.planType === 'PAYG' && s.planBtnTextPayg]}>
                  {p.planType === 'PAYG' ? 'Join free' : 'Get started'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Sign in link */}
          <TouchableOpacity style={s.signInRow} onPress={() => router.back()}>
            <Text style={s.signInText}>Already a member? <Text style={s.signInLink}>Sign in →</Text></Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' },
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { gap: 6, marginBottom: 8 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backBtnText: { color: '#a0a0a0', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub: { fontSize: 14, color: '#a1a1aa' },
  planCard: { backgroundColor: 'rgba(18,18,18,0.88)', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10, position: 'relative', marginTop: 8 },
  planCardPopular: { borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1.5 },
  popularBadge: { position: 'absolute', top: -14, alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, zIndex: 1 },
  popularBadgeText: { color: '#0a0a0a', fontSize: 11, fontWeight: '700' },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planTitleBlock: { flex: 1, gap: 4 },
  planName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  paygBadge: { alignSelf: 'flex-start', backgroundColor: '#2a2a2a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  paygBadgeText: { color: '#a1a1aa', fontSize: 10, fontWeight: '600' },
  planPrice: { fontSize: 28, fontWeight: '800', color: '#fff' },
  planPer: { fontSize: 14, fontWeight: '400', color: '#a1a1aa' },
  planDesc: { fontSize: 13, color: '#a1a1aa', lineHeight: 18 },
  planBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center' },
  planBtnPayg: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3f3f46' },
  planBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
  planBtnTextPayg: { color: '#fff' },
  signInRow: { alignItems: 'center', paddingVertical: 8 },
  signInText: { color: '#a1a1aa', fontSize: 14 },
  signInLink: { color: '#fff', fontWeight: '600' },
});
