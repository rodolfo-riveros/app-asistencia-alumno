import { create } from 'zustand';

interface EstadoSync {
  /** Sube con cada cambio en la base local: las pantallas recargan al verlo. */
  version: number;
  online: boolean;
  sincronizando: boolean;
  pendientes: number;
  ultimaSync: number | null;
  ultimoGuardado: number | null;
  ultimoError: string | null;
  set: (parcial: Partial<Omit<EstadoSync, 'set'>>) => void;
}

export const useSync = create<EstadoSync>((set) => ({
  version: 0,
  online: true,
  sincronizando: false,
  pendientes: 0,
  ultimaSync: null,
  ultimoGuardado: null,
  ultimoError: null,
  set: (parcial) => set(parcial),
}));

export function notificarCambio(extra: Partial<Omit<EstadoSync, 'set' | 'version'>> = {}) {
  useSync.setState((s) => ({ ...extra, version: s.version + 1 }));
}
