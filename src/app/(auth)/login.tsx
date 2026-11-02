import { ArrowRight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInputInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mensajeDeError } from '@/api/cliente';
import { ANCHOS, Contenedor, useDisposicion } from '@/components/Contenedor';
import { LogoInstitucion } from '@/components/LogoInstitucion';
import { Boton, Campo, Etiqueta } from '@/components/ui';
import { useInstitucion } from '@/store/institucion';
import { useSesion } from '@/store/sesion';
import { colores, fuentes } from '@/theme/tokens';
import { avisar } from '@/utils/dialogos';

/** 01 · Iniciar sesión */
export default function Login() {
  const entrar = useSesion((s) => s.entrar);
  const expirada = useSesion((s) => s.expirada);
  const { data: inst } = useInstitucion();
  const { esTablet, alto } = useDisposicion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<{ email?: string; password?: string; general?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const refPassword = useRef<TextInputInstance>(null);

  async function enviar() {
    const nuevos: typeof errores = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nuevos.email = 'Escribe un correo válido.';
    if (!password) nuevos.password = 'Escribe tu contraseña.';
    setErrores(nuevos);
    if (nuevos.email || nuevos.password) return;
    setEnviando(true);
    try {
      await entrar(email, password);
    } catch (e) {
      setErrores({ general: mensajeDeError(e) });
    } finally {
      setEnviando(false);
    }
  }

  const portada = inst?.portada_url;
  return (
    <SafeAreaView style={s.pantalla} edges={portada && !esTablet ? ['bottom'] : ['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.scroll, esTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
          {portada ? (
            <Image
              source={{ uri: portada }}
              style={[s.portada, { height: Math.min(220, alto * 0.24) }, esTablet && s.portadaTablet]}
              resizeMode="cover"
              accessibilityLabel={inst?.nombre}
            />
          ) : null}
          <Contenedor maximo={esTablet ? ANCHOS.texto + 64 : ANCHOS.texto} style={[s.contenido, esTablet && s.tarjetaTablet]}>
            <View style={{ gap: 20 }}>
              <LogoInstitucion url={inst?.logo_url} />
              <View style={{ gap: 6 }}>
                {inst?.nombre ? <Etiqueta>{inst.nombre}</Etiqueta> : null}
                <Text style={s.h1} accessibilityRole="header">Control de asistencia</Text>
                <Text style={s.sub}>Ingresa con tu cuenta institucional para tomar asistencia de tus secciones.</Text>
              </View>
            </View>

            <View style={s.form}>
              {expirada ? <Text style={s.error}>Tu sesión expiró. Vuelve a ingresar; tus marcas guardadas se conservan.</Text> : null}
              <Campo
                etiqueta="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => refPassword.current?.focus()}
                error={errores.email}
              />
              <Campo
                ref={refPassword}
                etiqueta="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={enviar}
                error={errores.password}
                accesorio={
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    onPress={() => avisar('¿Olvidaste tu contraseña?', 'Pide a dirección que restablezca tu contraseña.')}
                  >
                    <Text style={s.enlace}>¿La olvidaste?</Text>
                  </Pressable>
                }
              />
              {errores.general ? <Text style={s.error} accessibilityLiveRegion="polite">{errores.general}</Text> : null}
              <Boton
                texto="Ingresar"
                onPress={enviar}
                cargando={enviando}
                icono={<ArrowRight size={20} color="#FFFFFF" />}
                style={{ marginTop: 8 }}
              />
            </View>
          </Contenedor>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.bg },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  scrollTablet: { justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  portada: { width: '100%' },
  portadaTablet: { maxWidth: ANCHOS.texto + 64, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  contenido: { paddingTop: 48, paddingHorizontal: 28 },
  tarjetaTablet: {
    backgroundColor: colores.surface, borderRadius: 24, borderWidth: 1, borderColor: colores.border,
    paddingVertical: 36, paddingHorizontal: 32,
  },
  h1: { fontFamily: fuentes.titulo, fontSize: 36, lineHeight: 38, letterSpacing: -0.72, color: colores.ink },
  sub: { fontFamily: fuentes.regular, fontSize: 16, lineHeight: 24, color: colores.textMuted },
  form: { gap: 18, marginTop: 40 },
  enlace: { fontFamily: fuentes.semi, fontSize: 14, color: colores.ink },
  error: { fontFamily: fuentes.semi, fontSize: 14, color: '#9A1F15' },
});
