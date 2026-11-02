import { Platform } from 'react-native';

import { api } from './cliente';
import type { Estado } from '@/theme/tokens';

import type {
  Hoy, Institucion, LoginRespuesta, MarcaLote, Me, Motivo, Nomina, RegistroApi, ResultadoMarca, SeccionResumen, SesionSeccion,
} from './tipos';

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginRespuesta>('/auth/login/', { email: email.trim(), password });
  return data;
}

export async function logout(refresh: string) {
  await api.post('/auth/logout/', { refresh });
}

export async function cambiarPassword(actual: string, nueva: string) {
  await api.post('/auth/cambiar-password/', { actual, nueva });
}

export async function obtenerInstitucion() {
  const { data } = await api.get<Institucion>('/institucion/');
  return data;
}

export async function obtenerMe() {
  const { data } = await api.get<Me>('/me/');
  return data;
}

export async function obtenerHoy() {
  const { data } = await api.get<Hoy>('/movil/hoy/');
  return data;
}

/** Devuelve null si la nómina no cambió (ETag → 304). */
export async function obtenerNomina(version: string | null): Promise<Nomina | null> {
  const r = await api.get<Nomina>('/movil/nomina/', {
    headers: version ? { 'If-None-Match': `"${version}"` } : undefined,
    validateStatus: (s) => s === 200 || s === 304,
  });
  return r.status === 304 ? null : r.data;
}

export async function obtenerSesion(seccionId: number, fecha: string, bloqueId: number | null) {
  const { data } = await api.get<SesionSeccion>(`/secciones/${seccionId}/sesion/`, {
    params: { fecha, ...(bloqueId ? { bloque: bloqueId } : {}) },
  });
  return data;
}

export async function cerrarSesion(seccionId: number, fecha: string, bloqueId: number | null) {
  const { data } = await api.post(`/secciones/${seccionId}/sesion/cerrar/`, { fecha, bloque_id: bloqueId });
  return data;
}

export async function enviarLote(marcas: MarcaLote[]) {
  const { data } = await api.post<{ resultados: ResultadoMarca[] }>('/asistencia/lote/', { marcas });
  return data.resultados;
}

export async function subirJustificacion(registroId: number, motivo: Motivo, detalle: string, fotoUri: string | null) {
  const form = new FormData();
  form.append('motivo', motivo);
  form.append('detalle', detalle);
  if (fotoUri && Platform.OS === 'web') {
    form.append('foto', await (await fetch(fotoUri)).blob(), `constancia-${registroId}.jpg`);
  } else if (fotoUri) {
    // React Native acepta { uri, name, type } como archivo en FormData.
    form.append('foto', { uri: fotoUri, name: `constancia-${registroId}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  }
  const { data } = await api.post<RegistroApi>(`/registros/${registroId}/justificar/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

export async function registrarPushToken(token: string) {
  await api.post('/me/push-token/', { token });
}

export interface RespuestaEscaneo {
  resultado: 'ok' | 'duplicado' | 'invalido' | 'otra_seccion' | 'rechazado';
  mensaje: string;
  detalle?: string;
  codigo?: string;
  estado?: Estado | null;
  registro_id?: number | null;
  hora?: string | null;
  marcado_en?: string | null;
  fecha?: string;
  advertencia?: string | null;
  escaneados_hoy?: number;
  estudiante?: { id: number; matricula_id: number; nombre_completo: string; iniciales: string };
  seccion?: { id: number; nombre_corto: string; descripcion: string };
}

export async function escanear(body: {
  codigo: string;
  modo: 'PUERTA' | 'SECCION';
  seccion_id: number | null;
  marcado_en: string;
  uuid_cliente: string;
  dispositivo_id: string;
}) {
  // Tiempo corto: si la red está lenta, el escaneo se resuelve en el teléfono.
  const { data } = await api.post<RespuestaEscaneo>('/asistencia/escanear/', body, { timeout: 6000 });
  return data;
}

export interface Historial {
  estudiante: { id: number; matricula_id: number; codigo: string; apellidos: string; nombres: string; nombre_completo: string; iniciales: string };
  seccion: SeccionResumen;
  mes: string;
  mes_texto: string;
  mes_anterior: string;
  mes_siguiente: string | null;
  indicadores: {
    porcentaje: number | null;
    porcentaje_texto: string;
    presentes: number;
    tardanzas: number;
    faltas: number;
    justificados: number;
    alerta_riesgo: boolean;
  };
  dias: { fecha: string; dia: number; dia_semana: number; habil: boolean; futuro: boolean; estado: Estado | null }[];
  eventos: {
    registro_id: number;
    estado: Estado;
    estado_original: Estado | null;
    titulo: string;
    fecha: string;
    fecha_texto: string;
    detalle: string;
    editable: boolean;
  }[];
  puede_justificar: boolean;
  puede_llamar: boolean;
  apoderado: { nombre: string; parentesco: string; celular: string } | null;
}

export async function obtenerHistorial(estudianteId: number, mes: string) {
  const { data } = await api.get<Historial>(`/estudiantes/${estudianteId}/historial/`, { params: { mes } });
  return data;
}
