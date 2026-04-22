import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Switch, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { apiPost } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { WithTabBar } from '@/components/WithTabBar';

export default function AddChild() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    authorisedCollectors: '', medicalNotes: '', image: '',
    guardianConsent: false, medicalTreatmentConsent: false, photoVideoConsent: false,
  });
  const [photo, setPhoto] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [dateOfBirthDisplay, setDateOfBirthDisplay] = useState('');

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0].base64) return;
    setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    set('image', `data:image/jpeg;base64,${result.assets[0].base64}`);
  }

  async function handleSubmit() {
    if (!form.firstName.trim()) { Alert.alert('Required', 'First name is required'); return; }
    if (!form.lastName.trim()) { Alert.alert('Required', 'Last name is required'); return; }
    if (!form.dateOfBirth.trim()) { Alert.alert('Required', 'Date of birth is required'); return; }
    if (!form.emergencyName.trim()) { Alert.alert('Required', 'Emergency contact name is required'); return; }
    if (!form.emergencyPhone.trim()) { Alert.alert('Required', 'Emergency contact phone is required'); return; }
    if (!form.emergencyRelation.trim()) { Alert.alert('Required', 'Emergency contact relation is required'); return; }
    if (!form.authorisedCollectors.trim()) { Alert.alert('Required', 'Authorised collectors is required'); return; }
    if (!form.guardianConsent) { Alert.alert('Required', 'Guardian consent is required'); return; }
    if (!form.medicalTreatmentConsent) { Alert.alert('Required', 'Medical treatment consent is required'); return; }

    setSaving(true);
    try {
      await apiPost('/family/children', form);
      Alert.alert('Child added!', `${form.firstName} has been added to your family.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong');
    } finally { setSaving(false); }
  }

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Add Child', headerBackTitle: 'Family' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        <View style={s.card}>
          <Text style={s.label}>BASIC INFORMATION</Text>
          <View style={s.formRow}>
            <View style={s.formCol}>
              <Text style={s.inputLabel}>First name *</Text>
              <TextInput style={s.input} value={form.firstName} onChangeText={v => set('firstName', v)} placeholderTextColor="#a1a1aa" placeholder="First name" />
            </View>
            <View style={s.formCol}>
              <Text style={s.inputLabel}>Last name *</Text>
              <TextInput style={s.input} value={form.lastName} onChangeText={v => set('lastName', v)} placeholderTextColor="#a1a1aa" placeholder="Last name" />
            </View>
          </View>
          <Text style={s.inputLabel}>Date of birth * (YYYY-MM-DD)</Text>
          <TextInput
            style={s.input}
            value={dateOfBirthDisplay}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '');
              let formatted = digits;
              if (digits.length >= 3) formatted = digits.slice(0,2) + '/' + digits.slice(2);
              if (digits.length >= 5) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,8);
              setDateOfBirthDisplay(formatted);
              if (digits.length === 8) {
                set('dateOfBirth', `${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}`);
              } else {
                set('dateOfBirth', '');
              }
            }}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#a1a1aa"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        <View style={s.card}>
          <Text style={s.label}>EMERGENCY CONTACT</Text>
          <Text style={s.inputLabel}>Name *</Text>
          <TextInput style={s.input} value={form.emergencyName} onChangeText={v => set('emergencyName', v)} placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Phone *</Text>
          <TextInput style={s.input} value={form.emergencyPhone} onChangeText={v => set('emergencyPhone', v)} keyboardType="phone-pad" placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Relation *</Text>
          <TextInput style={s.input} value={form.emergencyRelation} onChangeText={v => set('emergencyRelation', v)} placeholderTextColor="#a1a1aa" placeholder="e.g. Mother, Father" />
        </View>

        <View style={s.card}>
          <Text style={s.label}>MEDICAL & SAFEGUARDING</Text>
          <Text style={s.inputLabel}>Authorised collectors * (who can pick up this child)</Text>
          <TextInput style={[s.input, s.inputMulti]} value={form.authorisedCollectors} onChangeText={v => set('authorisedCollectors', v)} multiline numberOfLines={3} placeholderTextColor="#a1a1aa" placeholder="List names of people authorised to collect this child" />
          <Text style={s.inputLabel}>Medical notes (optional)</Text>
          <TextInput style={[s.input, s.inputMulti]} value={form.medicalNotes} onChangeText={v => set('medicalNotes', v)} multiline numberOfLines={3} placeholderTextColor="#a1a1aa" placeholder="Any medical conditions, allergies or injuries" />
        </View>

        <View style={s.card}>
          <Text style={s.label}>PROFILE PHOTO (OPTIONAL)</Text>
          <View style={s.photoRow}>
            {photo
              ? <Image source={{ uri: photo }} style={s.photoPreview} />
              : <View style={s.photoPlaceholder}><Text style={s.photoPlaceholderText}>No photo</Text></View>
            }
            <TouchableOpacity style={s.changeBtn} onPress={handlePickPhoto}>
              <Text style={s.changeBtnText}>{photo ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>CONSENTS</Text>

          <View style={s.consentRow}>
            <Switch value={form.guardianConsent} onValueChange={v => set('guardianConsent', v)} trackColor={{ true: '#22c55e', false: '#2a2a2a' }} />
            <Text style={s.consentText}>* I am the parent or legal guardian of this child and agree to the gym's terms on their behalf.</Text>
          </View>

          <View style={s.consentRow}>
            <Switch value={form.medicalTreatmentConsent} onValueChange={v => set('medicalTreatmentConsent', v)} trackColor={{ true: '#22c55e', false: '#2a2a2a' }} />
            <Text style={s.consentText}>* I consent to emergency medical treatment if I cannot be reached.</Text>
          </View>

          <View style={s.consentRow}>
            <Switch value={form.photoVideoConsent} onValueChange={v => set('photoVideoConsent', v)} trackColor={{ true: '#22c55e', false: '#2a2a2a' }} />
            <Text style={s.consentText}>I consent to photos and video being taken during classes for gym promotion. (optional)</Text>
          </View>
        </View>

        <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
          <Text style={s.primaryBtnText}>{saving ? 'Adding child...' : 'Add child'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelBtnText}>Cancel</Text>
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
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
  inputLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: '#242424', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  consentText: { flex: 1, color: '#a0a0a0', fontSize: 13, lineHeight: 18 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoPreview: { width: 64, height: 64, borderRadius: 32 },
  photoPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { color: '#a1a1aa', fontSize: 11 },
  changeBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  changeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  primaryBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelBtnText: { color: '#a1a1aa', fontSize: 14 },
});
