import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colores, estadoSeccion, fuentes, radios } from '@/theme/tokens';
import type { EstadoSeccion } from '@/utils/reglas';

import { BarraProgreso, Chip } from './ui';

export interface DatosTarjeta {
  grado: string;
  letra: string;
  nombre: string;
  subtitulo: string;
  total: number;
  presentes: number;
  tardes: number;
  registrados: number;
  estado: EstadoSeccion;
}

/** Tarjeta de "Mis secciones" (diseño 02). */
export const TarjetaSeccion = memo(function TarjetaSeccion({ d, onPress }: { d: DatosTarjeta; onPress: () => void }) {
  const chip = estadoSeccion[d.estado];
  const faltan = d.total - d.registrados;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${d.nombre}. ${chip.texto}. ${d.presentes} presentes, ${d.tardes} tardes, ${faltan} sin registrar`}
      style={({ pressed }) => [s.tarjeta, pressed && { backgroundColor: '#FAF9F5' }]}
    >
      <View style={s.cabecera}>
        <View style={s.badge}>
          <Text style={s.badgeGrado}>{d.grado}</Text>
          <Text style={s.badgeLetra}>{d.letra}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.nombre}>{d.nombre}</Text>
          <Text style={s.sub}>{d.subtitulo}</Text>
        </View>
        <Chip texto={chip.texto} bg={chip.bg} fg={chip.fg} />
      </View>
      <View style={{ gap: 6 }}>
        <BarraProgreso presentes={d.presentes} tardes={d.tardes} total={d.total} />
        <View style={s.pie}>
          <Text style={s.sub}>
            <Text style={s.fuerte}>{d.presentes}</Text> presentes · {d.tardes} tardes
          </Text>
          <Text style={s.sub}>{faltan <= 0 ? 'Lista completa' : `${faltan} sin registrar`}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.border, borderRadius: radios.tarjeta,
    padding: 16, gap: 12,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: { width: 52, height: 52, borderRadius: 14, backgroundColor: colores.neutralChip, alignItems: 'center', justifyContent: 'center' },
  badgeGrado: { fontFamily: fuentes.titulo, fontSize: 20, color: colores.ink, lineHeight: 22 },
  badgeLetra: { fontFamily: fuentes.negrita, fontSize: 12, color: colores.textMuted, marginTop: 2, lineHeight: 14 },
  nombre: { fontFamily: fuentes.negrita, fontSize: 16, color: colores.ink },
  sub: { fontFamily: fuentes.regular, fontSize: 13, color: colores.textMuted },
  fuerte: { fontFamily: fuentes.negrita, color: colores.ink },
  pie: { flexDirection: 'row', justifyContent: 'space-between' },
});
