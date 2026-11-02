import { colaDeLista, estudiantesDeSeccion, registrosCache } from '@/db/asistencia';

import type { ClaveLista } from './acciones';
import { combinar, contar, type ConteoLista } from './estadoLista';

/**
 * Conteo de una lista calculado en el teléfono. Solo se usa si hay marcas sin
 * enviar; si no, manda lo que dice el servidor.
 */
export async function resumenLocal(clave: ClaveLista): Promise<ConteoLista | null> {
  const cola = await colaDeLista(clave.seccionId, clave.fecha, clave.bloqueId);
  if (cola.length === 0) return null;
  const [estudiantes, cache] = await Promise.all([
    estudiantesDeSeccion(clave.seccionId),
    registrosCache(clave.seccionId, clave.fecha, clave.bloqueId),
  ]);
  if (estudiantes.length === 0) return null;
  return contar(combinar(estudiantes, cache, cola));
}
