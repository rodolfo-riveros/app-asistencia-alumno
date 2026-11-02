// Tokens y datos de sesión en expo-secure-store (cifrado del sistema).
// En web (solo para desarrollo) SecureStore no existe: se usa localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const esWeb = Platform.OS === 'web';

export async function leer(clave: string): Promise<string | null> {
  if (esWeb) return globalThis.localStorage?.getItem(clave) ?? null;
  return SecureStore.getItemAsync(clave);
}

export async function guardar(clave: string, valor: string): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.setItem(clave, valor);
    return;
  }
  await SecureStore.setItemAsync(clave, valor);
}

export async function borrar(clave: string): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.removeItem(clave);
    return;
  }
  await SecureStore.deleteItemAsync(clave);
}

export const CLAVES = {
  access: 'ae.access',
  refresh: 'ae.refresh',
  usuario: 'ae.usuario',
  dispositivo: 'ae.dispositivo',
} as const;
