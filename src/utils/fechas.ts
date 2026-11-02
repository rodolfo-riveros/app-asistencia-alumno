// Fechas en hora de Lima. Perú no usa horario de verano: UTC−5 fijo, así que
// no dependemos de Intl/timeZone (que varía entre motores JS).

const OFFSET_LIMA_MS = -5 * 60 * 60 * 1000;

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface PartesLima {
  anio: number;
  mes: number; // 1–12
  dia: number;
  diaSemana: number; // 0 = domingo
  hora: number;
  minuto: number;
  segundo: number;
}

export function partesLima(fecha: Date = new Date()): PartesLima {
  const d = new Date(fecha.getTime() + OFFSET_LIMA_MS);
  return {
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    diaSemana: d.getUTCDay(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
    segundo: d.getUTCSeconds(),
  };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' de hoy (o de la fecha dada) en Lima. */
export function fechaISO(fecha: Date = new Date()): string {
  const p = partesLima(fecha);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

function desdeISO(iso: string): PartesLima {
  const [a, m, d] = iso.split('-').map(Number);
  // Mediodía en Lima para evitar saltos de día.
  return partesLima(new Date(Date.UTC(a, m - 1, d, 17)));
}

/** 'Martes, 6 de octubre' */
export function fechaLarga(iso: string): string {
  const p = desdeISO(iso);
  return `${DIAS[p.diaSemana]}, ${p.dia} de ${MESES[p.mes - 1]}`;
}

/** 'Martes 6 oct' (cabecera del pase de lista) */
export function fechaCabecera(iso: string): string {
  const p = desdeISO(iso);
  return `${DIAS[p.diaSemana]} ${p.dia} ${MESES_CORTOS[p.mes - 1]}`;
}

/** 'Jue 17 sep' */
export function fechaCorta(iso: string): string {
  const p = desdeISO(iso);
  return `${DIAS_CORTOS[p.diaSemana]} ${p.dia} ${MESES_CORTOS[p.mes - 1]}`;
}

/** '7:52' en Lima a partir de un instante ISO. */
export function horaTexto(instante: string | Date | null | undefined): string | null {
  if (!instante) return null;
  const fecha = typeof instante === 'string' ? new Date(instante) : instante;
  if (Number.isNaN(fecha.getTime())) return null;
  const p = partesLima(fecha);
  return `${p.hora}:${dos(p.minuto)}`;
}

/** Segundos desde medianoche en Lima. */
export function segundosDelDia(fecha: Date = new Date()): number {
  const p = partesLima(fecha);
  return p.hora * 3600 + p.minuto * 60 + p.segundo;
}

/** '07:45' o '07:45:00' → segundos desde medianoche. */
export function horaASegundos(hhmm: string): number {
  const [h, m, s] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}
