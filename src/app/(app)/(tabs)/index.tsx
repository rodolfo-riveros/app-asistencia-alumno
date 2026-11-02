import { useQuery } from '@tanstack/react-query';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { esErrorDeRed, mensajeDeError } from '@/api/cliente';
import { obtenerHoy } from '@/api/endpoints';
import type { Hoy, Tarjeta } from '@/api/tipos';
import { BannerConexion } from '@/components/BannerConexion';
import { ANCHOS, centrado, useDisposicion } from '@/components/Contenedor';
import { TarjetaSeccion, type DatosTarjeta } from '@/components/TarjetaSeccion';
import { kvGuardar, kvLeer } from '@/db';
import type { ConteoLista } from '@/lista/estadoLista';
import { resumenLocal } from '@/lista/resumenLocal';
import { useInstitucion } from '@/store/institucion';
import { useSesion } from '@/store/sesion';
import { notificarCambio, useSync } from '@/store/sync';
import { refrescarNomina, sincronizarAhora } from '@/sync/sincronizador';
import { colores, fuentes } from '@/theme/tokens';
import { fechaISO, fechaLarga } from '@/utils/fechas';
import { escanea, pasaLista } from '@/utils/permisos';
import { estadoSeccion } from '@/utils/reglas';

const clave = (t: Tarjeta) => `${t.seccion_id}-${t.bloque_id ?? 0}`;

/** 02 · Mis secciones */
export default function MisSecciones() {
  const usuario = useSesion((s) => s.usuario);
  const version = useSync((s) => s.version);
  const [locales, setLocales] = useState<Record<string, ConteoLista>>({});
  const [refrescando, setRefrescando] = useState(false);
  const { columnasTarjetas } = useDisposicion();
  const { data: inst } = useInstitucion();

  const consulta = useQuery({
    queryKey: ['hoy'],
    queryFn: async (): Promise<{ hoy: Hoy; desdeCache: boolean }> => {
      try {
        const hoy = await obtenerHoy();
        await kvGuardar('hoy', hoy);
        notificarCambio({ online: true });
        return { hoy, desdeCache: false };
      } catch (e) {
        const guardado = await kvLeer<Hoy>('hoy');
        if (esErrorDeRed(e) && guardado) {
          notificarCambio({ online: false });
          return { hoy: guardado.valor, desdeCache: true };
        }
        throw e;
      }
    },
  });
  const hoy = consulta.data?.hoy;

  // Al volver a esta pestaña se actualizan los contadores.
  useFocusEffect(
    useCallback(() => {
      void consulta.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Contadores locales de las listas con marcas aún sin enviar.
  useEffect(() => {
    if (!hoy) return;
    let vigente = true;
    void (async () => {
      const fecha = hoy.fecha ?? fechaISO();
      const res: Record<string, ConteoLista> = {};
      for (const t of hoy.tarjetas) {
        const r = await resumenLocal({ seccionId: t.seccion_id, fecha, bloqueId: t.bloque_id });
        if (r) res[clave(t)] = r;
      }
      if (vigente) setLocales(res);
    })();
    return () => {
      vigente = false;
    };
  }, [hoy, version]);

  async function alRefrescar() {
    setRefrescando(true);
    await Promise.all([sincronizarAhora(true), refrescarNomina().catch(() => undefined)]);
    await consulta.refetch();
    setRefrescando(false);
  }

  const datos = (t: Tarjeta): DatosTarjeta => {
    const l = locales[clave(t)];
    if (!l) return { ...t, estado: t.estado };
    const registrados = l.total - l.sinMarcar;
    return {
      ...t,
      total: l.total,
      presentes: l.p,
      tardes: l.t,
      registrados,
      estado: estadoSeccion(l.total, registrados),
    };
  };

  const turno = hoy?.turno;
  const fecha = hoy?.fecha ?? fechaISO();

  // Sin permiso para pasar lista: va a lo que sí puede hacer.
  if (!pasaLista(usuario)) return <Redirect href={escanea(usuario) ? '/escanear' : '/perfil'} />;

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <FlatList
        key={`col-${columnasTarjetas}`}
        numColumns={columnasTarjetas}
        columnWrapperStyle={columnasTarjetas > 1 ? { gap: 12 } : undefined}
        data={hoy?.tarjetas ?? []}
        keyExtractor={clave}
        contentContainerStyle={[s.lista, centrado(ANCHOS.amplio)]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={colores.ink} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 16 }}>
            <View style={s.cabecera}>
              <View style={{ gap: 2, flex: 1 }}>
                {inst?.nombre ? <Text style={s.ie} numberOfLines={1}>{inst.nombre_corto || inst.nombre}</Text> : null}
                <Text style={s.fecha}>{fechaLarga(fecha)}</Text>
                <Text style={s.hola} accessibilityRole="header">Hola, {usuario?.nombre_corto}</Text>
              </View>
              <Pressable
                onPress={() => router.navigate('/perfil')}
                accessibilityRole="button"
                accessibilityLabel="Mi perfil"
                style={s.avatar}
              >
                <Text style={s.avatarTexto}>{usuario?.iniciales}</Text>
              </Pressable>
            </View>

            {turno ? (
              <View style={s.info}>
                <Info size={20} color={colores.textMuted} />
                <Text style={s.infoTexto}>
                  <Text style={{ fontFamily: fuentes.negrita }}>Ingreso {turno.hora_ingreso_texto}</Text> · tolerancia{' '}
                  {turno.tolerancia_min} min{'\n'}
                  <Text style={{ color: colores.textMuted }}>Desde las {turno.tarde_desde_texto} se marca tarde</Text>
                </Text>
              </View>
            ) : null}

            <BannerConexion />

            {hoy && !hoy.es_dia_lectivo ? (
              <View style={s.aviso}>
                <Text style={s.avisoTexto}>Hoy no hay clases: {hoy.motivo_no_lectivo?.toLowerCase()}.</Text>
              </View>
            ) : null}

            <View style={s.titulo}>
              <Text style={s.h2} accessibilityRole="header">Mis secciones</Text>
              {hoy ? <Text style={s.cuenta}>{hoy.tarjetas.length} asignadas</Text> : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
          <TarjetaSeccion
            d={datos(item)}
            onPress={() =>
              router.push({
                pathname: '/seccion/[id]/lista',
                params: { id: item.seccion_id, fecha, ...(item.bloque_id ? { bloque: item.bloque_id } : {}) },
              })
            }
          />
          </View>
        )}
        ListEmptyComponent={
          consulta.isLoading ? (
            <Text style={s.vacio}>Cargando tus secciones…</Text>
          ) : consulta.error ? (
            <Text style={s.vacio}>{mensajeDeError(consulta.error)} Desliza hacia abajo para reintentar.</Text>
          ) : (
            <Text style={s.vacio}>No tienes secciones asignadas como tutor(a). Consulta con dirección.</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  lista: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ie: { fontFamily: fuentes.semi, fontSize: 12, letterSpacing: 0.96, textTransform: 'uppercase', color: colores.textSubtle },
  fecha: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  hola: { fontFamily: fuentes.titulo, fontSize: 28, letterSpacing: -0.56, color: colores.ink },
  avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: colores.ink, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.textOnInk },
  info: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colores.surface, borderWidth: 1,
    borderColor: colores.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  infoTexto: { flex: 1, fontFamily: fuentes.regular, fontSize: 14, lineHeight: 19, color: colores.ink },
  aviso: { backgroundColor: colores.neutralChip, borderRadius: 14, padding: 14 },
  avisoTexto: { fontFamily: fuentes.semi, fontSize: 14, color: colores.textMuted },
  titulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: { fontFamily: fuentes.negrita, fontSize: 17, color: colores.ink },
  cuenta: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  vacio: { fontFamily: fuentes.regular, fontSize: 15, color: colores.textMuted, textAlign: 'center', paddingVertical: 32 },
});
