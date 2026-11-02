import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { obtenerDb } from '@/db';
import { useSesion } from '@/store/sesion';
import { colores } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true } },
});

export default function RootLayout() {
  const [fuentesListas] = useFonts({
    BricolageGrotesque_700Bold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
  });
  const [dbLista, setDbLista] = useState(false);
  const listo = useSesion((s) => s.listo);
  const usuario = useSesion((s) => s.usuario);

  useEffect(() => {
    void (async () => {
      await obtenerDb();
      setDbLista(true);
      await useSesion.getState().iniciar();
    })();
  }, []);

  const todoListo = fuentesListas && dbLista && listo;
  useEffect(() => {
    if (todoListo) void SplashScreen.hideAsync();
  }, [todoListo]);

  if (!todoListo) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.bg } }}>
          <Stack.Protected guard={!!usuario}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!usuario}>
            <Stack.Screen name="(auth)/login" />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
