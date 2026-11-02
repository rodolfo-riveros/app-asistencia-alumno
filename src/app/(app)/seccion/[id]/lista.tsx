import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, QrCode, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BannerConexion } from '@/components/BannerConexion';
import { ANCHOS, Contenedor, centrado } from '@/components/Contenedor';
import { FilaEstudiante } from '@/components/FilaEstudiante';
import { guardarLista, marcar, marcarVarios, type ClaveLista } from '@/lista/acciones';
import { filtrar, textoPendientes, type FilaLista } from '@/lista/estadoLista';
import { useLista } from '@/lista/useLista';
import { useSesion } from '@/store/sesion';
import { useSync } from '@/store/sync';
import { colores, estados, fuentes, type Estado } from '@/theme/tokens';
import { fechaCabecera, fechaISO, horaTexto } from '@/utils/fechas';
import { avisar, confirmar } from '@/utils/dialogos';
import { puede } from '@/utils/permisos';
import { estadoAlTocar } from '@/utils/reglas';

/** 03 · Pase de lista */
export default function PaseDeLista() {
  const params = useLocalSearchParams<{ id: string; fecha?: string; bloque?: string }>();
  const clave: ClaveLista = useMemo(
    () => ({
      seccionId: Number(params.id),
      fecha: params.fecha ?? fechaISO(),
      bloqueId: params.bloque ? Number(params.bloque) : null,
    }),
    [params.id, params.fecha, params.bloque],
  );
  const lista = useLista(clave);
  const ultimoGuardado = useSync((s) => s.ultimoGuardado);
  const usuario = useSesion((s) => s.usuario);
  const puedeJustificar = puede(usuario, 'asistencia.justificar');
  const verHistorial = puede(usuario, 'estudiantes.ver_historial');
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);

  const visibles = useMemo(() => filtrar(lista.filas, busqueda), [lista.filas, busqueda]);
  const { turno, editable } = lista;

  const alTocar = useCallback(
    (fila: FilaLista, tocado: Estado) => {
      if (tocado === 'J' && fila.estado !== 'J') {
        router.push({
          pathname: '/justificar/[matriculaId]',
          params: {
            matriculaId: fila.matricula_id,
            seccion: clave.seccionId,
            fecha: clave.fecha,
            ...(clave.bloqueId ? { bloque: clave.bloqueId } : {}),
            nombre: `${fila.apellidos}, ${fila.nombres}`,
          },
        });
        return;
      }
      const nuevo = estadoAlTocar(fila.estado, tocado, new Date(), turno);
      void marcar(clave, { matriculaId: fila.matricula_id, estado: nuevo });
    },
    [clave, turno],
  );

  const abrirHistorial = useCallback(
    (fila: FilaLista) => router.push({ pathname: '/estudiante/[id]', params: { id: fila.estudiante_id } }),
    [],
  );

  async function todosPresentes() {
    const sinMarcar = lista.filas.filter((f) => f.estado === null);
    if (sinMarcar.length === 0) {
      avisar('Todos registrados', 'No hay estudiantes sin marcar.');
      return;
    }
    const n = sinMarcar.length;
    const ok = await confirmar(
      'Todos presentes',
      `Se marcará a ${n} estudiante${n === 1 ? '' : 's'} sin marcar. Los ya marcados no cambian.`,
      'Marcar',
    );
    if (!ok) return;
    const ahora = new Date();
    await marcarVarios(
      clave,
      sinMarcar.map((f) => ({ matriculaId: f.matricula_id, estado: estadoAlTocar(null, 'P', ahora, turno) })),
    );
  }

  async function alGuardar() {
    setGuardando(true);
    try {
      await guardarLista(clave);
      const enviado = useSync.getState().pendientes === 0;
      avisar(
        'Lista guardada',
        enviado
          ? 'La asistencia quedó registrada. Puedes corregirla hasta las 23:59 de hoy.'
          : 'Se guardó en el teléfono y se enviará apenas haya conexión.',
      );
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  const c = lista.conteo;
  const contadores: { estado: Estado; valor: number; texto: string }[] = [
    { estado: 'P', valor: c.p, texto: 'Presentes' },
    { estado: 'T', valor: c.t, texto: 'Tardes' },
    { estado: 'F', valor: c.f, texto: 'Faltas' },
    { estado: 'J', valor: c.j, texto: 'Justif.' },
  ];

  return (
    <View style={s.pantalla}>
      <SafeAreaView edges={['top']} style={s.cabecera}>
        <Contenedor style={{ gap: 14 }}>
        <View style={s.filaCabecera}>
          <Pressable onPress={() => router.back()} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver a secciones">
            <ChevronLeft size={22} color={colores.textOnInk} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo} numberOfLines={1} accessibilityRole="header">{lista.nombreSeccion}</Text>
            <Text style={s.sub}>{fechaCabecera(clave.fecha)} · {c.total} estudiantes</Text>
          </View>
          <Pressable
            style={s.botonQr}
            accessibilityRole="button"
            accessibilityLabel="Cambiar a modo QR"
            onPress={() => router.push({ pathname: '/seccion/[id]/escanear', params: { id: clave.seccionId } })}
          >
            <QrCode size={18} color={colores.textOnInk} />
            <Text style={s.botonQrTexto}>QR</Text>
          </Pressable>
        </View>
        <View style={s.contadores}>
          {contadores.map((x) => (
            <View key={x.estado} style={[s.contador, { backgroundColor: estados[x.estado].solido }]} accessible accessibilityLabel={`${x.valor} ${x.texto}`}>
              <Text style={s.contadorValor}>{x.valor}</Text>
              <Text style={s.contadorTexto}>{x.texto}</Text>
            </View>
          ))}
        </View>
        </Contenedor>
      </SafeAreaView>

      <View style={s.barraHerramientas}>
      <Contenedor style={s.herramientas}>
        <View style={s.buscador}>
          <Search size={18} color={colores.textMuted} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar estudiante"
            placeholderTextColor={colores.disabled}
            accessibilityLabel="Buscar estudiante"
            style={s.buscadorInput}
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={() => void todosPresentes()}
          disabled={!editable}
          style={[s.todos, !editable && { opacity: 0.5 }]}
          accessibilityRole="button"
        >
          <Check size={18} color={estados.P.chipFg} strokeWidth={2.2} />
          <Text style={s.todosTexto}>Todos presentes</Text>
        </Pressable>
      </Contenedor>
      </View>

      <FlatList
        data={visibles}
        keyExtractor={(f) => String(f.matricula_id)}
        renderItem={({ item }) => (
          <FilaEstudiante
            fila={item}
            editable={editable}
            onTocar={alTocar}
            onAbrir={verHistorial ? abrirHistorial : undefined}
            puedeJustificar={puedeJustificar}
          />
        )}
        contentContainerStyle={[s.lista, centrado(ANCHOS.contenido)]}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <BannerConexion />
            {!lista.esDiaLectivo ? <Text style={s.aviso}>Hoy no es día lectivo: no se puede registrar asistencia.</Text> : null}
            {lista.esDiaLectivo && !editable ? (
              <Text style={s.aviso}>Solo lectura: la asistencia de este día ya no se puede modificar desde la app.</Text>
            ) : null}
            {lista.error ? <Text style={s.aviso}>{lista.error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={s.vacio}>
            {lista.cargando
              ? 'Cargando estudiantes…'
              : busqueda
                ? 'Ningún estudiante coincide con la búsqueda.'
                : 'No hay estudiantes guardados para esta sección. Conéctate a internet una vez para descargar la lista.'}
          </Text>
        }
      />

      <SafeAreaView edges={['bottom']} style={s.pie}>
        <Contenedor style={s.pieFila}>
        <View style={{ flex: 1 }}>
          <Text style={s.pendientes}>{textoPendientes(c.sinMarcar)}</Text>
          <View style={s.guardado}>
            <View style={s.puntoVerde} />
            <Text style={s.guardadoTexto}>
              Guardado automático{ultimoGuardado ? ` · ${horaTexto(new Date(ultimoGuardado))}` : ''}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={alGuardar}
          disabled={guardando || !editable}
          style={[s.guardar, (guardando || !editable) && { opacity: 0.6 }]}
          accessibilityRole="button"
        >
          <Text style={s.guardarTexto}>{guardando ? 'Guardando…' : 'Guardar lista'}</Text>
        </Pressable>
        </Contenedor>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  cabecera: { backgroundColor: colores.ink, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16 },
  volver: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuentes.titulo, fontSize: 20, color: colores.textOnInk },
  sub: { fontFamily: fuentes.regular, fontSize: 13, color: colores.textOnInkMuted },
  botonQr: {
    height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colores.borderOnInk,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  botonQrTexto: { fontFamily: fuentes.semi, fontSize: 13, color: colores.textOnInk },
  contadores: { flexDirection: 'row', gap: 8 },
  contador: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  contadorValor: { fontFamily: fuentes.titulo, fontSize: 22, color: colores.textOnInk },
  contadorTexto: { fontFamily: fuentes.semi, fontSize: 12, color: colores.textOnInk },
  barraHerramientas: { borderBottomWidth: 1, borderBottomColor: colores.border, backgroundColor: colores.bg },
  herramientas: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  buscador: {
    flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.borderInput, borderRadius: 12,
  },
  buscadorInput: { flex: 1, minWidth: 0, fontFamily: fuentes.regular, fontSize: 15, color: colores.ink, paddingVertical: 0 },
  todos: {
    height: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: estados.P.solido,
    backgroundColor: estados.P.chipBg, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  todosTexto: { fontFamily: fuentes.negrita, fontSize: 13, color: estados.P.chipFg },
  lista: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  aviso: {
    fontFamily: fuentes.semi, fontSize: 14, color: estados.T.chipFg, backgroundColor: estados.T.chipBg,
    borderRadius: 12, padding: 12,
  },
  vacio: { fontFamily: fuentes.regular, fontSize: 15, color: colores.textMuted, textAlign: 'center', paddingVertical: 32 },
  pie: {
    backgroundColor: colores.surface, borderTopWidth: 1, borderTopColor: colores.border,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  pieFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pendientes: { fontFamily: fuentes.negrita, fontSize: 14, color: colores.ink },
  guardado: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  puntoVerde: { width: 7, height: 7, borderRadius: 999, backgroundColor: estados.P.solido },
  guardadoTexto: { fontFamily: fuentes.regular, fontSize: 12, color: colores.textMuted },
  guardar: { height: 50, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colores.ink, justifyContent: 'center' },
  guardarTexto: { fontFamily: fuentes.negrita, fontSize: 16, color: '#FFFFFF' },
});
