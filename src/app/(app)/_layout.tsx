import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { esErrorDeRed } from '@/api/cliente';
import { obtenerMe } from '@/api/endpoints';

import { useSesion } from '@/store/sesion';
import { useMotorSync } from '@/sync/sincronizador';
import { colores } from '@/theme/tokens';

export default function AppLayout() {
  const usuario = useSesion((s) => s.usuario);
  const segmentos = useSegments();
  useMotorSync();
  const queryClient = useQueryClient();

  // Rol, permisos y datos de la I.E. pueden cambiar en el panel: se refrescan al abrir la app.
  useEffect(() => {
    obtenerMe()
      .then((me) => {
        void useSesion.getState().actualizarUsuario(me.usuario);
        queryClient.setQueryData(['me'], me);
        void queryClient.invalidateQueries({ queryKey: ['institucion'] });
      })
      .catch((e) => {
        if (!esErrorDeRed(e)) console.warn('No se pudo actualizar el perfil');
      });
  }, [queryClient]);

  // Contraseña temporal entregada por dirección: hay que cambiarla primero.
  if (usuario?.debe_cambiar_password && !segmentos.includes('cambiar-password' as never)) {
    return <Redirect href="/cambiar-password" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="seccion/[id]/lista" />
      <Stack.Screen name="seccion/[id]/escanear" />
      <Stack.Screen name="estudiante/[id]" />
      <Stack.Screen
        name="justificar/[matriculaId]"
        options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen name="cambiar-password" />
    </Stack>
  );
}
