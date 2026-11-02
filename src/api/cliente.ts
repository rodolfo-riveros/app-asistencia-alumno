// Cliente HTTP con JWT. Si el access expira (401), renueva una sola vez con el
// refresh (rotación) y reintenta. Si el refresh también falla, avisa a la sesión.
import { create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { CLAVES, guardar, leer } from '@/store/almacen';

import type { ErrorApi } from './tipos';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001/api/v1').replace(/\/$/, '');

export const api = create({ baseURL: API_URL, timeout: 15000 });
// Sin interceptores: para renovar el token sin entrar en bucle.
const crudo = create({ baseURL: API_URL, timeout: 15000 });

let accessEnMemoria: string | null = null;
let renovando: Promise<string | null> | null = null;
let alExpirar: (() => void) | null = null;

export function configurarTokens(access: string | null) {
  accessEnMemoria = access;
}

export function alExpirarSesion(fn: () => void) {
  alExpirar = fn;
}

api.interceptors.request.use(async (config) => {
  const token = accessEnMemoria ?? (await leer(CLAVES.access));
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function renovar(): Promise<string | null> {
  const refresh = await leer(CLAVES.refresh);
  if (!refresh) return null;
  try {
    const { data } = await crudo.post('/auth/refresh/', { refresh });
    await guardar(CLAVES.access, data.access);
    if (data.refresh) await guardar(CLAVES.refresh, data.refresh);
    accessEnMemoria = data.access;
    return data.access;
  } catch (e) {
    // Sin red: no cerramos la sesión, solo fallamos esta petición.
    if (isAxiosError(e) && !e.response) throw e;
    return null;
  }
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _reintento?: boolean }) | undefined;
  const url = original?.url ?? '';
  if (error.response?.status !== 401 || !original || original._reintento || url.includes('auth/login')) {
    throw error;
  }
  original._reintento = true;
  renovando = renovando ?? renovar().finally(() => (renovando = null));
  const nuevo = await renovando;
  if (!nuevo) {
    alExpirar?.();
    throw error;
  }
  original.headers.Authorization = `Bearer ${nuevo}`;
  return api(original);
});

/** Mensaje en español para mostrar al usuario. */
export function mensajeDeError(e: unknown): string {
  if (isAxiosError(e)) {
    if (!e.response) return 'Sin conexión con el servidor. Revisa tu internet.';
    const datos = e.response.data as Partial<ErrorApi> | undefined;
    if (datos?.campos) {
      const primero = Object.values(datos.campos).flat()[0];
      if (primero) return String(primero);
    }
    if (datos?.detalle) return datos.detalle;
    return `Error del servidor (${e.response.status}).`;
  }
  return 'Ocurrió un error inesperado.';
}

export function esErrorDeRed(e: unknown): boolean {
  return isAxiosError(e) && !e.response;
}
