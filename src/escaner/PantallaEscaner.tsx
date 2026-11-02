import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import {
  CameraOff, Check, CircleAlert, Clock, Copy, Flashlight, FlashlightOff, TriangleAlert, X,
} from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDisposicion } from '@/components/Contenedor';
import { useSync } from '@/store/sync';
import { colores, estados, fuentes } from '@/theme/tokens';

import { useFeedbackEscaneo } from './feedback';
import { procesarEscaneo } from './procesar';
import { lineaHistorial, type ResultadoEscaneo, type TipoResultado } from './resolver';
import { totalHoy, useEscaner } from './store';

const IGNORAR_MISMO_CODIGO_MS = 3000;
const AREA = 240;

/** Colores por tipo de resultado (franja de la tarjeta e ícono de la lista). */
function estilo(r: Pick<ResultadoEscaneo, 'tipo' | 'estado'>) {
  switch (r.tipo) {
    case 'ok':
      return r.estado === 'T'
        ? { solido: estados.T.solido, bg: estados.T.chipBg, fg: estados.T.chipFg, Icono: Clock }
        : { solido: estados.P.solido, bg: estados.P.chipBg, fg: estados.P.chipFg, Icono: Check };
    case 'duplicado':
      return { solido: estados.J.solido, bg: estados.J.chipBg, fg: estados.J.chipFg, Icono: Copy };
    case 'otra_seccion':
      return { solido: estados.T.solido, bg: estados.T.chipBg, fg: estados.T.chipFg, Icono: TriangleAlert };
    default:
      return { solido: estados.F.solido, bg: estados.F.chipBg, fg: estados.F.chipFg, Icono: CircleAlert };
  }
}

const TITULO_FRANJA: Record<TipoResultado, string> = {
  ok: 'Presente registrado',
  duplicado: 'Ya registrado',
  otra_seccion: 'Otra sección',
  invalido: 'Código no válido',
  rechazado: 'No se registró',
};

interface Props {
  modo: 'PUERTA' | 'SECCION';
  seccionId: number | null;
  etiqueta: string; // 'Ingreso · Puerta principal' o '3.º B · Ingreso'
  alCerrar: () => void;
}

/** 05 · Escáner QR (diseño docs/diseno/05-escaner-qr.html). */
export function PantallaEscaner({ modo, seccionId, etiqueta, alCerrar }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [activa, setActiva] = useState(false);
  const [linterna, setLinterna] = useState(false);
  const [destello, setDestello] = useState<ResultadoEscaneo | null>(null);
  const [codigoManual, setCodigoManual] = useState('');
  const online = useSync((s) => s.online);
  const historial = useEscaner((s) => s.historial);
  const total = useEscaner(totalHoy);
  const agregar = useEscaner((s) => s.agregar);
  const feedback = useFeedbackEscaneo();
  const { alto } = useDisposicion();
  const altoVisor = Math.max(320, Math.min(440, Math.round(alto * 0.5)));
  const ultimo = useRef<{ data: string; t: number } | null>(null);
  const ocupado = useRef(false);

  // La cámara solo se enciende con la pantalla visible (las pestañas siguen montadas).
  useFocusEffect(
    useCallback(() => {
      setActiva(true);
      return () => {
        setActiva(false);
        setLinterna(false);
      };
    }, []),
  );

  const procesar = useCallback(
    async (data: string) => {
      const ahora = Date.now();
      // Escaneo continuo: el mismo código se ignora 3 s para no duplicar lecturas.
      if (ocupado.current || (ultimo.current?.data === data && ahora - ultimo.current.t < IGNORAR_MISMO_CODIGO_MS)) return;
      ocupado.current = true;
      ultimo.current = { data, t: ahora };
      try {
        const { resultado, escaneadosHoy } = await procesarEscaneo(data, {
          modo, seccionDestinoId: seccionId, online: useSync.getState().online,
        });
        agregar(resultado, escaneadosHoy);
        setDestello(resultado);
        feedback(resultado.tipo);
        setTimeout(() => setDestello((d) => (d?.id === resultado.id ? null : d)), 1400);
      } finally {
        ocupado.current = false;
      }
    },
    [modo, seccionId, agregar, feedback],
  );

  const alLeer = useCallback((r: BarcodeScanningResult) => void procesar(r.data), [procesar]);
  const actual = historial[0] ?? null;

  return (
    <View style={s.pantalla}>
      <View style={s.columna}>
      <View style={[s.visor, { height: altoVisor }]}>
        {permiso?.granted && activa ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={linterna}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={alLeer}
          />
        ) : (
          <Rejilla />
        )}

        <SafeAreaView edges={['top']} style={s.barra}>
          <Pressable onPress={alCerrar} style={s.redondo} accessibilityRole="button" accessibilityLabel="Cerrar escáner">
            <X size={22} color={colores.textOnInk} />
          </Pressable>
          <View style={s.pildora}>
            <View style={[s.punto, { backgroundColor: online ? colores.scanOk : estados.T.punto }]} />
            <Text style={s.pildoraTexto} numberOfLines={1}>{etiqueta}{online ? '' : ' · sin conexión'}</Text>
          </View>
          <Pressable
            onPress={() => setLinterna((v) => !v)}
            style={[s.redondo, linterna && { backgroundColor: colores.textOnInk }]}
            accessibilityRole="button"
            accessibilityLabel={linterna ? 'Apagar linterna' : 'Encender linterna'}
            accessibilityState={{ selected: linterna }}
          >
            {linterna ? <FlashlightOff size={20} color={colores.ink} /> : <Flashlight size={20} color={colores.textOnInk} />}
          </Pressable>
        </SafeAreaView>

        {permiso?.granted ? (
          <View style={[s.marco, { top: Math.max(80, (altoVisor - AREA) / 2 - 10) }]} pointerEvents="none">
            <View style={[s.esquina, s.supIzq]} />
            <View style={[s.esquina, s.supDer]} />
            <View style={[s.esquina, s.infIzq]} />
            <View style={[s.esquina, s.infDer]} />
            {destello ? <Destello r={destello} /> : null}
          </View>
        ) : (
          <SinPermiso puedePreguntar={permiso?.canAskAgain ?? true} pedir={pedirPermiso} />
        )}

        <Text style={s.indicacion}>Apunta al código QR del carnet</Text>
      </View>

      <View style={s.tarjeta} accessibilityLiveRegion="polite">
        {actual ? <TarjetaResultado r={actual} /> : (
          <View style={s.tarjetaVacia}>
            <Text style={s.vacioTitulo}>Listo para escanear</Text>
            <Text style={s.vacioSub}>
              {modo === 'SECCION' ? 'Solo se registran estudiantes de esta sección.' : 'Registra el ingreso de tus estudiantes.'}
            </Text>
          </View>
        )}
      </View>

      {Platform.OS === 'web' && __DEV__ ? (
        <View style={s.manual}>
          <TextInput
            value={codigoManual}
            onChangeText={setCodigoManual}
            placeholder="Código del QR (solo desarrollo web)"
            placeholderTextColor="#7D869A"
            accessibilityLabel="Código QR manual"
            style={s.manualInput}
            onSubmitEditing={() => {
              void procesar(codigoManual);
              setCodigoManual('');
            }}
          />
        </View>
      ) : null}

      <FlatList
        data={historial.slice(1)}
        keyExtractor={(r) => r.id}
        contentContainerStyle={s.lista}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View style={s.cabLista}>
            <Text style={s.h2}>Últimos escaneados</Text>
            <Text style={s.cuenta}>{total} hoy</Text>
          </View>
        }
        renderItem={({ item }) => <FilaHistorial r={item} />}
      />
      </View>
    </View>
  );
}

function Rejilla() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colores.scanBg, opacity: 1 }]}>
      {Array.from({ length: 18 }, (_, i) => (
        <View key={`h${i}`} style={[s.lineaH, { top: i * 28 }]} />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <View key={`v${i}`} style={[s.lineaV, { left: i * 28 }]} />
      ))}
    </View>
  );
}

function SinPermiso({ puedePreguntar, pedir }: { puedePreguntar: boolean; pedir: () => void }) {
  return (
    <View style={s.sinPermiso}>
      <CameraOff size={32} color={colores.textOnInk} />
      <Text style={s.sinPermisoTexto}>Para escanear carnets necesitamos usar la cámara.</Text>
      <Pressable
        onPress={puedePreguntar ? pedir : () => void Linking.openSettings()}
        style={s.permitir}
        accessibilityRole="button"
      >
        <Text style={s.permitirTexto}>{puedePreguntar ? 'Permitir cámara' : 'Abrir ajustes'}</Text>
      </Pressable>
    </View>
  );
}

function Destello({ r }: { r: ResultadoEscaneo }) {
  const e = estilo(r);
  return (
    <View style={[s.destello, { backgroundColor: e.solido }]}>
      <e.Icono size={38} color="#FFFFFF" strokeWidth={2.6} />
    </View>
  );
}

function TarjetaResultado({ r }: { r: ResultadoEscaneo }) {
  const e = estilo(r);
  const titulo = r.tipo === 'ok' ? r.titulo : TITULO_FRANJA[r.tipo];
  return (
    <View>
      <View style={[s.franja, { backgroundColor: e.solido }]}>
        <View style={s.franjaIzq}>
          <e.Icono size={18} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={s.franjaTexto}>{titulo}</Text>
        </View>
        <Text style={s.franjaHora}>{r.hora}</Text>
      </View>
      <View style={s.cuerpo}>
        <View style={s.avatar}>
          <Text style={s.avatarTexto}>{r.estudiante?.iniciales ?? '?'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.nombre} numberOfLines={2}>{r.estudiante?.nombre_completo ?? r.titulo}</Text>
          <Text style={s.detalle}>{r.tipo === 'ok' ? r.seccion?.descripcion ?? r.detalle : r.detalle}</Text>
          {r.advertencia ? <Text style={[s.detalle, { color: estados.T.chipFg }]}>{r.advertencia}</Text> : null}
          {r.sinConexion && r.tipo === 'ok' ? <Text style={s.offline}>Guardado sin conexión · se enviará luego</Text> : null}
        </View>
      </View>
    </View>
  );
}

function FilaHistorial({ r }: { r: ResultadoEscaneo }) {
  const e = estilo(r);
  const l = lineaHistorial(r);
  return (
    <View style={s.fila} accessible accessibilityLabel={`${l.titulo}. ${l.detalle}. ${r.hora}`}>
      <View style={[s.filaIcono, { backgroundColor: e.bg }]}>
        <e.Icono size={16} color={e.fg} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.filaTitulo} numberOfLines={1}>{l.titulo}</Text>
        <Text style={s.filaDetalle} numberOfLines={1}>{l.detalle}</Text>
      </View>
      <Text style={s.filaHora}>{r.hora}</Text>
    </View>
  );
}

const esquina = 44;
const borde = 5;
const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.inkDeep },
  columna: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  visor: { backgroundColor: colores.scanBg, overflow: 'hidden' },
  lineaH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colores.scanGrid, opacity: 0.6 },
  lineaV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colores.scanGrid, opacity: 0.6 },
  barra: { position: 'absolute', top: 0, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16 },
  redondo: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(11, 20, 39, 0.7)', alignItems: 'center', justifyContent: 'center',
  },
  pildora: {
    flex: 1, height: 44, borderRadius: 999, backgroundColor: 'rgba(11, 20, 39, 0.7)', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12,
  },
  punto: { width: 8, height: 8, borderRadius: 999 },
  pildoraTexto: { fontFamily: fuentes.semi, fontSize: 14, color: colores.textOnInk },
  marco: { position: 'absolute', width: AREA, height: AREA, alignSelf: 'center' },
  esquina: { position: 'absolute', width: esquina, height: esquina, borderColor: colores.scanOk },
  supIzq: { left: 0, top: 0, borderLeftWidth: borde, borderTopWidth: borde, borderTopLeftRadius: 14 },
  supDer: { right: 0, top: 0, borderRightWidth: borde, borderTopWidth: borde, borderTopRightRadius: 14 },
  infIzq: { left: 0, bottom: 0, borderLeftWidth: borde, borderBottomWidth: borde, borderBottomLeftRadius: 14 },
  infDer: { right: 0, bottom: 0, borderRightWidth: borde, borderBottomWidth: borde, borderBottomRightRadius: 14 },
  destello: {
    position: 'absolute', left: AREA / 2 - 38, top: AREA / 2 - 38, width: 76, height: 76, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  indicacion: { position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center', fontFamily: fuentes.regular, fontSize: 14, color: colores.textOnInkMuted },
  sinPermiso: { position: 'absolute', top: 110, left: 32, right: 32, alignItems: 'center', gap: 14 },
  sinPermisoTexto: { fontFamily: fuentes.semi, fontSize: 15, color: colores.textOnInk, textAlign: 'center' },
  permitir: { height: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colores.textOnInk, justifyContent: 'center' },
  permitirTexto: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  tarjeta: { marginTop: -28, marginHorizontal: 12, backgroundColor: colores.surface, borderRadius: 20, overflow: 'hidden' },
  tarjetaVacia: { padding: 16, gap: 4 },
  vacioTitulo: { fontFamily: fuentes.negrita, fontSize: 16, color: colores.ink },
  vacioSub: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  franja: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  franjaIzq: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  franjaTexto: { fontFamily: fuentes.negrita, fontSize: 15, color: '#FFFFFF' },
  franjaHora: { fontFamily: fuentes.titulo, fontSize: 18, color: '#FFFFFF' },
  cuerpo: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 16, backgroundColor: colores.neutralChip, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontFamily: fuentes.titulo, fontSize: 20, color: colores.textMuted },
  nombre: { fontFamily: fuentes.negrita, fontSize: 17, color: colores.ink },
  detalle: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  offline: { fontFamily: fuentes.semi, fontSize: 12, color: estados.T.chipFg },
  manual: { paddingHorizontal: 16, paddingTop: 12 },
  manualInput: {
    height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#2B3A5E', paddingHorizontal: 12,
    color: colores.textOnInk, fontFamily: fuentes.regular, fontSize: 13,
  },
  lista: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 },
  cabLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  h2: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.textOnInk },
  cuenta: { fontFamily: fuentes.regular, fontSize: 13, color: '#A9B0C0' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#162038' },
  filaIcono: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { fontFamily: fuentes.negrita, fontSize: 14, color: colores.textOnInk },
  filaDetalle: { fontFamily: fuentes.regular, fontSize: 12, color: '#A9B0C0' },
  filaHora: { fontFamily: fuentes.semi, fontSize: 13, color: colores.textOnInk },
});

export function cerrarEscaner() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
