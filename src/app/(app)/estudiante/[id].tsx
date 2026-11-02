import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Phone, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { esErrorDeRed, mensajeDeError } from '@/api/cliente';
import { obtenerHistorial, type Historial } from '@/api/endpoints';
import { ANCHOS, centrado } from '@/components/Contenedor';
import { kvGuardar, kvLeer } from '@/db';
import { celdasDelMes } from '@/lista/calendario';
import { colores, estados, fuentes, radios } from '@/theme/tokens';
import { fechaISO } from '@/utils/fechas';

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** 06 · Historial del estudiante */
export default function HistorialEstudiante() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const estudianteId = Number(id);
  const [mes, setMes] = useState(() => fechaISO().slice(0, 7));

  const consulta = useQuery({
    queryKey: ['historial', estudianteId, mes],
    placeholderData: (anterior) => anterior,
    queryFn: async (): Promise<{ h: Historial; desdeCache: boolean }> => {
      const clave = `historial:${estudianteId}:${mes}`;
      try {
        const h = await obtenerHistorial(estudianteId, mes);
        await kvGuardar(clave, h);
        return { h, desdeCache: false };
      } catch (e) {
        const guardado = await kvLeer<Historial>(clave);
        if (esErrorDeRed(e) && guardado) return { h: guardado.valor, desdeCache: true };
        throw e;
      }
    },
  });
  const h = consulta.data?.h;
  const celdas = useMemo(() => celdasDelMes(h?.dias ?? []), [h]);

  function justificar(ev: Historial['eventos'][number]) {
    if (!h) return;
    router.push({
      pathname: '/justificar/[matriculaId]',
      params: { matriculaId: h.estudiante.matricula_id, seccion: h.seccion.id, fecha: ev.fecha, nombre: h.estudiante.nombre_completo },
    });
  }

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <View style={[s.barra, centrado(ANCHOS.formulario)]}>
        <Pressable onPress={() => router.back()} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver">
          <ChevronLeft size={24} color={colores.ink} />
        </Pressable>
        <Text style={s.barraTitulo}>Historial</Text>
      </View>

      {!h ? (
        <View style={s.centro}>
          {consulta.isLoading ? (
            <ActivityIndicator color={colores.ink} />
          ) : (
            <Text style={s.vacio}>
              {esErrorDeRed(consulta.error)
                ? 'Sin conexión. El historial necesita internet la primera vez que lo abres.'
                : mensajeDeError(consulta.error)}
            </Text>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[{ paddingBottom: 24 }, centrado(ANCHOS.formulario)]}>
          <View style={s.cabecera}>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{h.estudiante.iniciales}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.nombre} accessibilityRole="header">{h.estudiante.nombre_completo}</Text>
              <Text style={s.sub}>{h.seccion.descripcion}</Text>
            </View>
          </View>

          {h.indicadores.alerta_riesgo ? (
            <View style={s.alerta}>
              <TriangleAlert size={18} color={estados.F.chipFg} />
              <Text style={s.alertaTexto}>Alerta de riesgo este mes: muchas faltas o tardanzas.</Text>
            </View>
          ) : null}
          {consulta.data?.desdeCache ? <Text style={s.cache}>Sin conexión · mostrando lo último guardado</Text> : null}

          <View style={s.indicadores}>
            <View style={[s.indicador, s.indicadorOscuro]}>
              <Text style={[s.indValor, { color: colores.textOnInk }]}>{h.indicadores.porcentaje_texto}</Text>
              <Text style={[s.indTexto, { color: colores.textOnInkMuted }]}>Asistencia del mes</Text>
            </View>
            <View style={s.indicador}>
              <Text style={[s.indValor, { color: estados.T.chipFg }]}>{h.indicadores.tardanzas}</Text>
              <Text style={s.indTexto}>Tardanzas</Text>
            </View>
            <View style={s.indicador}>
              <Text style={[s.indValor, { color: estados.F.chipFg }]}>{h.indicadores.faltas}</Text>
              <Text style={s.indTexto}>Faltas · {h.indicadores.justificados} justif.</Text>
            </View>
          </View>

          <View style={s.calendario}>
            <View style={s.navMes}>
              <Pressable onPress={() => setMes(h.mes_anterior)} style={s.flecha} accessibilityRole="button" accessibilityLabel="Mes anterior">
                <ChevronLeft size={22} color={colores.ink} />
              </Pressable>
              <Text style={s.mes}>{h.mes_texto}</Text>
              <Pressable
                onPress={() => h.mes_siguiente && setMes(h.mes_siguiente)}
                disabled={!h.mes_siguiente}
                style={[s.flecha, !h.mes_siguiente && { opacity: 0.3 }]}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
              >
                <ChevronRight size={22} color={colores.ink} />
              </Pressable>
            </View>
            <View style={s.semana}>
              {SEMANA.map((d, i) => (
                <Text key={i} style={s.diaSemana}>{d}</Text>
              ))}
            </View>
            <View style={s.rejilla}>
              {celdas.map((c, i) => {
                if (c.tipo === 'vacia') return <View key={i} style={s.celda} />;
                const e = c.estado ? estados[c.estado] : null;
                const solido = c.estado === 'F' || c.estado === 'J';
                const bg = !c.habil ? 'transparent' : e ? (solido ? e.solido : e.chipBg) : colores.bg;
                const fg = !c.habil ? colores.disabled : e ? (solido ? '#FFFFFF' : e.chipFg) : colores.ink;
                return (
                  <View
                    key={i}
                    style={[s.celda, { backgroundColor: bg }]}
                    accessible
                    accessibilityLabel={`${c.dia}${e ? `: ${e.nombre}` : c.habil ? '' : ': sin clases'}`}
                  >
                    <Text style={[s.celdaDia, { color: fg }]}>{c.dia}</Text>
                    {c.estado && c.habil ? <Text style={[s.celdaLetra, { color: fg }]}>{c.estado}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={s.eventos}>
            <Text style={s.h2}>Faltas y justificaciones</Text>
            {h.eventos.length === 0 ? <Text style={s.sub}>Sin faltas este mes.</Text> : null}
            {h.eventos.map((ev) => {
              const e = estados[ev.estado];
              const puede = ev.editable && ev.estado === 'F' && h.puede_justificar;
              return (
                <Pressable
                  key={ev.registro_id}
                  disabled={!puede}
                  onPress={() => justificar(ev)}
                  style={s.evento}
                  accessibilityRole={puede ? 'button' : undefined}
                  accessibilityHint={puede ? 'Abre justificar' : undefined}
                >
                  <View style={[s.chip, { backgroundColor: e.chipBg }]}>
                    <Text style={[s.chipTexto, { color: e.chipFg }]}>{ev.titulo}</Text>
                  </View>
                  <Text style={s.eventoTexto}>
                    <Text style={{ fontFamily: fuentes.negrita }}>{ev.fecha_texto}</Text> · {ev.detalle}
                  </Text>
                  {puede ? <ChevronRight size={18} color={colores.textMuted} /> : null}
                </Pressable>
              );
            })}
          </View>

          {h.puede_llamar && h.apoderado ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${h.apoderado?.celular}`)}
              style={s.llamar}
              accessibilityRole="button"
              accessibilityLabel={`Llamar al apoderado, ${h.apoderado.nombre}`}
            >
              <Phone size={20} color="#FFFFFF" />
              <View>
                <Text style={s.llamarTexto}>Llamar al apoderado</Text>
                <Text style={s.llamarSub}>{h.apoderado.nombre}{h.apoderado.parentesco ? ` · ${h.apoderado.parentesco}` : ''}</Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  barra: { paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  volver: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  barraTitulo: { flex: 1, fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  vacio: { fontFamily: fuentes.regular, fontSize: 15, color: colores.textMuted, textAlign: 'center' },
  cabecera: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 18, backgroundColor: colores.ink, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontFamily: fuentes.titulo, fontSize: 22, color: colores.textOnInk },
  nombre: { fontFamily: fuentes.titulo, fontSize: 21, lineHeight: 24, color: colores.ink },
  sub: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  alerta: {
    marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: estados.F.chipBg, borderRadius: 12, padding: 10,
  },
  alertaTexto: { flex: 1, fontFamily: fuentes.semi, fontSize: 13, color: estados.F.chipFg },
  cache: { marginHorizontal: 16, marginBottom: 10, fontFamily: fuentes.semi, fontSize: 13, color: estados.T.chipFg },
  indicadores: { paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  indicador: {
    flex: 1, backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.border, borderRadius: 14, padding: 12, gap: 2,
  },
  indicadorOscuro: { backgroundColor: colores.ink, borderColor: colores.ink },
  indValor: { fontFamily: fuentes.titulo, fontSize: 26 },
  indTexto: { fontFamily: fuentes.regular, fontSize: 12, color: colores.textMuted },
  calendario: {
    marginTop: 14, marginHorizontal: 16, backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.border,
    borderRadius: radios.tarjeta, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 14, gap: 10,
  },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flecha: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  mes: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  semana: { flexDirection: 'row' },
  diaSemana: { flex: 1, textAlign: 'center', fontFamily: fuentes.negrita, fontSize: 12, color: colores.textMuted },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  celda: { width: `${100 / 7}%`, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colores.surface },
  celdaDia: { fontFamily: fuentes.negrita, fontSize: 13, lineHeight: 14 },
  celdaLetra: { fontFamily: fuentes.negrita, fontSize: 10, lineHeight: 11 },
  eventos: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  h2: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  evento: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colores.surface, borderWidth: 1,
    borderColor: colores.border, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minHeight: 48,
  },
  chip: { height: 26, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center' },
  chipTexto: { fontFamily: fuentes.negrita, fontSize: 12 },
  eventoTexto: { flex: 1, fontFamily: fuentes.regular, fontSize: 14, color: colores.ink },
  llamar: {
    marginTop: 16, marginHorizontal: 16, height: 60, borderRadius: radios.boton, backgroundColor: colores.ink,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18,
  },
  llamarTexto: { fontFamily: fuentes.negrita, fontSize: 16, color: '#FFFFFF' },
  llamarSub: { fontFamily: fuentes.regular, fontSize: 13, color: colores.textOnInkMuted },
});
