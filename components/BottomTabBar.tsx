import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

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
function MenuIcon({ color }: { color: string }) {
  return <SvgXml xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>`} width={22} height={22} />;
}

const TABS = [
  { label: 'Dashboard', Icon: GridIcon, route: '/(tabs)' },
  { label: 'Book Classes', Icon: CalIcon, route: '/(tabs)/classes' },
  { label: 'Book PT', Icon: ClockIcon, route: '/(tabs)/instructors' },
  { label: 'More', Icon: MenuIcon, route: '/(tabs)/profile' },
];

export function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [, forceRender] = useState(0);
  useFocusEffect(useCallback(() => {
    forceRender(n => n + 1);
  }, []));

  function isActive(label: string) {
    if (label === 'Dashboard') return pathname === '/' || pathname === '/index';
    if (label === 'Book Classes') return pathname.startsWith('/classes');
    if (label === 'Book PT') return pathname.startsWith('/instructors');
    if (label === 'More') return pathname.startsWith('/profile') || pathname.startsWith('/child') || pathname.startsWith('/add-child') || pathname.startsWith('/plans');
    return false;
  }

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(tab => {
        const active = isActive(tab.label);
        const color = active ? '#ffffff' : '#8e8e93';
        return (
          <TouchableOpacity key={tab.label} style={s.tab} onPress={() => router.push(tab.route as any)} activeOpacity={0.7}>
            <tab.Icon color={color} />
            <Text style={[s.label, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: '#18181b', borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 10, fontWeight: '600' },
});
