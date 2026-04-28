import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Platform, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useState } from 'react';
import { Colors } from '@/constants/colors';
import { format } from 'date-fns';

const MENU_ITEMS = [
  { key: 'overview', label: 'Overview', sub: 'QR code, wallet, upcoming', icon: '⊙', color: '#60a5fa', route: '/profile/overview' },
  { key: 'membership', label: 'Membership', sub: 'Manage your Gym plans', icon: '◈', color: '#a78bfa', route: '/profile/membership' },
  { key: 'billing', label: 'Billing', sub: 'Payments, invoices, manage card', icon: '◎', color: '#34d399', route: '/profile/billing' },
  { key: 'bookings', label: 'Bookings', sub: 'Upcoming & past classes', icon: '◷', color: '#34d399', route: '/profile/bookings' },
  { key: 'pt', label: 'PT Sessions', sub: 'Your 1-on-1 sessions', icon: '◎', color: '#f59e0b', route: '/profile/pt' },
  { key: 'daypasses', label: 'Day Passes', sub: 'Single day access', icon: '◇', color: '#f87171', route: '/profile/daypasses' },
  { key: 'family', label: 'Family', sub: 'Children & junior members', icon: '◉', color: '#fb923c', route: '/profile/family' },
  { key: 'terms', label: 'Terms & Waiver', sub: 'Signed agreements', icon: '◫', color: '#94a3b8', route: '/profile/terms' },
  { key: 'details', label: 'Personal Details', sub: 'Edit your information', icon: '◧', color: '#6b7280', route: '/profile/details' },
];

export default function ProfileMenu() {
  const { member, logout } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadMe() {
    try { const d = await apiFetch('/me'); setMe(d); } catch {}
  }

  useFocusEffect(useCallback(() => { loadMe(); }, []));

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'Are you sure?\n\nYour profile, photo, and personal details will be permanently deleted. Booking history and payment records are retained for 7 years as required by law.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error('Not signed in');
              const res = await fetch('https://app.crusader9.co.uk/api/member/delete-account', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                const body = await res.text();
                throw new Error(body || `Server error ${res.status}`);
              }
              await logout();
              router.replace('/(auth)/login');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete account. Please try again.');
            }
          },
        },
      ]
    );
  }

  async function onRefresh() { setRefreshing(true); await loadMe(); setRefreshing(false); }

  const sub = me?.subscription;
  const plan = sub?.plan;
  const subStatus = sub?.status;
  const memberSince = me?.createdAt ? format(new Date(me.createdAt), 'd MMM yyyy') : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <ScrollView style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>

      {/* Member header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/profile/overview')}>
          {me?.image
            ? <Image source={{ uri: me.image }} style={s.avatar} />
            : <View style={s.avatarPlaceholder}><Text style={s.avatarText}>{member?.firstName?.[0]}{member?.lastName?.[0]}</Text></View>
          }
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{member?.firstName} {member?.lastName}</Text>
          <Text style={s.headerMemberId}>{me?.memberId ?? member?.memberId}</Text>
          <View style={s.headerPlanRow}>
            {plan && <>
              <View style={[s.dot, { backgroundColor: subStatus === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
              <Text style={s.headerPlan}>{plan.name}</Text>
            </>}
            {memberSince && <Text style={s.headerSince}>· since {memberSince}</Text>}
          </View>
        </View>
      </View>

      {/* Menu list */}
      <View style={s.menuCard}>
        {MENU_ITEMS.map((item, idx) => (
          <TouchableOpacity key={item.key} style={[s.menuRow, idx < MENU_ITEMS.length - 1 && s.menuRowBorder]}
            onPress={() => router.push(item.route as any)} activeOpacity={0.7}>
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

      {/* Sign out */}
      <TouchableOpacity style={s.signOutBtn} onPress={() => {
        Alert.alert('Sign Out', 'Are you sure?', [
          { text: 'Cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          }},
        ]);
      }}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity style={s.deleteAccountBtn} onPress={handleDeleteAccount}>
        <Text style={s.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerInfo: { flex: 1, gap: 2 },
  headerName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerMemberId: { fontSize: 12, color: '#a1a1aa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  headerPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  headerPlan: { fontSize: 12, color: '#a0a0a0', fontWeight: '600' },
  headerSince: { fontSize: 11, color: '#a1a1aa' },
  menuCard: { backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  menuIcon: { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  menuIconText: { fontSize: 18 },
  menuInfo: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  menuSub: { fontSize: 12, color: '#a1a1aa' },
  chevron: { color: '#3f3f46', fontSize: 22, fontWeight: '300' },
  signOutBtn: { borderWidth: 1, borderColor: '#3f3f46', padding: 16, borderRadius: 12, alignItems: 'center' },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  deleteAccountBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteAccountText: { color: '#71717a', fontSize: 13, textDecorationLine: 'underline' },
});
