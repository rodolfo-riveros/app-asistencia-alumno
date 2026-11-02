import { Tabs } from 'expo-router';
import { LayoutGrid, ScanLine, Search, User } from 'lucide-react-native';

import { useSesion } from '@/store/sesion';
import { escanea, pasaLista, puede } from '@/utils/permisos';
import { colores, fuentes } from '@/theme/tokens';

export default function TabsLayout() {
  // Cada pestaña aparece solo si el rol del usuario lo permite (se configura en el panel).
  const usuario = useSesion((s) => s.usuario);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.ink,
        tabBarInactiveTintColor: colores.textMuted,
        tabBarStyle: { backgroundColor: colores.surface, borderTopColor: colores.border, paddingTop: 6, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fuentes.semi, fontSize: 12 },
        sceneStyle: { backgroundColor: colores.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Secciones', href: pasaLista(usuario) ? undefined : null, tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} /> }} />
      <Tabs.Screen name="escanear" options={{ title: 'Escanear QR', href: escanea(usuario) ? undefined : null, tabBarIcon: ({ color }) => <ScanLine size={22} color={color} /> }} />
      <Tabs.Screen name="estudiantes" options={{ title: 'Estudiantes', href: puede(usuario, 'estudiantes.ver_historial') ? undefined : null, tabBarIcon: ({ color }) => <Search size={22} color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}
