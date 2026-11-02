// Celdas del calendario mensual L–D del historial (lógica pura).
import type { Estado } from '@/theme/tokens';

export interface DiaHistorial {
  fecha: string;
  dia: number;
  dia_semana: number; // 1 = lunes … 7 = domingo
  habil: boolean;
  estado: Estado | null;
}

export type Celda = { tipo: 'vacia' } | { tipo: 'dia'; dia: number; habil: boolean; estado: Estado | null; fecha: string };

/** Agrega huecos al inicio para que el día 1 caiga en su columna y completa la última semana. */
export function celdasDelMes(dias: DiaHistorial[]): Celda[] {
  if (dias.length === 0) return [];
  const celdas: Celda[] = Array.from({ length: dias[0].dia_semana - 1 }, () => ({ tipo: 'vacia' as const }));
  for (const d of dias) celdas.push({ tipo: 'dia', dia: d.dia, habil: d.habil, estado: d.estado, fecha: d.fecha });
  while (celdas.length % 7 !== 0) celdas.push({ tipo: 'vacia' });
  return celdas;
}
