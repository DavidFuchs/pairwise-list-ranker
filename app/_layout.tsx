import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { installColdBuildProbe } from '@/lib/engine/coldBuildProbe';
import { colors } from '@/lib/theme';

installColdBuildProbe();

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </>
  );
}
