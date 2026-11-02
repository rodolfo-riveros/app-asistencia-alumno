// Lecturas y escrituras de nómina, registros y colas en SQLite.
import type { Motivo, Nomina, ResultadoMarca, SesionSeccion, Turno } from '@/api/tipos';
import type { EstudianteLista, RegistroCache } from '@/lista/estadoLista';
import { siguienteIntento } from '@/sync/motor';
import type { CierreCola, FotoCola, MarcaCola, RepoSync } from '@/sync/tipos';
import type { Estado } from '@/theme/tokens';

import { kvGuardar, kvLeer, obtenerDb } from './index';

const b = (bloqueId: number | null) => bloqueId ?? 0;
const deB = (bloqueId: number) => (bloqueId === 0 ? null : bloqueId);

// ---------------------------------------------------------------- nómina
export interface MetaNomina {
  version: string;
  turnos: Turno[];
  secciones: (Omit<Nomina['secciones'][number], 'estudiantes'> & { total: number })[];
}

export async function guardarNomina(n: Nomina) {
  const db = await obtenerDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM nomina');
    for (const s of n.secciones) {
      let orden = 0;
      for (const e of s.estudiantes) {
        await db.runAsync(
          `INSERT OR REPLACE INTO nomina
           (matricula_id, seccion_id, estudiante_id, codigo, apellidos, nombres, iniciales, carnet_hash, orden)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          e.matricula_id, s.id, e.estudiante_id, e.codigo, `${e.apellido_paterno} ${e.apellido_materno}`.trim(),
          e.nombres, e.iniciales, e.carnet_hash, orden++,
        );
      }
    }
  });
  const meta: MetaNomina = {
    version: n.version,
    turnos: n.turnos,
    secciones: n.secciones.map(({ estudiantes, ...s }) => ({ ...s, total: estudiantes.length })),
  };
  await kvGuardar('nomina', meta);
}

export async function metaNomina() {
  return (await kvLeer<MetaNomina>('nomina'))?.valor ?? null;
}

export async function estudiantesDeSeccion(seccionId: number): Promise<EstudianteLista[]> {
  const db = await obtenerDb();
  return db.getAllAsync<EstudianteLista>(
    'SELECT matricula_id, estudiante_id, apellidos, nombres, iniciales FROM nomina WHERE seccion_id = ? ORDER BY orden',
    seccionId,
  );
}

// ---------------------------------------------------------------- registros confirmados por el servidor
/** Guarda lo que devolvió GET secciones/{id}/sesion/ (alumnos y registros). */
export async function guardarSesionServidor(s: SesionSeccion, bloqueId: number | null) {
  const db = await obtenerDb();
  await db.withTransactionAsync(async () => {
    let orden = 0;
    for (const e of s.estudiantes) {
      await db.runAsync(
        `INSERT INTO nomina (matricula_id, seccion_id, estudiante_id, apellidos, nombres, iniciales, orden)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(matricula_id) DO UPDATE SET seccion_id = excluded.seccion_id, apellidos = excluded.apellidos,
           nombres = excluded.nombres, iniciales = excluded.iniciales, orden = excluded.orden`,
        e.matricula_id, s.seccion.id, e.estudiante_id, e.apellidos, e.nombres, e.iniciales, orden++,
      );
    }
    await db.runAsync(
      'DELETE FROM registros_cache WHERE seccion_id = ? AND fecha = ? AND bloque_id = ?', s.seccion.id, s.fecha, b(bloqueId),
    );
    for (const e of s.estudiantes) {
      if (!e.registro) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO registros_cache
         (seccion_id, fecha, bloque_id, matricula_id, estado, estado_original, registro_id, marcado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        s.seccion.id, s.fecha, b(bloqueId), e.matricula_id, e.registro.estado, e.registro.estado_original,
        e.registro.id, e.registro.marcado_en,
      );
    }
  });
}

export async function registrosCache(seccionId: number, fecha: string, bloqueId: number | null): Promise<RegistroCache[]> {
  const db = await obtenerDb();
  return db.getAllAsync<RegistroCache>(
    `SELECT matricula_id, estado, estado_original, registro_id, marcado_en FROM registros_cache
     WHERE seccion_id = ? AND fecha = ? AND bloque_id = ?`,
    seccionId, fecha, b(bloqueId),
  );
}

// ---------------------------------------------------------------- cola de marcas
interface FilaCola extends Omit<MarcaCola, 'bloque_id'> {
  bloque_id: number;
}
const aMarca = (f: FilaCola): MarcaCola => ({ ...f, bloque_id: deB(f.bloque_id) });

export async function encolarMarca(m: Omit<MarcaCola, 'intentos' | 'proximo_intento'>) {
  const db = await obtenerDb();
  await db.runAsync(
    `INSERT INTO cola_registros
     (uuid_cliente, matricula_id, seccion_id, fecha, bloque_id, estado, metodo, marcado_en, motivo, detalle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    m.uuid_cliente, m.matricula_id, m.seccion_id, m.fecha, b(m.bloque_id), m.estado, m.metodo, m.marcado_en,
    m.motivo, m.detalle,
  );
}

export async function colaDeLista(seccionId: number, fecha: string, bloqueId: number | null): Promise<MarcaCola[]> {
  const db = await obtenerDb();
  const filas = await db.getAllAsync<FilaCola>(
    'SELECT * FROM cola_registros WHERE seccion_id = ? AND fecha = ? AND bloque_id = ? ORDER BY marcado_en',
    seccionId, fecha, b(bloqueId),
  );
  return filas.map(aMarca);
}

export async function contarPendientes(): Promise<number> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM cola_registros) + (SELECT COUNT(*) FROM cola_fotos) + (SELECT COUNT(*) FROM cola_cierres) AS n',
  );
  return fila?.n ?? 0;
}

export async function encolarFoto(f: { uuid_cliente: string; registro_id: number | null; uri: string; motivo: Motivo; detalle: string }) {
  const db = await obtenerDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO cola_fotos (uuid_cliente, registro_id, uri, motivo, detalle) VALUES (?, ?, ?, ?, ?)',
    f.uuid_cliente, f.registro_id, f.uri, f.motivo, f.detalle,
  );
}

export async function encolarCierre(seccionId: number, fecha: string, bloqueId: number | null) {
  const db = await obtenerDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO cola_cierres (seccion_id, fecha, bloque_id) VALUES (?, ?, ?)', seccionId, fecha, b(bloqueId),
  );
}

export async function rechazosSinVer(): Promise<{ id: number; detalle: string }[]> {
  const db = await obtenerDb();
  return db.getAllAsync('SELECT id, detalle FROM rechazos WHERE visto = 0 ORDER BY id');
}

export async function marcarRechazosVistos() {
  const db = await obtenerDb();
  await db.runAsync('UPDATE rechazos SET visto = 1 WHERE visto = 0');
}

// ---------------------------------------------------------------- repositorio para el motor
export const repoSqlite: RepoSync = {
  async marcasListas(hasta, limite) {
    const db = await obtenerDb();
    const filas = await db.getAllAsync<FilaCola>(
      'SELECT * FROM cola_registros WHERE proximo_intento <= ? ORDER BY marcado_en LIMIT ?', hasta, limite,
    );
    return filas.map(aMarca);
  },

  async aplicarResultados(resultados: ResultadoMarca[], enviadas: MarcaCola[]) {
    const db = await obtenerDb();
    const porUuid = new Map(enviadas.map((m) => [m.uuid_cliente, m]));
    await db.withTransactionAsync(async () => {
      for (const r of resultados) {
        const m = porUuid.get(r.uuid_cliente);
        if (!m) continue;
        await db.runAsync('DELETE FROM cola_registros WHERE uuid_cliente = ?', m.uuid_cliente);
        // La caché queda con la verdad del servidor (estado_final).
        if (r.registro_id && r.estado_final) {
          await db.runAsync(
            `INSERT INTO registros_cache (seccion_id, fecha, bloque_id, matricula_id, estado, registro_id, marcado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(seccion_id, fecha, bloque_id, matricula_id) DO UPDATE SET
               estado = excluded.estado, registro_id = excluded.registro_id, marcado_en = excluded.marcado_en`,
            m.seccion_id, m.fecha, b(m.bloque_id), m.matricula_id, r.estado_final as Estado, r.registro_id,
            r.marcado_en ?? m.marcado_en,
          );
        } else {
          await db.runAsync(
            'DELETE FROM registros_cache WHERE seccion_id = ? AND fecha = ? AND bloque_id = ? AND matricula_id = ?',
            m.seccion_id, m.fecha, b(m.bloque_id), m.matricula_id,
          );
        }
        if (r.resultado === 'rechazada') {
          await db.runAsync('DELETE FROM cola_fotos WHERE uuid_cliente = ?', m.uuid_cliente);
          await db.runAsync(
            'INSERT INTO rechazos (matricula_id, detalle, creado) VALUES (?, ?, ?)',
            m.matricula_id, r.detalle ?? 'La marca no se aplicó.', Date.now(),
          );
        } else if (r.registro_id) {
          await db.runAsync('UPDATE cola_fotos SET registro_id = ? WHERE uuid_cliente = ?', r.registro_id, m.uuid_cliente);
        }
      }
    });
  },

  async posponerMarcas(uuids, ahora) {
    const db = await obtenerDb();
    for (const uuid of uuids) {
      const fila = await db.getFirstAsync<{ intentos: number }>(
        'SELECT intentos FROM cola_registros WHERE uuid_cliente = ?', uuid,
      );
      if (!fila) continue;
      const intentos = fila.intentos + 1;
      await db.runAsync(
        'UPDATE cola_registros SET intentos = ?, proximo_intento = ? WHERE uuid_cliente = ?',
        intentos, siguienteIntento(intentos, ahora), uuid,
      );
    }
  },

  async fotosListas(hasta) {
    const db = await obtenerDb();
    return db.getAllAsync<FotoCola>(
      'SELECT * FROM cola_fotos WHERE registro_id IS NOT NULL AND proximo_intento <= ?', hasta,
    );
  },

  async quitarFoto(uuid, rechazo) {
    const db = await obtenerDb();
    await db.runAsync('DELETE FROM cola_fotos WHERE uuid_cliente = ?', uuid);
    if (rechazo) await db.runAsync('INSERT INTO rechazos (detalle, creado) VALUES (?, ?)', rechazo, Date.now());
  },

  async posponerFoto(uuid, ahora) {
    const db = await obtenerDb();
    await db.runAsync(
      'UPDATE cola_fotos SET intentos = intentos + 1, proximo_intento = ? WHERE uuid_cliente = ?',
      siguienteIntento(1, ahora), uuid,
    );
  },

  async cierresListos(hasta) {
    const db = await obtenerDb();
    const filas = await db.getAllAsync<CierreCola & { bloque_id: number }>(
      'SELECT * FROM cola_cierres WHERE proximo_intento <= ?', hasta,
    );
    return filas.map((c) => ({ ...c, bloque_id: deB(c.bloque_id) }));
  },

  async quitarCierre(c) {
    const db = await obtenerDb();
    await db.runAsync(
      'DELETE FROM cola_cierres WHERE seccion_id = ? AND fecha = ? AND bloque_id = ?', c.seccion_id, c.fecha, b(c.bloque_id),
    );
  },

  async posponerCierre(c, ahora) {
    const db = await obtenerDb();
    await db.runAsync(
      'UPDATE cola_cierres SET intentos = intentos + 1, proximo_intento = ? WHERE seccion_id = ? AND fecha = ? AND bloque_id = ?',
      siguienteIntento(c.intentos + 1, ahora), c.seccion_id, c.fecha, b(c.bloque_id),
    );
  },

  async hayMarcasDe(seccionId, fecha, bloqueId) {
    const db = await obtenerDb();
    const fila = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM cola_registros WHERE seccion_id = ? AND fecha = ? AND bloque_id = ?',
      seccionId, fecha, b(bloqueId),
    );
    return (fila?.n ?? 0) > 0;
  },
};

// ---------------------------------------------------------------- escáner e historial
export interface EstudianteNominaLocal {
  matricula_id: number;
  estudiante_id: number;
  seccion_id: number;
  codigo: string | null;
  apellidos: string;
  nombres: string;
  iniciales: string;
}

/** Busca al estudiante por sha256(token) del carnet (validación offline). */
export async function buscarPorCarnet(hash: string): Promise<EstudianteNominaLocal | null> {
  const db = await obtenerDb();
  return db.getFirstAsync<EstudianteNominaLocal>(
    `SELECT matricula_id, estudiante_id, seccion_id, codigo, apellidos, nombres, iniciales
     FROM nomina WHERE carnet_hash = ?`,
    hash.toLowerCase(),
  );
}

export async function todosLosEstudiantes(): Promise<EstudianteNominaLocal[]> {
  const db = await obtenerDb();
  return db.getAllAsync<EstudianteNominaLocal>(
    `SELECT matricula_id, estudiante_id, seccion_id, codigo, apellidos, nombres, iniciales
     FROM nomina ORDER BY apellidos, nombres`,
  );
}

/** Estado que hoy tiene el estudiante en su lista diaria (cola local o lo confirmado). */
export async function marcaEfectiva(
  seccionId: number, fecha: string, matriculaId: number,
): Promise<{ estado: Estado; marcado_en: string | null } | null> {
  const db = await obtenerDb();
  const local = await db.getFirstAsync<{ estado: Estado | null; marcado_en: string }>(
    `SELECT estado, marcado_en FROM cola_registros
     WHERE seccion_id = ? AND fecha = ? AND bloque_id = 0 AND matricula_id = ? ORDER BY marcado_en DESC LIMIT 1`,
    seccionId, fecha, matriculaId,
  );
  if (local) return local.estado ? { estado: local.estado, marcado_en: local.marcado_en } : null;
  return db.getFirstAsync<{ estado: Estado; marcado_en: string | null }>(
    `SELECT estado, marcado_en FROM registros_cache
     WHERE seccion_id = ? AND fecha = ? AND bloque_id = 0 AND matricula_id = ?`,
    seccionId, fecha, matriculaId,
  );
}

/** Guarda un registro que el servidor confirmó (escaneo con conexión). */
export async function guardarRegistroConfirmado(r: {
  seccion_id: number; fecha: string; matricula_id: number; estado: Estado; registro_id: number | null; marcado_en: string | null;
}) {
  const db = await obtenerDb();
  await db.runAsync(
    `INSERT INTO registros_cache (seccion_id, fecha, bloque_id, matricula_id, estado, registro_id, marcado_en)
     VALUES (?, ?, 0, ?, ?, ?, ?)
     ON CONFLICT(seccion_id, fecha, bloque_id, matricula_id) DO UPDATE SET
       estado = excluded.estado, registro_id = excluded.registro_id, marcado_en = excluded.marcado_en`,
    r.seccion_id, r.fecha, r.matricula_id, r.estado, r.registro_id, r.marcado_en,
  );
}
