import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check, FileText, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MOTIVOS, type Motivo } from '@/api/tipos';
import { comprimirFoto, justificar } from '@/lista/acciones';
import { colores, estados, fuentes, radios } from '@/theme/tokens';
import { avisar } from '@/utils/dialogos';
import { fechaISO } from '@/utils/fechas';

const MAX_DETALLE = 300;

/** 04 · Justificar (hoja inferior sobre la lista) */
export default function Justificar() {
  const p = useLocalSearchParams<{ matriculaId: string; seccion: string; fecha?: string; bloque?: string; nombre?: string }>();
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [detalle, setDetalle] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegirFoto(origen: 'camara' | 'galeria') {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      avisar('Permiso necesario', 'Activa el permiso en los ajustes del teléfono para adjuntar la foto.');
      return;
    }
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
    const r = origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setProcesandoFoto(true);
    try {
      setFoto(await comprimirFoto(a.uri, a.width, a.height));
    } catch {
      setFoto(a.uri);
    } finally {
      setProcesandoFoto(false);
    }
  }

  function adjuntar() {
    if (Platform.OS === 'web') {
      void elegirFoto('galeria');
      return;
    }
    Alert.alert('Adjuntar foto', 'Constancia, receta o papeleta', [
      { text: 'Tomar foto', onPress: () => void elegirFoto('camara') },
      { text: 'Elegir de la galería', onPress: () => void elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function guardar() {
    if (!motivo) {
      setError('Elige un motivo.');
      return;
    }
    setGuardando(true);
    try {
      await justificar(
        { seccionId: Number(p.seccion), fecha: p.fecha ?? fechaISO(), bloqueId: p.bloque ? Number(p.bloque) : null },
        { matriculaId: Number(p.matriculaId), motivo, detalle: detalle.trim(), fotoUri: foto },
      );
      router.back();
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
      setGuardando(false);
    }
  }

  return (
    <View style={s.fondo}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={s.hoja} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={s.asa} />
            <View style={s.cabecera}>
              <View style={s.icono}>
                <FileText size={24} color={estados.J.solido} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.titulo} accessibilityRole="header">Justificar inasistencia</Text>
                <Text style={s.nombre}>{p.nombre}</Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={s.label}>Motivo</Text>
              <View style={s.motivos} accessibilityRole="radiogroup">
                {MOTIVOS.map((m) => {
                  const activo = motivo === m.valor;
                  return (
                    <Pressable
                      key={m.valor}
                      onPress={() => {
                        setMotivo(m.valor);
                        setError(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activo }}
                      style={[s.motivo, activo && s.motivoActivo]}
                    >
                      {activo ? <Check size={16} color="#FFFFFF" strokeWidth={2.4} /> : null}
                      <Text style={[s.motivoTexto, activo && { color: '#FFFFFF', fontFamily: fuentes.negrita }]}>{m.texto}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={s.label}>
                Detalle <Text style={{ fontFamily: fuentes.medio, color: colores.textMuted }}>(opcional)</Text>
              </Text>
              <TextInput
                value={detalle}
                onChangeText={(t) => setDetalle(t.slice(0, MAX_DETALLE))}
                multiline
                numberOfLines={3}
                maxLength={MAX_DETALLE}
                accessibilityLabel="Detalle"
                style={s.detalle}
                textAlignVertical="top"
              />
              <Text style={s.contador}>{detalle.length}/{MAX_DETALLE}</Text>
            </View>

            {foto ? (
              <View style={s.foto}>
                <Image source={{ uri: foto }} style={s.miniatura} accessibilityLabel="Foto adjunta" />
                <Text style={[s.fotoTitulo, { flex: 1 }]}>Foto adjunta</Text>
                <Pressable onPress={() => setFoto(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quitar foto">
                  <X size={22} color={colores.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={adjuntar} style={s.adjuntar} accessibilityRole="button" disabled={procesandoFoto}>
                {procesandoFoto ? <ActivityIndicator color={colores.ink} /> : <Camera size={24} color={colores.ink} />}
                <View>
                  <Text style={s.fotoTitulo}>Adjuntar foto del documento</Text>
                  <Text style={s.fotoSub}>Constancia, receta o papeleta</Text>
                </View>
              </Pressable>
            )}

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.botones}>
              <Pressable onPress={() => router.back()} style={[s.boton, s.cancelar]} accessibilityRole="button">
                <Text style={[s.botonTexto, { color: colores.ink }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={guardar}
                disabled={guardando}
                style={[s.boton, { backgroundColor: estados.J.solido }, guardando && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                {guardando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[s.botonTexto, { color: '#FFFFFF' }]}>Guardar</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: colores.overlay },
  hoja: {
    backgroundColor: colores.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%',
    width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  contenido: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  asa: { width: 40, height: 5, borderRadius: 999, backgroundColor: colores.borderInput, alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: { width: 48, height: 48, borderRadius: 14, backgroundColor: estados.J.chipBg, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fuentes.titulo, fontSize: 22, color: colores.ink },
  nombre: { fontFamily: fuentes.regular, fontSize: 14, color: colores.textMuted },
  label: { fontFamily: fuentes.negrita, fontSize: 14, color: colores.ink },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivo: {
    height: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colores.borderInput,
    backgroundColor: colores.surface, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  motivoActivo: { backgroundColor: estados.J.solido, borderColor: estados.J.solido },
  motivoTexto: { fontFamily: fuentes.semi, fontSize: 14, color: colores.ink },
  detalle: {
    minHeight: 84, borderWidth: 1, borderColor: colores.borderInput, borderRadius: radios.input, paddingHorizontal: 14,
    paddingVertical: 12, fontFamily: fuentes.regular, fontSize: 15, color: colores.ink,
  },
  contador: { alignSelf: 'flex-end', fontFamily: fuentes.regular, fontSize: 12, color: colores.textMuted },
  adjuntar: {
    height: 64, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colores.borderDashed,
    backgroundColor: colores.bg, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,
  },
  foto: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: colores.border,
  },
  miniatura: { width: 48, height: 48, borderRadius: 10, backgroundColor: colores.neutralChip },
  fotoTitulo: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  fotoSub: { fontFamily: fuentes.regular, fontSize: 13, color: colores.textMuted },
  error: { fontFamily: fuentes.semi, fontSize: 14, color: estados.F.chipFg },
  botones: { flexDirection: 'row', gap: 10 },
  boton: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelar: { borderWidth: 1, borderColor: colores.borderInput },
  botonTexto: { fontFamily: fuentes.negrita, fontSize: 16 },
});
