import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Platform, Modal, Alert, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/colors';
import { format } from 'date-fns';
import { WithTabBar } from '@/components/WithTabBar';

export default function ProfileOverview() {
  const { member } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [qrModal, setQrModal] = useState(false);
  const [downloadingWallet, setDownloadingWallet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadMe() { try { setMe(await apiFetch('/me')); } catch {} }
  useEffect(() => { loadMe(); }, []);

  async function handleAppleWallet() {
    setDownloadingWallet(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not logged in');
      const localUri = FileSystem.cacheDirectory + 'crusader9.pkpass';
      await FileSystem.downloadAsync(
        'https://app.crusader9.co.uk/api/member/wallet',
        localUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await Sharing.shareAsync(localUri, {
        mimeType: 'application/vnd.apple.pkpass',
        UTI: 'com.apple.pkpass',
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setDownloadingWallet(false); }
  }

  const sub = me?.subscription;
  const plan = sub?.plan;
  const subStatus = sub?.status;

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Overview' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadMe(); setRefreshing(false); }} tintColor="#fff" />}>

        {/* Membership card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>MEMBERSHIP</Text>
          <View style={s.membershipRow}>
            <View>
              <Text style={s.membershipName}>{plan?.name ?? 'No plan'}</Text>
              <Text style={s.membershipPrice}>£{(plan?.price ?? 0).toFixed(2)}/mo</Text>
            </View>
            {subStatus && <View style={[s.badge, subStatus === 'ACTIVE' ? s.badgeGreen : s.badgeAmber]}>
              <Text style={s.badgeText}>{subStatus}</Text>
            </View>}
          </View>
          <TouchableOpacity style={s.membershipBtn} onPress={() => router.push('/profile/membership')}>
            <Text style={s.membershipBtnText}>Change Plan</Text>
          </TouchableOpacity>
        </View>

        {/* QR card */}
        <View style={s.card}>
          <TouchableOpacity onPress={() => setQrModal(true)} style={s.qrSection}>
            {me?.qrCode && <Image source={{ uri: me.qrCode }} style={s.qrImage} />}
          </TouchableOpacity>
          <Text style={s.qrName}>{me?.firstName} {me?.lastName}</Text>
          <Text style={s.qrId}>{me?.memberId}</Text>
          {Platform.OS === 'ios' && (
            <TouchableOpacity onPress={handleAppleWallet} disabled={downloadingWallet} style={{ marginTop: 8 }}>
              <Image source={require('../../assets/add-to-apple-wallet.png')} style={s.walletBadge} resizeMode="contain" />
            </TouchableOpacity>
          )}
          <Text style={s.qrHint}>Show at front desk to check in</Text>
        </View>

        {/* Personal details summary */}
        <View style={s.card}>
          <Text style={s.cardLabel}>PERSONAL DETAILS</Text>
          <View style={s.detailRow}><Text style={s.detailLabel}>Email</Text><Text style={s.detailValue} numberOfLines={1}>{me?.email}</Text></View>
          <View style={s.detailRow}><Text style={s.detailLabel}>Phone</Text><Text style={s.detailValue}>{me?.phone ?? '—'}</Text></View>
          {me?.emergencyName && <View style={s.detailRow}><Text style={s.detailLabel}>Emergency</Text><Text style={s.detailValue} numberOfLines={1}>{me.emergencyName}</Text></View>}
          <TouchableOpacity style={s.editLink} onPress={() => router.push('/profile/details')}>
            <Text style={s.editLinkText}>Edit details →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setQrModal(false)}>
          <View style={s.modalBox}>
            {me?.qrCode && <Image source={{ uri: me.qrCode }} style={s.qrModalImage} />}
            <Text style={s.qrName}>{me?.firstName} {me?.lastName}</Text>
            <Text style={s.qrId}>{me?.memberId}</Text>
            <TouchableOpacity style={s.modalClose} onPress={() => setQrModal(false)}>
              <Text style={s.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  membershipName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  membershipPrice: { fontSize: 13, color: '#a0a0a0' },
  membershipBtn: { backgroundColor: '#2a2a2a', padding: 12, borderRadius: 10, alignItems: 'center' },
  membershipBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  badgeAmber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  qrSection: { alignItems: 'center' },
  qrImage: { width: 130, height: 130, borderRadius: 8, backgroundColor: '#fff' },
  qrName: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },
  qrId: { fontSize: 11, color: '#a1a1aa', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  qrHint: { fontSize: 11, color: '#71717a', textAlign: 'center' },
  walletBadge: { width: 150, height: 48, alignSelf: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel: { color: '#a1a1aa', fontSize: 13 },
  detailValue: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  editLink: { alignSelf: 'flex-end', paddingVertical: 4 },
  editLinkText: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#1a1a1a', borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, marginHorizontal: 24 },
  qrModalImage: { width: 260, height: 260, borderRadius: 12, backgroundColor: '#fff' },
  modalClose: { backgroundColor: '#2a2a2a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  modalCloseText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
