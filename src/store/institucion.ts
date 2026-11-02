import { useQuery } from '@tanstack/react-query';

import { obtenerInstitucion } from '@/api/endpoints';
import type { Institucion } from '@/api/tipos';
import { kvGuardar, kvLeer } from '@/db';

const VACIA: Institucion = {
  nombre: '', codigo_modular: '', logo_url: null, anio_escolar: null, zona_horaria: 'America/Lima',
};

/** Nombre, logo y portada de la I.E. (configurados en el panel). Sin red usa lo último guardado. */
export function useInstitucion() {
  return useQuery({
    queryKey: ['institucion'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Institucion> => {
      try {
        const i = await obtenerInstitucion();
        await kvGuardar('institucion', i);
        return i;
      } catch {
        return (await kvLeer<Institucion>('institucion'))?.valor ?? VACIA;
      }
    },
  });
}
