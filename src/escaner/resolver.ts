// Decide qué pasa con un QR escaneado sin preguntar al servidor (modo offline).
// Es la misma regla que backend apps/asistencia/servicios.escanear. Lógica pura.
import type { Estado } from '@/theme/tokens';
import { horaTexto } from '@/utils/fechas';
import { estadoPorHora, type ReglaTurno } from '@/utils/reglas';

export const PREFIJO_QR = 'AE1.';

export type TipoResultado = 'ok' | 'duplicado' | 'invalido' | 'otra_seccion' | 'rechazado';

export interface ResultadoEscaneo {
  id: string;
  tipo: TipoResultado;
  estado: Estado | null; // estado registrado (ok) o el que ya tenía (duplicado)
  titulo: string; // 'Presente registrado', 'Código no válido', nombre del alumno…
  detalle: string; // '3.º grado · Sección B · Primaria', 'Ya registrado a las 7:41'…
  hora: string; // hora del escaneo
  estudiante: { matricula_id: number; estudiante_id: number; nombre_completo: string; iniciales: string } | null;
  seccion: { id: number; nombre_corto: string; descripcion: string } | null;
  advertencia: string | null;
  sinConexion: boolean;
}

/** 'AE1.<token>' → token; cualquier otra cosa → null. */
export function leerCodigo(texto: string): string | null {
  const t = (texto ?? '').trim();
  if (!t.startsWith(PREFIJO_QR)) return null;
  const token = t.slice(PREFIJO_QR.length);
  return token.length >= 16 && token.length <= 64 && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

export interface EstudianteLocal {
  matricula_id: number;
  estudiante_id: number;
  seccion_id: number;
  apellidos: string;
  nombres: string;
  iniciales: string;
}

export interface SeccionLocal {
  id: number;
  nombre: string; // '3.º grado · Sección B'
  nombre_corto: string; // '3.º B'
  descripcion: string; // '3.º grado · Sección B · Primaria'
  puede_escanear: boolean;
  turno: ReglaTurno | null;
}

export interface Contexto {
  modo: 'PUERTA' | 'SECCION';
  seccionDestinoId: number | null;
  estudiante: EstudianteLocal | null; // buscado por sha256(token) en la nómina
  seccion: SeccionLocal | null; // la del estudiante
  marcaActual: { estado: Estado; marcado_en: string | null } | null; // hoy, en su sección
  ahora: Date;
  id: string;
}

export interface Decision {
  resultado: ResultadoEscaneo;
  /** Si hay que registrar: la marca a encolar. */
  registrar: { matricula_id: number; seccion_id: number; estado: 'P' | 'T' } | null;
}

export function invalido(id: string, ahora: Date, detalle = 'Carnet dado de baja o inexistente'): ResultadoEscaneo {
  return {
    id, tipo: 'invalido', estado: null, titulo: 'Código no válido', detalle, hora: horaTexto(ahora) ?? '',
    estudiante: null, seccion: null, advertencia: null, sinConexion: false,
  };
}

export function resolverLocal(c: Contexto): Decision {
  const hora = horaTexto(c.ahora) ?? '';
  if (!c.estudiante || !c.seccion) return { resultado: { ...invalido(c.id, c.ahora), sinConexion: true }, registrar: null };

  const e = c.estudiante;
  const s = c.seccion;
  const base = {
    id: c.id,
    hora,
    estudiante: {
      matricula_id: e.matricula_id,
      estudiante_id: e.estudiante_id,
      nombre_completo: `${e.apellidos}, ${e.nombres}`,
      iniciales: e.iniciales,
    },
    seccion: { id: s.id, nombre_corto: s.nombre_corto, descripcion: s.descripcion },
    advertencia: null,
    sinConexion: true,
  };

  const deOtraSeccion = c.modo === 'SECCION' ? s.id !== c.seccionDestinoId : !s.puede_escanear;
  if (deOtraSeccion) {
    return {
      resultado: {
        ...base, tipo: 'otra_seccion', estado: null, titulo: base.estudiante.nombre_completo,
        detalle: c.modo === 'SECCION'
          ? `Pertenece a ${s.nombre_corto} — no se registró`
          : `Pertenece a ${s.nombre_corto} — no está entre tus secciones`,
      },
      registrar: null,
    };
  }

  // Regla 2: una marca por estudiante y día. Re-escaneo = duplicado.
  if (c.marcaActual) {
    const h = horaTexto(c.marcaActual.marcado_en);
    return {
      resultado: {
        ...base, tipo: 'duplicado', estado: c.marcaActual.estado, titulo: base.estudiante.nombre_completo,
        detalle: h ? `Ya registrado a las ${h}` : 'Ya registrado hoy',
      },
      registrar: null,
    };
  }

  const calculado = s.turno ? estadoPorHora(c.ahora, s.turno) : { estado: 'P' as const, fueraDeHora: false };
  return {
    resultado: {
      ...base,
      tipo: 'ok',
      estado: calculado.estado,
      titulo: calculado.estado === 'P' ? 'Presente registrado' : 'Tarde registrada',
      detalle: s.descripcion,
      advertencia: calculado.fueraDeHora ? 'Pasó la hora límite: revisa si corresponde falta.' : null,
    },
    registrar: { matricula_id: e.matricula_id, seccion_id: s.id, estado: calculado.estado },
  };
}

/** Texto corto para la lista "Últimos escaneados". */
export function lineaHistorial(r: ResultadoEscaneo): { titulo: string; detalle: string } {
  if (r.tipo === 'invalido' || r.tipo === 'rechazado') return { titulo: r.titulo, detalle: r.detalle };
  const nombre = r.estudiante?.nombre_completo ?? r.titulo;
  if (r.tipo === 'ok') {
    return { titulo: nombre, detalle: `${r.seccion?.nombre_corto ?? ''} · ${r.estado === 'T' ? 'Tarde' : 'Presente'}` };
  }
  return { titulo: nombre, detalle: r.detalle };
}
