// Ejecuta el motor con SQLite y la API real, y lo dispara cuando hace falta:
// al guardar una marca, al volver la conexión, cada 30 s y al abrir la app.
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { esErrorDeRed } from '@/api/cliente';
import * as endpoints from '@/api/endpoints';
import { contarPendientes, guardarNomina, metaNomina, repoSqlite } from '@/db/asistencia';
import { CLAVES, guardar, leer } from '@/store/almacen';
import { notificarCambio, useSync } from '@/store/sync';

import { sincronizar } from './motor';
import type { ApiSync } from './tipos';

const apiReal: ApiSync = {
  enviarLote: endpoints.enviarLote,
  subirJustificacion: endpoints.subirJustificacion,
  cerrarSesion: endpoints.cerrarSesion,
};

let enCurso = false;
let otraVez = false;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let dispositivoId: string | null = null;

export async function obtenerDispositivoId() {
  if (dispositivoId) return dispositivoId;
  dispositivoId = await leer(CLAVES.dispositivo);
  if (!dispositivoId) {
    dispositivoId = Crypto.randomUUID();
    await guardar(CLAVES.dispositivo, dispositivoId);
  }
  return dispositivoId;
}

export async function actualizarPendientes() {
  useSync.getState().set({ pendientes: await contarPendientes() });
}

export async function sincronizarAhora(forzar = false): Promise<void> {
  if (enCurso) {
    otraVez = true;
    return;
  }
  enCurso = true;
  useSync.getState().set({ sincronizando: true });
  try {
    const r = await sincronizar(repoSqlite, apiReal, { forzar, dispositivoId: await obtenerDispositivoId() });
    const pendientes = await contarPendientes();
    notificarCambio({
      pendientes,
      online: r.sinRed ? false : useSync.getState().online,
      ultimoError: r.sinRed ? 'Sin conexión con el servidor' : null,
      ...(r.sinRed ? {} : { ultimaSync: Date.now() }),
    });
  } catch {
    notificarCambio({ ultimoError: 'No se pudo sincronizar' });
  } finally {
    enCurso = false;
    useSync.getState().set({ sincronizando: false });
    if (otraVez) {
      otraVez = false;
      setTimeout(() => void sincronizarAhora(), 0);
    }
  }
}

/** Agrupa varios toques seguidos en un solo envío. */
export function programarSync(ms = 1200) {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void sincronizarAhora();
  }, ms);
}

/** Descarga la nómina solo si cambió (ETag). */
export async function refrescarNomina(): Promise<void> {
  try {
    const meta = await metaNomina();
    const nueva = await endpoints.obtenerNomina(meta?.version ?? null);
    if (nueva) {
      await guardarNomina(nueva);
      notificarCambio();
    }
  } catch (e) {
    if (!esErrorDeRed(e)) throw e;
  }
}

/** Montar una vez dentro de la parte autenticada de la app. */
export function useMotorSync() {
  useEffect(() => {
    void actualizarPendientes();
    void refrescarNomina().catch(() => undefined);
    void sincronizarAhora(true);

    let estabaOnline = true;
    const quitarRed = NetInfo.addEventListener((estado) => {
      const online = !!estado.isConnected && estado.isInternetReachable !== false;
      useSync.getState().set({ online });
      if (online && !estabaOnline) {
        void sincronizarAhora(true);
        void refrescarNomina().catch(() => undefined);
      }
      estabaOnline = online;
    });
    const intervalo = setInterval(() => void sincronizarAhora(), 30_000);
    const app = AppState.addEventListener('change', (e) => {
      if (e === 'active') void sincronizarAhora(true);
    });
    return () => {
      quitarRed();
      clearInterval(intervalo);
      app.remove();
    };
  }, []);
}
