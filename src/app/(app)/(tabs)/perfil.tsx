import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { KeyRound, LogOut, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { obtenerMe } from '@/api/endpoints';
import type { Me } from '@/api/tipos';
import { BannerConexion } from '@/components/BannerConexion';
import { ANCHOS, centrado } from '@/components/Contenedor';
import { LogoInstitucion } from '@/components/LogoInstitucion';
import { Avatar, Etiqueta } from '@/components/ui';
import { kvGuardar, kvLeer } from '@/db';
import { useInstitucion } from '@/store/institucion';
import { useSesion } from '@/store/sesion';
import { useSync } from '@/store/sync';
import { sincronizarAhora } from '@/sync/sincronizador';
import { colores, fuentes, radios } from '@/theme/tokens';
import { confirmar } from '@/utils/dialogos';
import { horaTexto } from '@/utils/fechas';
import { plural } from '@/utils/texto';

/** Perfil: datos, secciones, estado de sincronización y cerrar sesión. */
export default function Perfil() {
  const usuario = useSesion((s) => s.usuario);
  const salir = useSesion((s) => s.salir);
  const { online, pendientes, ultimaSync, sincronizando } = useSync();
  const [saliendo, setSaliendo] = useState(false);
  const { data: inst } = useInstitucion();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const m = await obtenerMe();
        await kvGuardar('me', m);
        return m;
      } catch {
        return (await kvLeer<Me>('me'))?.valor ?? null;
      }
    },
  });

  async function cerrarSesion() {
    const mensaje = pendientes
      ? `Tienes ${plural(pendientes, 'marca')} sin enviar. Si cierras sesión ahora se perderán. Conéctate a internet y sincroniza primero.`
      : 'Se borrarán del teléfono las listas guardadas.';
    if (!(await confirmar('¿Cerrar sesión?', mensaje, 'Cerrar sesión', true))) return;
    setSaliendo(true);
    await salir();
  }

  const secciones = me?.secciones ?? [];

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={[s.contenido, centrado(ANCHOS.formulario)]}>
        <View style={s.cabecera}>
          <Avatar iniciales={usuario?.iniciales ?? ''} tam={64} oscuro />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre} accessibilityRole="header">{usuario?.nombre_completo}</Text>
            <Text style={s.sub}>{usuario?.rol_texto} · {usuario?.email}</Text>
          </View>
        </View>

        <BannerConexion />

        <View style={s.tarjeta}>
          <Etiqueta>Sincronización</Etiqueta>
          <Fila titulo="Conexión" valor={online ? 'En línea' : 'Sin conexión'} />
          <Fila titulo="Marcas por enviar" valor={String(pendientes)} />
          <Fila titulo="Última sincronización" valor={ultimaSync ? horaTexto(new Date(ultimaSync)) ?? '—' : '—'} />
          <Pressable
            style={s.accion}
            onPress={() => void sincronizarAhora(true)}
            disabled={sincronizando}
            accessibilityRole="button"
          >
            {sincronizando ? <ActivityIndicator color={colores.ink} /> : <RefreshCw size={20} color={colores.ink} />}
            <Text style={s.accionTexto}>Sincronizar ahora</Text>
          </Pressable>
        </View>

        <View style={s.tarjeta}>
          <Etiqueta>Mis secciones</Etiqueta>
          {secciones.length === 0 ? <Text style={s.sub}>Sin secciones asignadas.</Text> : null}
          {secciones.map((sec) => (
            <Fila key={sec.id} titulo={sec.descripcion} valor={sec.es_tutor ? 'Tutor(a)' : 'Área'} />
          ))}
        </View>

        <View style={s.tarjeta}>
          <Pressable style={s.accion} onPress={() => router.push('/cambiar-password')} accessibilityRole="button">
            <KeyRound size={20} color={colores.ink} />
            <Text style={s.accionTexto}>Cambiar contraseña</Text>
          </Pressable>
          <Pressable style={s.accion} onPress={() => void cerrarSesion()} disabled={saliendo} accessibilityRole="button">
            <LogOut size={20} color="#9A1F15" />
            <Text style={[s.accionTexto, { color: '#9A1F15' }]}>{saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
          </Pressable>
        </View>

        <View style={s.ie}>
          <LogoInstitucion url={inst?.logo_url} tam={44} />
          <View style={{ flex: 1 }}>
            <Text style={s.ieNombre}>{inst?.nombre || me?.institucion.nombre}</Text>
            {inst?.direccion ? <Text style={s.sub}>{inst.direccion}</Text> : null}
            {inst?.telefono || inst?.correo ? (
              <Text style={s.sub}>{[inst?.telefono, inst?.correo].filter(Boolean).join(' · ')}</Text>
            ) : null}
          </View>
        </View>
        <Text style={s.version}>Asistencia Escolar v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fila({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={s.fila}>
      <Text style={[s.sub, { flex: 1, color: colores.ink }]}>{titulo}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  contenido: { padding: 20, paddingTop: 28, gap: 16 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nombre: { fontFamily: fuentes.titulo, fontSize: 24, letterSpacing: -0.48, color: colores.ink },
  sub: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  tarjeta: {
    backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.border, borderRadius: radios.tarjeta,
    padding: 16, gap: 4,
  },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: 12 },
  valor: { fontFamily: fuentes.negrita, fontSize: 14, color: colores.ink },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  accionTexto: { fontFamily: fuentes.semi, fontSize: 16, color: colores.ink },
  ie: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  ieNombre: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  version: { textAlign: 'center', fontFamily: fuentes.regular, fontSize: 12, color: colores.textSubtle, lineHeight: 18 },
});
