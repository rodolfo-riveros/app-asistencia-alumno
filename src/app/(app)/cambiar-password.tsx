import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mensajeDeError } from '@/api/cliente';
import { cambiarPassword } from '@/api/endpoints';
import { ANCHOS, centrado } from '@/components/Contenedor';
import { Boton, Campo } from '@/components/ui';
import { useSesion } from '@/store/sesion';
import { colores, fuentes } from '@/theme/tokens';
import { avisar } from '@/utils/dialogos';

export default function CambiarPassword() {
  const usuario = useSesion((s) => s.usuario);
  const actualizarUsuario = useSesion((s) => s.actualizarUsuario);
  const salir = useSesion((s) => s.salir);
  const obligatorio = !!usuario?.debe_cambiar_password;
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.');
    if (nueva !== repetir) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    setError(null);
    try {
      await cambiarPassword(actual, nueva);
      if (usuario) await actualizarUsuario({ ...usuario, debe_cambiar_password: false });
      avisar('Contraseña actualizada');
      router.replace('/');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.contenido, centrado(ANCHOS.texto)]} keyboardShouldPersistTaps="handled">
          {!obligatorio ? (
            <Pressable onPress={() => router.back()} style={s.volver} accessibilityRole="button" accessibilityLabel="Volver">
              <ChevronLeft size={24} color={colores.ink} />
            </Pressable>
          ) : null}
          <View style={{ gap: 6 }}>
            <Text style={s.h1} accessibilityRole="header">{obligatorio ? 'Crea tu contraseña' : 'Cambiar contraseña'}</Text>
            <Text style={s.sub}>
              {obligatorio
                ? 'Dirección te dio una contraseña temporal. Elige una nueva para continuar.'
                : 'Usa al menos 8 caracteres, no solo números.'}
            </Text>
          </View>
          <Campo etiqueta={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'} value={actual} onChangeText={setActual} secureTextEntry autoComplete="current-password" />
          <Campo etiqueta="Nueva contraseña" value={nueva} onChangeText={setNueva} secureTextEntry autoComplete="new-password" />
          <Campo etiqueta="Repite la nueva contraseña" value={repetir} onChangeText={setRepetir} secureTextEntry autoComplete="new-password" />
          {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Boton texto="Guardar contraseña" onPress={guardar} cargando={enviando} />
          {obligatorio ? (
            <Pressable onPress={() => void salir()} style={{ alignSelf: 'center', padding: 12 }} accessibilityRole="button">
              <Text style={s.enlace}>Cerrar sesión</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  contenido: { padding: 28, gap: 18 },
  volver: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fuentes.titulo, fontSize: 30, letterSpacing: -0.6, color: colores.ink },
  sub: { fontFamily: fuentes.regular, fontSize: 16, lineHeight: 23, color: colores.textMuted },
  error: { fontFamily: fuentes.semi, fontSize: 14, color: '#9A1F15' },
  enlace: { fontFamily: fuentes.semi, fontSize: 15, color: colores.textMuted, textDecorationLine: 'underline' },
});
