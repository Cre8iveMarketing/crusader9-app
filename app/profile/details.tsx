import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Image, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiPost } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { WithTabBar } from '@/components/WithTabBar';

export default function ProfileDetails() {
  const { refresh: refreshAuth } = useAuth();
  const [me, setMe] = useState<any>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/me').then(d => {
      setMe(d);
      setFirstName(d.firstName ?? '');
      setLastName(d.lastName ?? '');
      setPhone(d.phone ?? '');
      setAddress(d.address ?? '');
      setEmergencyName(d.emergencyName ?? '');
      setEmergencyPhone(d.emergencyPhone ?? '');
      setEmergencyRelation(d.emergencyRelation ?? '');
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await apiPost('/me', { firstName, lastName, phone, address, emergencyName, emergencyPhone, emergencyRelation });
      await refreshAuth();
      Alert.alert('Saved', 'Your details have been updated.');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleChangePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0].base64) return;
    try {
      await apiPost('/me/photo', { image: `data:image/jpeg;base64,${result.assets[0].base64}` });
      await refreshAuth();
      Alert.alert('Updated', 'Profile photo updated.');
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Personal Details' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.label}>PROFILE PHOTO</Text>
          <View style={s.photoRow}>
            {me?.image
              ? <Image source={{ uri: me.image }} style={s.photo} />
              : <View style={s.photoPlaceholder}><Text style={s.photoText}>{me?.firstName?.[0]}{me?.lastName?.[0]}</Text></View>
            }
            <TouchableOpacity style={s.changeBtn} onPress={handleChangePhoto}>
              <Text style={s.changeBtnText}>Change photo</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.label}>PERSONAL INFORMATION</Text>
          <View style={s.formRow}>
            <View style={s.formCol}>
              <Text style={s.inputLabel}>First name</Text>
              <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholderTextColor="#a1a1aa" />
            </View>
            <View style={s.formCol}>
              <Text style={s.inputLabel}>Last name</Text>
              <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholderTextColor="#a1a1aa" />
            </View>
          </View>
          <Text style={s.inputLabel}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Address</Text>
          <TextInput style={s.input} value={address} onChangeText={setAddress} placeholderTextColor="#a1a1aa" />
        </View>
        <View style={s.card}>
          <Text style={s.label}>EMERGENCY CONTACT</Text>
          <Text style={s.inputLabel}>Name</Text>
          <TextInput style={s.input} value={emergencyName} onChangeText={setEmergencyName} placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Phone</Text>
          <TextInput style={s.input} value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Relation</Text>
          <TextInput style={s.input} value={emergencyRelation} onChangeText={setEmergencyRelation} placeholderTextColor="#a1a1aa" />
        </View>
        <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={s.primaryBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', gap: 8 },
  label: { fontSize: 10, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 64, height: 64, borderRadius: 32 },
  photoPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  photoText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  changeBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  changeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
  inputLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: '#242424', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  primaryBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
});
