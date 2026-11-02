// Permisos que el rol del usuario trae del servidor. Los roles se configuran en el
// panel (Usuarios y roles); la app solo pregunta "¿puede?".
import type { Usuario } from '@/api/tipos';

export type Permiso =
  | 'app.acceso'
  | 'asistencia.pasar_lista'
  | 'asistencia.escanear_puerta'
  | 'asistencia.todas_las_secciones'
  | 'asistencia.justificar'
  | 'asistencia.editar_fechas_pasadas'
  | 'estudiantes.ver_historial'
  | 'estudiantes.ver_apoderado';

export function puede(usuario: Pick<Usuario, 'permisos'> | null | undefined, permiso: Permiso): boolean {
  return !!usuario?.permisos?.includes(permiso);
}

/** Pasa lista en la app (sus secciones o todas). */
export function pasaLista(usuario: Pick<Usuario, 'permisos'> | null | undefined): boolean {
  return puede(usuario, 'asistencia.pasar_lista') || puede(usuario, 'asistencia.todas_las_secciones');
}

/** Puede abrir el escáner (modo puerta o desde su lista). */
export function escanea(usuario: Pick<Usuario, 'permisos'> | null | undefined): boolean {
  return puede(usuario, 'asistencia.escanear_puerta') || pasaLista(usuario);
}
