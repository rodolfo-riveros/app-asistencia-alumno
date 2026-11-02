// Motor de sincronización (sección 8 de la especificación). No depende de
// SQLite ni de axios: recibe el repositorio y la API, así se prueba con Jest.
import type { MarcaLote } from '@/api/tipos';

import type { ApiSync, MarcaCola, RepoSync, ResumenSync } from './tipos';

export const TAMANO_LOTE = 200;
/** Reintentos: 5 s, 30 s, 2 min y luego cada 10 min. */
export const ESPERAS_MS = [5_000, 30_000, 120_000, 600_000];

export function siguienteIntento(intentos: number, ahora: number): number {
  const i = Math.min(Math.max(intentos, 1), ESPERAS_MS.length) - 1;
  return ahora + ESPERAS_MS[i];
}

export function aMarcaLote(m: MarcaCola, dispositivoId?: string): MarcaLote {
  return {
    uuid_cliente: m.uuid_cliente,
    matricula_id: m.matricula_id,
    seccion_id: m.seccion_id,
    fecha: m.fecha,
    bloque_id: m.bloque_id,
    estado: m.estado,
    metodo: m.metodo,
    marcado_en: m.marcado_en,
    dispositivo_id: dispositivoId,
    justificacion: m.estado === 'J' && m.motivo ? { motivo: m.motivo, detalle: m.detalle ?? '' } : null,
  };
}

/** Error sin respuesta del servidor (sin red, tiempo agotado). */
function esSinRed(e: unknown): boolean {
  return !(e as { response?: unknown } | null)?.response;
}

function estadoHttp(e: unknown): number | null {
  const err = e as { response?: { status?: number } } | null;
  return err?.response?.status ?? null;
}

export async function sincronizar(
  repo: RepoSync,
  api: ApiSync,
  opciones: { ahora?: () => number; forzar?: boolean; dispositivoId?: string } = {},
): Promise<ResumenSync> {
  const ahora = opciones.ahora ?? Date.now;
  const corte = () => (opciones.forzar ? Number.MAX_SAFE_INTEGER : ahora());
  const r: ResumenSync = { enviadas: 0, aplicadas: 0, duplicadas: 0, rechazadas: 0, fotos: 0, cierres: 0, sinRed: false };

  // 1) Marcas en lotes de hasta 200, de la más antigua a la más nueva.
  for (;;) {
    const lote = await repo.marcasListas(corte(), TAMANO_LOTE);
    if (lote.length === 0) break;
    let resultados;
    try {
      resultados = await api.enviarLote(lote.map((m) => aMarcaLote(m, opciones.dispositivoId)));
    } catch (e) {
      await repo.posponerMarcas(lote.map((m) => m.uuid_cliente), ahora());
      r.sinRed = esSinRed(e);
      return r;
    }
    const recibidos = new Set(resultados.map((x) => x.uuid_cliente));
    const faltantes = lote.filter((m) => !recibidos.has(m.uuid_cliente)).map((m) => m.uuid_cliente);
    await repo.aplicarResultados(resultados, lote);
    if (faltantes.length) await repo.posponerMarcas(faltantes, ahora());
    r.enviadas += lote.length;
    for (const x of resultados) {
      if (x.resultado === 'aplicada') r.aplicadas++;
      else if (x.resultado === 'duplicada') r.duplicadas++;
      else r.rechazadas++;
    }
    if (lote.length < TAMANO_LOTE || faltantes.length === lote.length) break;
  }

  // 2) Fotos de justificaciones (cuando ya se conoce el registro en el servidor).
  for (const f of await repo.fotosListas(corte())) {
    try {
      await api.subirJustificacion(f.registro_id as number, f.motivo, f.detalle, f.uri);
      await repo.quitarFoto(f.uuid_cliente);
      r.fotos++;
    } catch (e) {
      const status = estadoHttp(e);
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) {
        await repo.quitarFoto(f.uuid_cliente, 'No se pudo adjuntar la foto de la constancia.');
      } else {
        await repo.posponerFoto(f.uuid_cliente, ahora());
        if (esSinRed(e)) {
          r.sinRed = true;
          return r;
        }
      }
    }
  }

  // 3) "Guardar lista" hecho sin conexión: se envía cuando ya no quedan marcas de esa lista.
  for (const c of await repo.cierresListos(corte())) {
    if (await repo.hayMarcasDe(c.seccion_id, c.fecha, c.bloque_id)) continue;
    try {
      await api.cerrarSesion(c.seccion_id, c.fecha, c.bloque_id);
      await repo.quitarCierre(c);
      r.cierres++;
    } catch (e) {
      const status = estadoHttp(e);
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) {
        await repo.quitarCierre(c);
      } else {
        await repo.posponerCierre(c, ahora());
        if (esSinRed(e)) {
          r.sinRed = true;
          return r;
        }
      }
    }
  }
  return r;
}
