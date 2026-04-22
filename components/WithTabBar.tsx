import { View, StyleSheet } from 'react-native';
import { BottomTabBar } from './BottomTabBar';

export function WithTabBar({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.container}>
      <View style={s.content}>{children}</View>
      <BottomTabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flex: 1 },
});
