import { create } from 'zustand';

import type { ResultadoEscaneo } from './resolver';

const MAX_HISTORIAL = 30;

interface EstadoEscaner {
  historial: ResultadoEscaneo[];
  /** Último total que informó el servidor + los registrados sin conexión desde entonces. */
  base: number | null;
  extra: number;
  agregar: (r: ResultadoEscaneo, escaneadosHoy: number | null) => void;
}

export const useEscaner = create<EstadoEscaner>((set) => ({
  historial: [],
  base: null,
  extra: 0,
  agregar: (r, escaneadosHoy) =>
    set((s) => ({
      historial: [r, ...s.historial].slice(0, MAX_HISTORIAL),
      base: escaneadosHoy ?? s.base,
      extra: escaneadosHoy !== null ? 0 : s.extra + (r.tipo === 'ok' ? 1 : 0),
    })),
}));

export function totalHoy(s: Pick<EstadoEscaner, 'base' | 'extra' | 'historial'>): number {
  if (s.base === null) return s.historial.filter((r) => r.tipo === 'ok').length;
  return s.base + s.extra;
}
