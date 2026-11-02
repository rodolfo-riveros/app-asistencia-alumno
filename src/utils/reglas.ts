// Reglas de negocio puras (espejo de backend apps/asistencia/reglas.py).
import type { Estado } from '@/theme/tokens';

import { horaASegundos, segundosDelDia } from './fechas';

export interface ReglaTurno {
  hora_ingreso: string; // '07:45'
  tolerancia_min: number;
  hora_limite_falta: string; // '09:45'
}

/**
 * Regla 1: P hasta ingreso + tolerancia (incluye todo ese minuto), luego T.
 * Con ingreso 7:45 y tolerancia 10 → P hasta 7:55:59, T desde 7:56:00.
 */
export function estadoPorHora(ahora: Date, turno: ReglaTurno): { estado: 'P' | 'T'; fueraDeHora: boolean } {
  const s = segundosDelDia(ahora);
  const tardeDesde = horaASegundos(turno.hora_ingreso) + (turno.tolerancia_min + 1) * 60;
  if (s < tardeDesde) return { estado: 'P', fueraDeHora: false };
  return { estado: 'T', fueraDeHora: s > horaASegundos(turno.hora_limite_falta) };
}

/**
 * Qué estado queda al tocar un botón del pase de lista.
 * - Tocar el botón activo lo desmarca (null).
 * - La primera marca "Presente" se ajusta por la hora (puede quedar T).
 * - Si ya tenía marca, el docente sobrescribe manualmente sin ajuste.
 */
export function estadoAlTocar(
  actual: Estado | null,
  tocado: Estado,
  ahora: Date,
  turno: ReglaTurno | null,
): Estado | null {
  if (actual === tocado) return null;
  if (tocado === 'P' && actual === null && turno) return estadoPorHora(ahora, turno).estado;
  return tocado;
}

export type EstadoSeccion = 'COMPLETA' | 'EN_CURSO' | 'PENDIENTE';

export function estadoSeccion(total: number, registrados: number): EstadoSeccion {
  if (total > 0 && registrados >= total) return 'COMPLETA';
  if (registrados === 0) return 'PENDIENTE';
  return 'EN_CURSO';
}

/** 92.9 → '92,9 %'; 95 → '95 %' */
export function formatearPorcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const texto = (Math.round(valor * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return `${texto.replace('.', ',')} %`;
}
