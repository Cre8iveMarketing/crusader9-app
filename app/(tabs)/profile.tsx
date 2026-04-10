import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Image } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiPut, apiPost } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { deleteToken } from '@/lib/auth';
import { useRouter } from 'expo-router';

type Tab = 'details' | 'bookings' | 'pt' | 'passes';

export default function Profile() {
  const { member, refresh, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('details');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: member?.firstName ?? '', lastName: member?.lastName ?? '', phone: member?.phone ?? '', address: member?.address ?? '', emergencyName: member?.emergencyName ?? '', emergencyPhone: member?.emergencyPhone ?? '' });

  async function saveDetails() {
    setSaving(true);
    try { await apiPut('/me', form); await refresh(); setEditing(false); Alert.alert('Saved', 'Your details have been updated.'); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function pickPhoto() {
    Alert.alert('Profile Photo', 'Choose how to update your photo', [
      { text: 'Take Photo', onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Camera access is needed'); return; }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled && result.assets[0].base64) {
          try { await apiPost('/me/photo', { photo: `data:image/jpeg;base64,${result.assets[0].base64}` }); await refresh(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        }
      }},
      { text: 'Choose from Library', onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Photo library access is needed'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled && result.assets[0].base64) {
          try { await apiPost('/me/photo', { photo: `data:image/jpeg;base64,${result.assets[0].base64}` }); await refresh(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const TABS: { key: Tab; label: string }[] = [{ key: 'details', label: 'Details' }, { key: 'bookings', label: 'Bookings' }, { key: 'pt', label: 'PT Sessions' }, { key: 'passes', label: 'Day Passes' }];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarRow}>
        <TouchableOpacity onPress={pickPhoto}>
          {member?.image
            ? <Image source={{ uri: member.image }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitials}>{member?.firstName?.[0]}{member?.lastName?.[0]}</Text></View>}
          <Text style={styles.changePhoto}>Change Photo</Text>
        </TouchableOpacity>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member?.firstName} {member?.lastName}</Text>
          <Text style={styles.memberId}>#{member?.memberId}</Text>
          <Text style={styles.memberPlan}>{member?.plan?.name ?? 'No active plan'}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'details' && (
        <View style={styles.section}>
          {editing ? (
            <>
              <View><Text style={styles.label}>First Name</Text><TextInput style={styles.input} value={form.firstName} onChangeText={v => setForm(f => ({ ...f, firstName: v }))} placeholderTextColor={Colors.textMuted} /></View>
              <View><Text style={styles.label}>Last Name</Text><TextInput style={styles.input} value={form.lastName} onChangeText={v => setForm(f => ({ ...f, lastName: v }))} placeholderTextColor={Colors.textMuted} /></View>
              <View><Text style={styles.label}>Phone</Text><TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholderTextColor={Colors.textMuted} /></View>
              <View><Text style={styles.label}>Address</Text><TextInput style={styles.input} value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} placeholderTextColor={Colors.textMuted} /></View>
              <View><Text style={styles.label}>Emergency Contact</Text><TextInput style={styles.input} value={form.emergencyName} onChangeText={v => setForm(f => ({ ...f, emergencyName: v }))} placeholderTextColor={Colors.textMuted} /></View>
              <View><Text style={styles.label}>Emergency Phone</Text><TextInput style={styles.input} value={form.emergencyPhone} onChangeText={v => setForm(f => ({ ...f, emergencyPhone: v }))} placeholderTextColor={Colors.textMuted} /></View>
              <TouchableOpacity style={styles.saveBtn} onPress={saveDetails} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {([['Email', member?.email], ['Phone', member?.phone], ['Address', member?.address], ['Emergency Contact', member?.emergencyName], ['Emergency Phone', member?.emergencyPhone]] as [string, string | undefined][]).map(([label, val]) => val ? (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{val}</Text>
                </View>
              ) : null)}
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>Edit Details</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {tab === 'bookings' && (
        <View style={styles.section}>
          {member?.bookings?.length === 0 && <Text style={styles.empty}>No bookings yet</Text>}
          {member?.bookings?.map(b => (
            <View key={b.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{b.Class?.ClassType?.name}</Text>
              <Text style={styles.itemSub}>
                {new Date(b.Class?.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: b.status === 'CONFIRMED' ? Colors.success + '22' : Colors.textMuted + '22' }]}>
                <Text style={[styles.statusText, { color: b.status === 'CONFIRMED' ? Colors.success : Colors.textMuted }]}>{b.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'pt' && (
        <View style={styles.section}>
          {member?.ptBookings?.length === 0 && <Text style={styles.empty}>No PT sessions yet</Text>}
          {member?.ptBookings?.map(b => (
            <View key={b.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{b.Instructor?.firstName} {b.Instructor?.lastName}</Text>
              <Text style={styles.itemSub}>
                {new Date(b.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: b.status === 'CONFIRMED' ? Colors.success + '22' : Colors.warning + '22' }]}>
                <Text style={[styles.statusText, { color: b.status === 'CONFIRMED' ? Colors.success : Colors.warning }]}>{b.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'passes' && (
        <View style={styles.section}>
          {member?.dayPasses?.length === 0 && <Text style={styles.empty}>No day passes yet</Text>}
          {member?.dayPasses?.map(p => (
            <View key={p.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>Day Pass</Text>
              <Text style={styles.itemSub}>{new Date(p.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              <View style={[styles.statusBadge, { backgroundColor: p.used ? Colors.textMuted + '22' : Colors.success + '22' }]}>
                <Text style={[styles.statusText, { color: p.used ? Colors.textMuted : Colors.success }]}>{p.used ? 'USED' : 'ACTIVE'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={() => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
          { text: 'Cancel' },
          { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/welcome'); } },
        ]);
      }}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  avatarRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.gold },
  avatarInitials: { color: Colors.gold, fontSize: 24, fontWeight: '800' },
  changePhoto: { color: Colors.gold, fontSize: 11, textAlign: 'center', marginTop: 4 },
  memberInfo: { flex: 1 },
  memberName: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  memberId: { color: Colors.gold, fontSize: 14, fontWeight: '600' },
  memberPlan: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  tabText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: Colors.black },
  section: { gap: 12 },
  label: { color: Colors.textMuted, fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15 },
  saveBtn: { backgroundColor: Colors.gold, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: Colors.black, fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelBtnText: { color: Colors.textMuted, fontSize: 14 },
  editBtn: { backgroundColor: Colors.card, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  editBtnText: { color: Colors.gold, fontWeight: '600' },
  detailRow: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  detailLabel: { color: Colors.textMuted, fontSize: 12 },
  detailValue: { color: Colors.text, fontSize: 15, fontWeight: '500', marginTop: 2 },
  itemCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  itemTitle: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  itemSub: { color: Colors.textMuted, fontSize: 13 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },
  logoutBtn: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.error + '44', marginTop: 8 },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
});
