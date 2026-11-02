// Tipos de la API del backend Django (/api/v1/). Ver README del backend.
import type { Estado } from '@/theme/tokens';

/** Código del rol (los roles se crean en el panel: no es una lista fija). */
export type Rol = string;

export interface Usuario {
  id: number;
  email: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  nombre_corto: string;
  iniciales: string;
  rol: Rol;
  rol_texto: string;
  /** Lo que el rol permite (ver apps/cuentas/permisos.py del backend). */
  permisos?: string[];
  celular: string;
  debe_cambiar_password: boolean;
}

export interface Turno {
  id: number;
  nombre: 'MANANA' | 'TARDE';
  nombre_texto: string;
  hora_ingreso: string;
  hora_ingreso_texto: string;
  tolerancia_min: number;
  tarde_desde: string;
  tarde_desde_texto: string;
  hora_limite_falta: string;
}

export interface Institucion {
  nombre: string;
  nombre_corto?: string;
  codigo_modular: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  logo_url: string | null;
  portada_url?: string | null;
  anio_escolar: number | null;
  zona_horaria: string;
}

export interface SeccionResumen {
  id: number;
  grado: string;
  letra: string;
  nombre_corto: string;
  nombre: string;
  nivel: string;
  turno: string;
  descripcion: string;
}

export interface Me {
  usuario: Usuario;
  institucion: Institucion;
  configuracion: { modo_asistencia: string; umbral_faltas: number; umbral_tardanzas: number };
  turnos: Turno[];
  secciones: (SeccionResumen & { es_tutor: boolean })[];
}

export interface LoginRespuesta {
  access: string;
  refresh: string;
  usuario: Usuario;
}

export interface Contadores {
  total: number;
  presentes: number;
  tardes: number;
  faltas: number;
  justificados: number;
  registrados: number;
  sin_registrar: number;
  estado: 'COMPLETA' | 'EN_CURSO' | 'PENDIENTE';
  estado_texto: string;
  sesion_id: number | null;
  sesion_cerrada: boolean;
}

export interface Tarjeta extends Contadores {
  tipo: 'DIARIA' | 'BLOQUE';
  seccion_id: number;
  bloque_id: number | null;
  grado: string;
  letra: string;
  nombre: string;
  subtitulo: string;
  curso: string | null;
  horario: string | null;
}

export interface Hoy {
  fecha: string;
  fecha_texto: string;
  hora_servidor: string;
  es_dia_lectivo: boolean;
  motivo_no_lectivo: string | null;
  turno: Turno | null;
  tarjetas: Tarjeta[];
  escaneados_hoy?: number;
}

export interface EstudianteNomina {
  matricula_id: number;
  estudiante_id: number;
  codigo: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  iniciales: string;
  carnet_hash: string | null;
}

export interface SeccionNomina extends SeccionResumen {
  turno_id: number;
  es_tutor: boolean;
  puede_marcar: boolean;
  puede_escanear: boolean;
  estudiantes: EstudianteNomina[];
}

export interface Nomina {
  version: string;
  generado_en: string;
  turnos: Turno[];
  secciones: SeccionNomina[];
}

export interface Justificacion {
  motivo: Motivo;
  motivo_texto: string;
  detalle: string;
  tiene_foto: boolean;
}

export interface RegistroApi {
  id: number;
  estado: Estado;
  estado_original: Estado | null;
  metodo: 'QR' | 'MANUAL' | 'AUTO';
  marcado_en: string;
  hora: string | null;
  hora_corregida: boolean;
  justificacion: Justificacion | null;
}

export interface SesionSeccion {
  seccion: SeccionResumen;
  bloque: { id: number; curso: string } | null;
  fecha: string;
  fecha_texto: string;
  es_dia_lectivo: boolean;
  sesion: { id: number; estado: 'ABIERTA' | 'CERRADA'; cerrada_en: string | null } | null;
  editable: boolean;
  turno: Turno;
  contadores: Contadores;
  estudiantes: {
    matricula_id: number;
    estudiante_id: number;
    apellidos: string;
    nombres: string;
    iniciales: string;
    registro: RegistroApi | null;
  }[];
}

export type Motivo = 'SALUD' | 'FAMILIAR' | 'TRAMITE' | 'OTRO';

export const MOTIVOS: { valor: Motivo; texto: string }[] = [
  { valor: 'SALUD', texto: 'Salud' },
  { valor: 'FAMILIAR', texto: 'Motivo familiar' },
  { valor: 'TRAMITE', texto: 'Trámite' },
  { valor: 'OTRO', texto: 'Otro' },
];

export interface MarcaLote {
  uuid_cliente: string;
  matricula_id: number;
  seccion_id: number;
  fecha: string;
  bloque_id: number | null;
  estado: Estado | null;
  metodo: 'MANUAL' | 'QR';
  marcado_en: string;
  dispositivo_id?: string;
  justificacion?: { motivo: Motivo; detalle: string } | null;
}

export interface ResultadoMarca {
  uuid_cliente: string;
  resultado: 'aplicada' | 'duplicada' | 'rechazada';
  codigo: string | null;
  detalle: string | null;
  registro_id: number | null;
  estado_final: Estado | null;
  marcado_en: string | null;
}

export interface ErrorApi {
  detalle: string;
  codigo: string;
  campos?: Record<string, string[]>;
}
