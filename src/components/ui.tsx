// Componentes básicos con los tokens del diseño.
import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';

import { alturas, colores, estados, fuentes, radios, type Estado } from '@/theme/tokens';

// ---------------------------------------------------------------- texto
export function T({ style, children, ...rest }: { style?: StyleProp<TextStyle>; children?: ReactNode; numberOfLines?: number }) {
  return (
    <Text style={[s.base, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Titulo({ style, children }: { style?: StyleProp<TextStyle>; children?: ReactNode }) {
  return <Text style={[s.titulo, style]} accessibilityRole="header">{children}</Text>;
}

/** Etiqueta de contexto: 13 px, 600, mayúsculas. */
export function Etiqueta({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.etiqueta, style]}>{children}</Text>;
}

// ---------------------------------------------------------------- botones
interface BotonProps extends Omit<PressableProps, 'style' | 'children'> {
  texto: string;
  variante?: 'primario' | 'secundario' | 'azul';
  cargando?: boolean;
  icono?: ReactNode;
  style?: StyleProp<ViewStyle>;
  alto?: number;
}

export function Boton({ texto, variante = 'primario', cargando, icono, style, alto = alturas.boton, disabled, ...rest }: BotonProps) {
  const fondo = variante === 'primario' ? colores.ink : variante === 'azul' ? estados.J.solido : colores.surface;
  const color = variante === 'secundario' ? colores.ink : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!cargando, busy: !!cargando }}
      disabled={disabled || cargando}
      style={({ pressed }) => [
        s.boton,
        { height: alto, backgroundColor: fondo },
        variante === 'secundario' && s.botonSecundario,
        pressed && { opacity: 0.85 },
        (disabled || cargando) && { opacity: 0.6 },
        style,
      ]}
      {...rest}
    >
      {cargando ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          <Text style={[s.botonTexto, { color }]}>{texto}</Text>
          {icono}
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------- campos
interface CampoProps extends TextInputProps {
  etiqueta: string;
  error?: string | null;
  accesorio?: ReactNode; // a la derecha de la etiqueta (ej. "¿La olvidaste?")
}

export const Campo = forwardRef<TextInputInstance, CampoProps>(function Campo({ etiqueta, error, accesorio, style, ...rest }, ref) {
  return (
    <View style={{ gap: 8 }}>
      <View style={s.filaEtiqueta}>
        <Text style={s.label}>{etiqueta}</Text>
        {accesorio}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={etiqueta}
        placeholderTextColor={colores.disabled}
        style={[s.input, error ? { borderColor: estados.F.solido } : null, style]}
        {...rest}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
});

// ---------------------------------------------------------------- chips y avatar
export function ChipEstado({ estado, texto }: { estado: Estado; texto?: string }) {
  const e = estados[estado];
  return (
    <View style={[s.chip, { backgroundColor: e.chipBg }]}>
      <View style={[s.punto, { backgroundColor: e.punto }]} />
      <Text style={[s.chipTexto, { color: e.chipFg }]}>{texto ?? e.nombre}</Text>
    </View>
  );
}

export function Chip({ texto, bg, fg }: { texto: string; bg: string; fg: string }) {
  return (
    <View style={[s.chipPill, { backgroundColor: bg }]}>
      <Text style={[s.chipPillTexto, { color: fg }]}>{texto}</Text>
    </View>
  );
}

export function Avatar({ iniciales, tam = 38, oscuro }: { iniciales: string; tam?: number; oscuro?: boolean }) {
  return (
    <View
      style={[
        s.avatar,
        { width: tam, height: tam, backgroundColor: oscuro ? colores.ink : colores.neutralChip },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[s.avatarTexto, { color: oscuro ? colores.textOnInk : colores.textMuted, fontSize: tam > 40 ? 15 : 13 }]}>
        {iniciales}
      </Text>
    </View>
  );
}

/** Barra apilada: verde = presentes, ámbar = tardes. */
export function BarraProgreso({ presentes, tardes, total }: { presentes: number; tardes: number; total: number }) {
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%') as `${number}%`;
  return (
    <View style={s.barra}>
      <View style={{ width: pct(presentes), backgroundColor: estados.P.solido }} />
      <View style={{ width: pct(tardes), backgroundColor: estados.T.punto }} />
    </View>
  );
}

const s = StyleSheet.create({
  base: { fontFamily: fuentes.regular, fontSize: 16, color: colores.ink },
  titulo: { fontFamily: fuentes.titulo, fontSize: 28, letterSpacing: -0.56, color: colores.ink },
  etiqueta: {
    fontFamily: fuentes.semi, fontSize: 13, letterSpacing: 1.04, textTransform: 'uppercase', color: colores.textSubtle,
  },
  boton: {
    borderRadius: radios.boton, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 18,
  },
  botonSecundario: { borderWidth: 1, borderColor: colores.borderInput },
  botonTexto: { fontFamily: fuentes.semi, fontSize: 17 },
  filaEtiqueta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fuentes.semi, fontSize: 14, color: colores.ink },
  input: {
    height: alturas.input, borderWidth: 1, borderColor: colores.borderInput, borderRadius: radios.input,
    paddingHorizontal: 16, fontFamily: fuentes.regular, fontSize: 16, color: colores.ink, backgroundColor: colores.surface,
  },
  error: { fontFamily: fuentes.semi, fontSize: 13, color: estados.F.chipFg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 999 },
  punto: { width: 8, height: 8, borderRadius: 999 },
  chipTexto: { fontFamily: fuentes.semi, fontSize: 13 },
  chipPill: { height: 26, paddingHorizontal: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipPillTexto: { fontFamily: fuentes.negrita, fontSize: 12 },
  avatar: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontFamily: fuentes.negrita },
  barra: { height: 8, borderRadius: 999, backgroundColor: colores.neutralChip, overflow: 'hidden', flexDirection: 'row' },
});
