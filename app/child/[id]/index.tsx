import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Platform, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { WithTabBar } from '@/components/WithTabBar';
import { SvgXml } from 'react-native-svg';
import { getToken } from '@/lib/auth';

const BACK_ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;

function HeaderBackButton({ label = 'Back' }: { label?: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        paddingLeft: 12,
        paddingRight: 15,
        paddingVertical: 8,
        gap: 6,
      }}>
        <SvgXml xml={BACK_ARROW} width={16} height={16} />
        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '500', includeFontPadding: false }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const MENU_ITEMS = [
  { key: 'details', label: 'Details', sub: 'Name, DOB, emergency contact', icon: '✎', color: '#60a5fa', route: 'details' },
  { key: 'bookings', label: 'Bookings', sub: 'Upcoming & past classes', icon: '◷', color: '#34d399', route: 'bookings' },
  { key: 'pt', label: 'PT Sessions', sub: '1-on-1 sessions', icon: '◎', color: '#f59e0b', route: 'pt' },
  { key: 'daypasses', label: 'Day Passes', sub: 'Single day access', icon: '◇', color: '#f87171', route: 'daypasses' },
  { key: 'subscription', label: 'Membership', sub: 'Review & change plan', icon: '◈', color: '#a78bfa', route: 'subscription' },
];

export default function ChildDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/family/children/${id}`).then(setChild).finally(() => setLoading(false));
  }, [id]);

  async function handleWallet() {
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const url = `https://app.crusader9.co.uk/api/member/wallet?token=${token}&childId=${id}&returnUrl=crusader9://`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', 'Could not open Apple Wallet. Please try again.');
    }
  }

  async function handleGoogleWallet() {
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const res = await fetch(`https://app.crusader9.co.uk/api/mobile/google-wallet-pass?childId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      await Linking.openURL(data.saveUrl);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  if (loading) return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Loading...' }} />
      <View style={s.center}><ActivityIndicator color="#fff" size="large" /></View>
    </WithTabBar>
  );

  if (!child) return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={s.center}><Text style={s.errorText}>Child not found</Text></View>
    </WithTabBar>
  );

  const sub = child.subscription;
  const plan = sub?.plan ?? child.plan;
  const age = child.dateOfBirth
    ? Math.floor((Date.now() - new Date(child.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: child.firstName + ' ' + child.lastName, headerLeft: () => <HeaderBackButton label="Family" /> }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Child header */}
        <View style={s.header}>
          {child.image
            ? <Image source={{ uri: child.image }} style={s.avatar} />
            : <View style={s.avatarPlaceholder}>
                <Text style={s.avatarText}>{child.firstName[0]}{child.lastName[0]}</Text>
              </View>
          }
          <View style={s.headerInfo}>
            <Text style={s.childName}>{child.firstName} {child.lastName}</Text>
            <Text style={s.childMemberId}>{child.memberId}</Text>
            <View style={s.metaRow}>
              {sub && (
                <View style={[s.pill, sub.status === 'ACTIVE' ? s.pillGreen : s.pillAmber]}>
                  <View style={[s.pillDot, { backgroundColor: sub.status === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
                  <Text style={[s.pillText, { color: sub.status === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>
                    {sub.status} · {plan?.name ?? 'No plan'}
                  </Text>
                </View>
              )}
              {age !== null && <Text style={s.ageMeta}>age {age} · Junior member</Text>}
            </View>
          </View>
        </View>

        {/* Settings list menu */}
        <View style={s.menuCard}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={handleWallet} activeOpacity={0.7}>
              <Text style={s.menuRowText}>Add to Apple Wallet</Text>
              <Text style={s.menuRowChevron}>›</Text>
            </TouchableOpacity>
          )}
          {Platform.OS === 'android' && (
            <TouchableOpacity style={[s.menuRow, s.menuRowBorder]} onPress={handleGoogleWallet} activeOpacity={0.7}>
              <Text style={s.menuRowText}>Add to Google Wallet</Text>
              <Text style={s.menuRowChevron}>›</Text>
            </TouchableOpacity>
          )}
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[s.menuRow, idx < MENU_ITEMS.length - 1 && s.menuRowBorder]}
              onPress={() => router.push({ pathname: `/child/${id}/${item.route}` as any, params: { id } })}
              activeOpacity={0.7}>
              <View style={[s.menuIcon, { backgroundColor: item.color + '22' }]}>
                <Text style={[s.menuIconText, { color: item.color }]}>{item.icon}</Text>
              </View>
              <View style={s.menuInfo}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 16 },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerInfo: { flex: 1, gap: 4 },
  childName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  childMemberId: { fontSize: 11, color: '#71717a', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
  pillAmber: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  ageMeta: { fontSize: 12, color: '#a1a1aa' },
  menuCard: { backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  menuIcon: { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  menuIconText: { fontSize: 18 },
  menuInfo: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  menuSub: { fontSize: 12, color: '#a1a1aa' },
  chevron: { color: '#3f3f46', fontSize: 22 },
  menuRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#ffffff' },
  menuRowChevron: { color: '#3f3f46', fontSize: 22 },
});
