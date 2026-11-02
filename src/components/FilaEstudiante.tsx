import { Check, Clock, FileText, X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FilaLista } from '@/lista/estadoLista';
import { alturas, colores, ESTADOS, estados, fuentes, radios, type Estado } from '@/theme/tokens';
import { horaTexto } from '@/utils/fechas';

import { Avatar } from './ui';

const ICONOS = { P: Check, T: Clock, F: X, J: FileText } as const;

interface Props {
  fila: FilaLista;
  editable: boolean;
  onTocar: (fila: FilaLista, estado: Estado) => void;
  onAbrir?: (fila: FilaLista) => void;
  puedeJustificar?: boolean;
}

/** Fila del pase de lista con los 4 botones P · T · F · J (diseño 03). */
export const FilaEstudiante = memo(function FilaEstudiante({ fila, editable, onTocar, onAbrir, puedeJustificar = true }: Props) {
  const hora = fila.estado ? horaTexto(fila.marcado_en) ?? '' : 'Sin marcar';
  return (
    <View style={s.tarjeta}>
      <Pressable
        style={s.cabecera}
        onPress={onAbrir ? () => onAbrir(fila) : undefined}
        disabled={!onAbrir}
        accessibilityRole={onAbrir ? 'button' : undefined}
        accessibilityHint={onAbrir ? 'Ver historial' : undefined}
      >
        <Avatar iniciales={fila.iniciales} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.apellidos} numberOfLines={1}>{fila.apellidos}</Text>
          <Text style={s.nombres} numberOfLines={1}>{fila.nombres}</Text>
        </View>
        <Text style={s.hora}>{hora}</Text>
      </Pressable>
      <View style={s.botones}>
        {ESTADOS.map((e) => {
          const activo = fila.estado === e;
          const habilitado = editable && (e !== 'J' || puedeJustificar || activo);
          const Icono = ICONOS[e];
          const color = activo ? '#FFFFFF' : colores.textOnBtn;
          return (
            <Pressable
              key={e}
              disabled={!habilitado}
              onPress={() => onTocar(fila, e)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo, disabled: !habilitado }}
              accessibilityLabel={`${estados[e].nombre}: ${fila.apellidos}, ${fila.nombres}`}
              hitSlop={2}
              style={({ pressed }) => [
                s.boton,
                activo
                  ? { backgroundColor: estados[e].solido, borderColor: estados[e].solido }
                  : { backgroundColor: colores.bg, borderColor: colores.border },
                pressed && { opacity: 0.8 },
                !habilitado && { opacity: 0.55 },
              ]}
            >
              <Icono size={16} color={color} strokeWidth={e === 'J' ? 2.2 : 2.4} />
              <Text style={[s.botonTexto, { color }]}>{estados[e].corto}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.surface, borderWidth: 1, borderColor: colores.border, borderRadius: 16, padding: 10, gap: 10,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  apellidos: { fontFamily: fuentes.negrita, fontSize: 15, color: colores.ink },
  nombres: { fontFamily: fuentes.regular, fontSize: 13, color: colores.textMuted },
  hora: { fontFamily: fuentes.regular, fontSize: 12, color: colores.textMuted },
  botones: { flexDirection: 'row', gap: 6 },
  boton: {
    flex: 1, height: alturas.estado, borderRadius: radios.estado, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  botonTexto: { fontFamily: fuentes.negrita, fontSize: 13 },
});
