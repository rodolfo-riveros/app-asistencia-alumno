import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { esErrorDeRed, mensajeDeError } from '@/api/cliente';
import { obtenerSesion } from '@/api/endpoints';
import type { SesionSeccion, Turno } from '@/api/tipos';
import {
  colaDeLista, estudiantesDeSeccion, guardarSesionServidor, metaNomina, registrosCache, type MetaNomina,
} from '@/db/asistencia';
import { notificarCambio, useSync } from '@/store/sync';
import type { MarcaCola } from '@/sync/tipos';

import type { ClaveLista } from './acciones';
import { combinar, contar, type EstudianteLista, type RegistroCache } from './estadoLista';

interface Local {
  estudiantes: EstudianteLista[];
  cache: RegistroCache[];
  cola: MarcaCola[];
  meta: MetaNomina | null;
}

export function useLista({ seccionId, fecha, bloqueId }: ClaveLista) {
  const version = useSync((s) => s.version);
  const [local, setLocal] = useState<Local | null>(null);

  // Lo guardado en el teléfono (se recarga con cada cambio).
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const [estudiantes, cache, cola, meta] = await Promise.all([
        estudiantesDeSeccion(seccionId),
        registrosCache(seccionId, fecha, bloqueId),
        colaDeLista(seccionId, fecha, bloqueId),
        metaNomina(),
      ]);
      if (vigente) setLocal({ estudiantes, cache, cola, meta });
    })();
    return () => {
      vigente = false;
    };
  }, [seccionId, fecha, bloqueId, version]);

  // Lo que dice el servidor (si hay conexión). Se guarda en el teléfono para usarlo sin red.
  const consulta = useQuery({
    queryKey: ['sesion', seccionId, fecha, bloqueId],
    queryFn: async (): Promise<SesionSeccion | null> => {
      try {
        const s = await obtenerSesion(seccionId, fecha, bloqueId);
        await guardarSesionServidor(s, bloqueId);
        notificarCambio({ online: true });
        return s;
      } catch (e) {
        if (esErrorDeRed(e)) {
          notificarCambio({ online: false });
          return null;
        }
        throw e;
      }
    },
  });
  const servidor = consulta.data ?? null;
  const error = consulta.error ? mensajeDeError(consulta.error) : null;

  const filas = useMemo(
    () => (local ? combinar(local.estudiantes, local.cache, local.cola) : []),
    [local],
  );
  const conteo = useMemo(() => contar(filas), [filas]);

  const seccionMeta = local?.meta?.secciones.find((s) => s.id === seccionId) ?? null;
  const turno: Turno | null =
    servidor?.turno ?? local?.meta?.turnos.find((t) => t.id === seccionMeta?.turno_id) ?? null;

  return {
    filas,
    conteo,
    turno,
    nombreSeccion: servidor?.seccion.nombre ?? seccionMeta?.nombre ?? 'Sección',
    // Sin respuesta del servidor asumimos editable: el servidor valida al recibir.
    editable: servidor ? servidor.editable : seccionMeta?.puede_marcar ?? true,
    esDiaLectivo: servidor?.es_dia_lectivo ?? true,
    sesionCerrada: servidor?.sesion?.estado === 'CERRADA',
    hayDatosLocales: (local?.estudiantes.length ?? 0) > 0,
    cargando: consulta.isLoading && !local?.estudiantes.length,
    error,
    refrescar: consulta.refetch,
  };
}
