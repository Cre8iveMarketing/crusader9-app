import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ActivityIndicator, View, Text, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { SvgXml } from 'react-native-svg';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 218.75 200"><polygon fill="#fff" points="105.64 134.51 74.71 125.58 71.8 124.75 71.8 148.87 52.56 165.03 33.32 148.87 33.32 51.14 52.56 34.91 71.8 51.14 71.8 75.2 74.71 74.37 105.64 65.5 105.64 38.66 98.97 33.81 52.56 .03 41.94 7.77 33.29 14.07 0 38.35 0 161.6 33.29 185.93 41.69 192.05 52.56 200 98.92 166.18 105.64 161.28 105.64 134.51"/><path fill="#fff" d="M218.75,38.35l-33.3-24.13-8.7-6.31-10.92-7.91-45.59,33.03-7.45,5.4v62.24l31.24,15.62,21.79,10.9,19.22-15.97v37.63l-19.22,16.23-19.22-16.23v-24.1l-2.58.72-31.24,8.76v27.06l7.13,5.21,45.91,33.48,10.83-7.9,8.8-6.42,33.3-24.29V38.35ZM185.04,77.94l-19.22,12.98-19.22-9.46v-30.3l19.22-16.24,19.22,16.24v26.78Z"/></svg>`;

function GridIcon({ color }: { color: string }) {
  return <SvgXml xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" /></svg>`} width={22} height={22} />;
}
function CalIcon({ color }: { color: string }) {
  return <SvgXml xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`} width={22} height={22} />;
}
function ClockIcon({ color }: { color: string }) {
  return <SvgXml xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`} width={22} height={22} />;
}
function CreditIcon({ color }: { color: string }) {
  return <SvgXml xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>`} width={22} height={22} />;
}
function PersonIcon({ color }: { color: string }) {
  return <SvgXml xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`} width={22} height={22} />;
}

export default function TabsLayout() {
  const { member, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}><ActivityIndicator color={Colors.white} /></View>;
  if (!member) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs screenOptions={{
      tabBarStyle: {
        backgroundColor: Colors.surface,
        borderTopColor: Colors.border,
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: Colors.white,
      tabBarInactiveTintColor: Colors.textFaint,
      tabBarLabelStyle: { fontSize: 10 },
      header: () => (
        <View style={{
          backgroundColor: Colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          paddingTop: Platform.OS === 'ios' ? 54 : 12,
          paddingBottom: 10,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <SvgXml xml={LOGO_SVG} width={90} height={33} />
        </View>
      ),
    }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <GridIcon color={color} /> }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarLabel: 'Classes', tabBarIcon: ({ color }) => <CalIcon color={color} /> }} />
      <Tabs.Screen name="instructors" options={{ title: 'PT Sessions', tabBarLabel: 'PT', tabBarIcon: ({ color }) => <ClockIcon color={color} /> }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarLabel: 'Plans', tabBarIcon: ({ color }) => <CreditIcon color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <PersonIcon color={color} /> }} />
    </Tabs>
  );
}
