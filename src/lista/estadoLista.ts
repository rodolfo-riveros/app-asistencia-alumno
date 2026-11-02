// Estado que se muestra en el pase de lista: lo último que confirmó el servidor
// (caché) más las marcas locales que aún no se envían (cola). Lógica pura.
import type { MarcaCola } from '@/sync/tipos';
import type { Estado } from '@/theme/tokens';
import { coincide } from '@/utils/texto';

export interface EstudianteLista {
  matricula_id: number;
  estudiante_id: number;
  apellidos: string;
  nombres: string;
  iniciales: string;
}

export interface RegistroCache {
  matricula_id: number;
  estado: Estado;
  estado_original: Estado | null;
  registro_id: number | null;
  marcado_en: string | null;
}

export interface FilaLista extends EstudianteLista {
  estado: Estado | null;
  marcado_en: string | null;
  registro_id: number | null;
  pendiente: boolean; // tiene marcas sin enviar
}

export interface ConteoLista {
  p: number;
  t: number;
  f: number;
  j: number;
  sinMarcar: number;
  total: number;
}

export function combinar(
  estudiantes: EstudianteLista[],
  cache: RegistroCache[],
  cola: MarcaCola[],
): FilaLista[] {
  const porMatricula = new Map(cache.map((r) => [r.matricula_id, r]));
  const ultimaLocal = new Map<number, MarcaCola>();
  for (const m of [...cola].sort((a, b) => a.marcado_en.localeCompare(b.marcado_en))) {
    ultimaLocal.set(m.matricula_id, m);
  }
  return estudiantes.map((e) => {
    const local = ultimaLocal.get(e.matricula_id);
    const servidor = porMatricula.get(e.matricula_id);
    if (local) {
      return {
        ...e,
        estado: local.estado,
        marcado_en: local.estado ? local.marcado_en : null,
        registro_id: servidor?.registro_id ?? null,
        pendiente: true,
      };
    }
    return {
      ...e,
      estado: servidor?.estado ?? null,
      marcado_en: servidor?.marcado_en ?? null,
      registro_id: servidor?.registro_id ?? null,
      pendiente: false,
    };
  });
}

export function contar(filas: { estado: Estado | null }[]): ConteoLista {
  const c: ConteoLista = { p: 0, t: 0, f: 0, j: 0, sinMarcar: 0, total: filas.length };
  for (const f of filas) {
    if (f.estado === 'P') c.p++;
    else if (f.estado === 'T') c.t++;
    else if (f.estado === 'F') c.f++;
    else if (f.estado === 'J') c.j++;
    else c.sinMarcar++;
  }
  return c;
}

export function filtrar<T extends EstudianteLista>(filas: T[], busqueda: string): T[] {
  if (!busqueda.trim()) return filas;
  return filas.filter((f) => coincide(`${f.apellidos} ${f.nombres}`, busqueda));
}

export function textoPendientes(sinMarcar: number): string {
  return sinMarcar === 0 ? 'Todos registrados' : `${sinMarcar} sin marcar`;
}
