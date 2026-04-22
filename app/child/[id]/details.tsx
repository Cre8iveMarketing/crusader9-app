import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Image } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { apiFetch, apiPatch } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { WithTabBar } from '@/components/WithTabBar';

export default function ChildDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [child, setChild] = useState<any>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [authorisedCollectors, setAuthorisedCollectors] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateOfBirthDisplay, setDateOfBirthDisplay] = useState('');

  useEffect(() => {
    apiFetch(`/family/children/${id}`).then(c => {
      setChild(c);
      setFirstName(c.firstName ?? '');
      setLastName(c.lastName ?? '');
      const isoDob = c.dateOfBirth ? c.dateOfBirth.split('T')[0] : '';
      setDateOfBirth(isoDob);
      if (isoDob && /^\d{4}-\d{2}-\d{2}$/.test(isoDob)) {
        const [y, m, d] = isoDob.split('-');
        setDateOfBirthDisplay(`${d}/${m}/${y}`);
      } else {
        setDateOfBirthDisplay('');
      }
      setEmergencyName(c.emergencyName ?? '');
      setEmergencyPhone(c.emergencyPhone ?? '');
      setEmergencyRelation(c.emergencyRelation ?? '');
      setAuthorisedCollectors(c.authorisedCollectors ?? '');
      setMedicalNotes(c.medicalNotes ?? '');
      setImage(c.image ?? '');
    }).catch(() => {});
  }, [id]);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0].base64) return;
    setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiPatch(`/family/children/${id}`, { firstName, lastName, dateOfBirth, emergencyName, emergencyPhone, emergencyRelation, authorisedCollectors, medicalNotes, image: image || null });
      Alert.alert('Saved', 'Changes saved successfully.');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Details' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.label}>PROFILE PHOTO</Text>
          <View style={s.photoRow}>
            {image
              ? <Image source={{ uri: image }} style={s.photo} />
              : <View style={s.photoPlaceholder}><Text style={s.photoInitials}>{child?.firstName?.[0]}{child?.lastName?.[0]}</Text></View>
            }
            <TouchableOpacity style={s.changeBtn} onPress={handlePickPhoto}>
              <Text style={s.changeBtnText}>{image ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.label}>PERSONAL INFORMATION</Text>
          <View style={s.row}>
            <View style={s.col}><Text style={s.inputLabel}>First name</Text><TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholderTextColor="#a1a1aa" /></View>
            <View style={s.col}><Text style={s.inputLabel}>Last name</Text><TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholderTextColor="#a1a1aa" /></View>
          </View>
          <Text style={s.inputLabel}>Date of birth</Text>
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
                setDateOfBirth(`${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}`);
              } else {
                setDateOfBirth('');
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
          <Text style={s.inputLabel}>Name</Text><TextInput style={s.input} value={emergencyName} onChangeText={setEmergencyName} placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Phone</Text><TextInput style={s.input} value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Relation</Text><TextInput style={s.input} value={emergencyRelation} onChangeText={setEmergencyRelation} placeholderTextColor="#a1a1aa" />
        </View>
        <View style={s.card}>
          <Text style={s.label}>MEDICAL & SAFEGUARDING</Text>
          <Text style={s.inputLabel}>Authorised collectors</Text>
          <TextInput style={[s.input, s.inputMulti]} value={authorisedCollectors} onChangeText={setAuthorisedCollectors} multiline numberOfLines={3} placeholderTextColor="#a1a1aa" />
          <Text style={s.inputLabel}>Medical notes</Text>
          <TextInput style={[s.input, s.inputMulti]} value={medicalNotes} onChangeText={setMedicalNotes} multiline numberOfLines={3} placeholderTextColor="#a1a1aa" />
        </View>
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
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
  photoInitials: { color: '#fff', fontSize: 22, fontWeight: '800' },
  changeBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  changeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  inputLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: '#242424', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
});
