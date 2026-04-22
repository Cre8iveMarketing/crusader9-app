import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

export default function Welcome() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    fetch('https://app.crusader9.co.uk/api/plans')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.plans ?? []);
        setPlans(list.filter((p: any) => p.planType !== 'DAY_PASS'));
      })
      .catch(() => {});
  }, []);

  const monthlyPlans = plans.filter(p => p.planType === 'MONTHLY');
  const paygPlan = plans.find(p => p.planType === 'PAYG');
  const mostPopular = monthlyPlans.find(p => p.name.toLowerCase().includes('coach') || p.name.toLowerCase().includes('class')) ?? monthlyPlans[0];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Logo */}
        <View style={s.logoRow}>
          <Image source={require('../../assets/c9-logo.png')} style={s.logoImage} resizeMode="contain" />
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>Train harder.{'\n'}Join today.</Text>
          <Text style={s.heroSub}>Open gym, coach-led classes, and personal training at Crusader 9 Boxing.</Text>
        </View>

        {/* CTAs */}
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.push({ pathname: '/(auth)/register', params: { path: 'member' } })}>
          <Text style={s.primaryBtnText}>Become a member</Text>
        </TouchableOpacity>
        <View style={s.secondaryRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push({ pathname: '/(auth)/register', params: { path: 'class' } })}>
            <Text style={s.secondaryBtnText}>Book a class</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push({ pathname: '/(auth)/register', params: { path: 'daypass' } })}>
            <Text style={s.secondaryBtnText}>Day pass — £7.50</Text>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {plans.length > 0 && (
          <View style={s.plansSection}>
            <Text style={s.plansLabel}>MEMBERSHIP PLANS</Text>
            {[...monthlyPlans, paygPlan].filter(Boolean).map((p: any) => (
              <TouchableOpacity key={p.id}
                style={[s.planCard, p.id === mostPopular?.id && s.planCardPopular]}
                onPress={() => router.push({ pathname: '/(auth)/register', params: { path: 'member', planId: p.id } })}
                activeOpacity={0.8}>
                {p.id === mostPopular?.id && (
                  <View style={s.popularBadge}><Text style={s.popularBadgeText}>Most popular</Text></View>
                )}
                <View style={s.planCardRow}>
                  <Text style={s.planCardName}>{p.name}</Text>
                  <Text style={s.planCardPrice}>
                    {p.price === 0 ? 'Free' : `£${p.price}`}
                    {p.price > 0 && <Text style={s.planCardPer}>/mo</Text>}
                  </Text>
                </View>
                {p.description && <Text style={s.planCardDesc} numberOfLines={2}>{p.description}</Text>}
                <View style={[s.planCardBtn, p.planType === 'PAYG' && s.planCardBtnPayg]}>
                  <Text style={[s.planCardBtnText, p.planType === 'PAYG' && s.planCardBtnTextPayg]}>
                    {p.planType === 'PAYG' ? 'Join free' : 'Get started'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sign in link */}
        <TouchableOpacity style={s.signInRow} onPress={() => router.push('/(auth)/login')}>
          <Text style={s.signInText}>Already a member? <Text style={s.signInLink}>Sign in →</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 48 },
  logoRow: { alignItems: 'center', marginBottom: 32 },
  logoImage: { width: 80, height: 80 },
  hero: { marginBottom: 28, gap: 10 },
  heroTitle: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1, lineHeight: 44 },
  heroSub: { fontSize: 15, color: '#a1a1aa', lineHeight: 22 },
  primaryBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  secondaryBtn: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', padding: 14, borderRadius: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  plansSection: { gap: 12, marginBottom: 32 },
  plansLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  planCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2a2a2a', gap: 8 },
  planCardPopular: { borderColor: '#fff', borderWidth: 1.5 },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, zIndex: 1 },
  popularBadgeText: { color: '#0a0a0a', fontSize: 11, fontWeight: '700' },
  planCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  planCardName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  planCardPrice: { fontSize: 26, fontWeight: '800', color: '#fff' },
  planCardPer: { fontSize: 14, fontWeight: '400', color: '#a1a1aa' },
  planCardDesc: { fontSize: 12, color: '#a1a1aa', lineHeight: 17 },
  planCardBtn: { backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  planCardBtnPayg: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#3f3f46' },
  planCardBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 14 },
  planCardBtnTextPayg: { color: '#fff' },
  signInRow: { alignItems: 'center', paddingVertical: 8 },
  signInText: { color: '#a1a1aa', fontSize: 14 },
  signInLink: { color: '#fff', fontWeight: '600' },
});
