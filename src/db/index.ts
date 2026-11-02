// Base local SQLite: nómina en caché, registros del servidor y colas offline.
import * as SQLite from 'expo-sqlite';

const VERSION = 1;

const ESQUEMA_V1 = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (
  clave TEXT PRIMARY KEY NOT NULL,
  valor TEXT NOT NULL,
  actualizado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nomina (
  matricula_id INTEGER PRIMARY KEY NOT NULL,
  seccion_id INTEGER NOT NULL,
  estudiante_id INTEGER NOT NULL,
  codigo TEXT,
  apellidos TEXT NOT NULL,
  nombres TEXT NOT NULL,
  iniciales TEXT NOT NULL,
  carnet_hash TEXT,
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_nomina_seccion ON nomina (seccion_id, orden);
CREATE INDEX IF NOT EXISTS idx_nomina_carnet ON nomina (carnet_hash);
CREATE TABLE IF NOT EXISTS registros_cache (
  seccion_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  bloque_id INTEGER NOT NULL DEFAULT 0,
  matricula_id INTEGER NOT NULL,
  estado TEXT NOT NULL,
  estado_original TEXT,
  registro_id INTEGER,
  marcado_en TEXT,
  PRIMARY KEY (seccion_id, fecha, bloque_id, matricula_id)
);
CREATE TABLE IF NOT EXISTS cola_registros (
  uuid_cliente TEXT PRIMARY KEY NOT NULL,
  matricula_id INTEGER NOT NULL,
  seccion_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  bloque_id INTEGER NOT NULL DEFAULT 0,
  estado TEXT,
  metodo TEXT NOT NULL,
  marcado_en TEXT NOT NULL,
  motivo TEXT,
  detalle TEXT,
  intentos INTEGER NOT NULL DEFAULT 0,
  proximo_intento INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cola_lista ON cola_registros (seccion_id, fecha, bloque_id);
CREATE TABLE IF NOT EXISTS cola_fotos (
  uuid_cliente TEXT PRIMARY KEY NOT NULL,
  registro_id INTEGER,
  uri TEXT NOT NULL,
  motivo TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT '',
  intentos INTEGER NOT NULL DEFAULT 0,
  proximo_intento INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cola_cierres (
  seccion_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  bloque_id INTEGER NOT NULL DEFAULT 0,
  intentos INTEGER NOT NULL DEFAULT 0,
  proximo_intento INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (seccion_id, fecha, bloque_id)
);
CREATE TABLE IF NOT EXISTS rechazos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula_id INTEGER,
  detalle TEXT NOT NULL,
  creado INTEGER NOT NULL,
  visto INTEGER NOT NULL DEFAULT 0
);
`;

let promesa: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrar(db: SQLite.SQLiteDatabase) {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const actual = fila?.user_version ?? 0;
  if (actual >= VERSION) return;
  if (actual < 1) await db.execAsync(ESQUEMA_V1);
  await db.execAsync(`PRAGMA user_version = ${VERSION}`);
}

export function obtenerDb(): Promise<SQLite.SQLiteDatabase> {
  if (!promesa) {
    promesa = (async () => {
      const db = await SQLite.openDatabaseAsync('asistencia.db');
      await migrar(db);
      return db;
    })();
    promesa.catch(() => (promesa = null));
  }
  return promesa;
}

/** Al cerrar sesión se borra todo lo guardado del docente (privacidad). */
export async function limpiarTodo() {
  const db = await obtenerDb();
  await db.execAsync(`
    DELETE FROM kv; DELETE FROM nomina; DELETE FROM registros_cache;
    DELETE FROM cola_registros; DELETE FROM cola_fotos; DELETE FROM cola_cierres; DELETE FROM rechazos;
  `);
}

// ---------------------------------------------------------------- kv (JSON)
export async function kvLeer<T>(clave: string): Promise<{ valor: T; actualizado: number } | null> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ valor: string; actualizado: number }>(
    'SELECT valor, actualizado FROM kv WHERE clave = ?', clave,
  );
  return fila ? { valor: JSON.parse(fila.valor) as T, actualizado: fila.actualizado } : null;
}

export async function kvGuardar(clave: string, valor: unknown) {
  const db = await obtenerDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO kv (clave, valor, actualizado) VALUES (?, ?, ?)',
    clave, JSON.stringify(valor), Date.now(),
  );
}
