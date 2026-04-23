import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, RefreshControl, Modal, Platform, Alert, Linking } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { WithTabBar } from '@/components/WithTabBar';
import { getToken } from '@/lib/auth';

function getAge(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000*60*60*24*365.25));
}

export default function ProfileFamily() {
  const router = useRouter();
  const [family, setFamily] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [qrModal, setQrModal] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState<string | null>(null);

  async function load() { try { const d = await apiFetch('/family'); setFamily(d.children ?? []); } catch {} }
  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleGoogleWallet(childId?: string) {
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const url = `https://app.crusader9.co.uk/api/mobile/google-wallet-pass${childId ? `?childId=${childId}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      await Linking.openURL(data.saveUrl);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleChildWallet(child: any) {
    setWalletLoading(child.id);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const url = `https://app.crusader9.co.uk/api/member/wallet?token=${token}&childId=${child.id}`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', 'Could not open Apple Wallet. Please try again.');
    } finally { setWalletLoading(null); }
  }

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Family' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="#fff" />}>
        {family.length === 0 && <Text style={s.empty}>No children added yet</Text>}
        {family.map((child: any) => {
          const sub = child.subscription;
          const plan = sub?.plan ?? child.plan;
          const subStatus = sub?.status;

          return (
            <View key={child.id} style={s.memberCard}>

              {/* Top row — avatar + name/id/plan pill + QR */}
              <View style={s.memberCardTop}>
                {child.image
                  ? <Image source={{ uri: child.image }} style={s.memberAvatar} />
                  : <View style={[s.memberAvatar, s.memberAvatarPlaceholder]}>
                      <Text style={s.memberAvatarText}>{child.firstName?.[0]}{child.lastName?.[0]}</Text>
                    </View>
                }
                <View style={s.memberNameBlock}>
                  <Text style={s.memberName} numberOfLines={1}>{child.firstName} {child.lastName}</Text>
                  <Text style={s.memberIdText}>{child.memberId}</Text>
                  <View style={s.memberPlanRow}>
                    {plan ? (
                      <View style={[s.planPill, {
                        borderColor: subStatus === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)',
                        backgroundColor: subStatus === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                      }]}>
                        <View style={[s.statusDot, { backgroundColor: subStatus === 'ACTIVE' ? '#22c55e' : '#f59e0b' }]} />
                        <Text style={[s.planPillText, { color: subStatus === 'ACTIVE' ? '#4ade80' : '#fbbf24' }]}>{plan.name}</Text>
                      </View>
                    ) : (
                      <View style={[s.planPill, { borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' }]}>
                        <View style={[s.statusDot, { backgroundColor: '#3f3f46' }]} />
                        <Text style={[s.planPillText, { color: '#a1a1aa' }]}>No plan</Text>
                      </View>
                    )}
                  </View>
                </View>
                {child.qrCode && (
                  <TouchableOpacity onPress={() => setQrModal(child)} style={s.qrThumb} activeOpacity={0.8}>
                    <Image source={{ uri: child.qrCode }} style={s.qrThumbImage} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Divider */}
              <View style={s.memberCardDivider} />

              {/* Bottom row — hint + Apple Wallet (exact dashboard copy) */}
              <View style={s.memberCardBottom}>
                <Text style={s.qrHint}>Tap QR to enlarge · Show at front desk</Text>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => handleChildWallet(child)} disabled={walletLoading === child.id} activeOpacity={0.8}>
                    <Image source={require('../../assets/add-to-apple-wallet.png')} style={s.walletBadge} resizeMode="contain" />
                  </TouchableOpacity>
                )}
                {Platform.OS === 'android' && (
                  <TouchableOpacity onPress={() => handleGoogleWallet(child.id)} activeOpacity={0.8}>
                    <Image source={require('../../assets/google-wallet-badge.png')} style={s.walletBadge} resizeMode="contain" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Second divider */}
              <View style={s.memberCardDivider} />

              {/* Manage row */}
              <TouchableOpacity
                style={s.manageRow}
                onPress={() => router.push({ pathname: '/child/[id]', params: { id: child.id } })}
                activeOpacity={0.7}>
                <Text style={s.manageRowText}>Manage {child.firstName}'s account</Text>
                <Text style={s.manageRowChevron}>›</Text>
              </TouchableOpacity>

            </View>
          );
        })}
        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/add-child')}>
          <Text style={s.addBtnText}>+ Add child</Text>
        </TouchableOpacity>

        {/* QR enlarge modal */}
        {qrModal && (
          <Modal visible={!!qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(null)}>
            <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setQrModal(null)}>
              <View style={s.modalBox}>
                <Image source={{ uri: qrModal.qrCode }} style={s.qrModalImage} />
                <Text style={s.qrModalName}>{qrModal.firstName} {qrModal.lastName}</Text>
                <Text style={s.qrModalId}>{qrModal.memberId}</Text>
                <TouchableOpacity style={s.modalClose} onPress={() => setQrModal(null)}>
                  <Text style={s.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 48, fontSize: 14 },
  addBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },

  memberCard: { backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#1e1e1e', overflow: 'hidden' },
  memberCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 14 },
  memberAvatar: { width: 52, height: 52, borderRadius: 26 },
  memberAvatarPlaceholder: { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  memberNameBlock: { flex: 1, gap: 3 },
  memberName: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  memberIdText: { fontSize: 11, color: '#71717a', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  memberPlanRow: { flexDirection: 'row', marginTop: 2 },
  planPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  planPillText: { fontSize: 11, fontWeight: '700' },
  qrThumb: { backgroundColor: '#ffffff', borderRadius: 10, padding: 4, width: 64, height: 64, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  qrThumbImage: { width: 56, height: 56, borderRadius: 4 },
  memberCardDivider: { height: 1, backgroundColor: '#1e1e1e' },
  memberCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  qrHint: { fontSize: 11, color: '#3f3f46', flex: 1 },
  walletBadge: { width: 130, height: 42 },
  manageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  manageRowText: { fontSize: 13, fontWeight: '600', color: '#a0a0a0' },
  manageRowChevron: { color: '#3f3f46', fontSize: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1a1a1a', borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, marginHorizontal: 24 },
  qrModalImage: { width: 260, height: 260, borderRadius: 12, backgroundColor: '#fff' },
  qrModalName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  qrModalId: { fontSize: 11, color: '#a1a1aa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  modalClose: { backgroundColor: '#2a2a2a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  modalCloseText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
