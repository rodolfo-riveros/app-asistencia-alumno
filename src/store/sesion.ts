import { create } from 'zustand';

import { alExpirarSesion, configurarTokens } from '@/api/cliente';
import * as endpoints from '@/api/endpoints';
import type { Usuario } from '@/api/tipos';
import { kvGuardar, kvLeer, limpiarTodo } from '@/db';

import { CLAVES, borrar, guardar, leer } from './almacen';

interface EstadoSesion {
  listo: boolean;
  usuario: Usuario | null;
  expirada: boolean;
  iniciar: () => Promise<void>;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
  actualizarUsuario: (u: Usuario) => Promise<void>;
}

export const useSesion = create<EstadoSesion>((set, get) => ({
  listo: false,
  usuario: null,
  expirada: false,

  async iniciar() {
    const [access, usuario] = await Promise.all([leer(CLAVES.access), leer(CLAVES.usuario)]);
    configurarTokens(access);
    set({ listo: true, usuario: access && usuario ? (JSON.parse(usuario) as Usuario) : null });
  },

  async entrar(email, password) {
    const r = await endpoints.login(email, password);
    // Si entra otro docente en el mismo teléfono, no debe ver datos del anterior.
    const anterior = await kvLeer<number>('usuario_id');
    if (anterior && anterior.valor !== r.usuario.id) await limpiarTodo();
    await Promise.all([
      guardar(CLAVES.access, r.access),
      guardar(CLAVES.refresh, r.refresh),
      guardar(CLAVES.usuario, JSON.stringify(r.usuario)),
    ]);
    await kvGuardar('usuario_id', r.usuario.id);
    configurarTokens(r.access);
    set({ usuario: r.usuario, expirada: false });
  },

  async salir() {
    const refresh = await leer(CLAVES.refresh);
    if (refresh) await endpoints.logout(refresh).catch(() => undefined);
    await Promise.all([borrar(CLAVES.access), borrar(CLAVES.refresh), borrar(CLAVES.usuario)]);
    await limpiarTodo();
    configurarTokens(null);
    set({ usuario: null, expirada: false });
  },

  async actualizarUsuario(u) {
    await guardar(CLAVES.usuario, JSON.stringify(u));
    set({ usuario: u });
  },
}));

// El refresh también venció: se vuelve al login sin borrar las marcas pendientes.
alExpirarSesion(() => {
  if (!useSesion.getState().usuario) return;
  void Promise.all([borrar(CLAVES.access), borrar(CLAVES.refresh)]);
  configurarTokens(null);
  useSesion.setState({ usuario: null, expirada: true });
});
