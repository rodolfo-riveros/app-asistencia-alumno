// Acciones del pase de lista. Todo se guarda primero en el teléfono (cola) y
// se envía en segundo plano: así funciona igual con o sin internet.
import * as Crypto from 'expo-crypto';
import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';

import type { Motivo } from '@/api/tipos';
import { encolarCierre, encolarFoto, encolarMarca } from '@/db/asistencia';
import { notificarCambio } from '@/store/sync';
import { actualizarPendientes, programarSync, sincronizarAhora } from '@/sync/sincronizador';
import type { Estado } from '@/theme/tokens';

export interface ClaveLista {
  seccionId: number;
  fecha: string;
  bloqueId: number | null;
}

interface NuevaMarca {
  uuid?: string;
  metodo?: 'MANUAL' | 'QR';
  marcado_en?: string;
  matriculaId: number;
  estado: Estado | null;
  motivo?: Motivo;
  detalle?: string;
}

async function guardarMarca(lista: ClaveLista, m: NuevaMarca): Promise<string> {
  const uuid = m.uuid ?? Crypto.randomUUID();
  await encolarMarca({
    uuid_cliente: uuid,
    matricula_id: m.matriculaId,
    seccion_id: lista.seccionId,
    fecha: lista.fecha,
    bloque_id: lista.bloqueId,
    estado: m.estado,
    metodo: m.metodo ?? 'MANUAL',
    marcado_en: m.marcado_en ?? new Date().toISOString(),
    motivo: m.motivo ?? null,
    detalle: m.detalle ?? null,
  });
  return uuid;
}

/** Avisa a las pantallas, actualiza el contador y programa el envío. */
export async function trasGuardar() {
  notificarCambio({ ultimoGuardado: Date.now() });
  await actualizarPendientes();
  programarSync();
}

export async function marcar(lista: ClaveLista, m: NuevaMarca) {
  const uuid = await guardarMarca(lista, m);
  await trasGuardar();
  return uuid;
}

/** "Todos presentes": solo a los que están sin marcar. */
export async function marcarVarios(lista: ClaveLista, marcas: NuevaMarca[]) {
  for (const m of marcas) await guardarMarca(lista, m);
  await trasGuardar();
}

/** Comprime la foto: máx. 1600 px por lado, JPEG calidad 80. */
export async function comprimirFoto(uri: string, ancho: number, alto: number): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  if (Math.max(ancho, alto) > 1600) {
    contexto.resize(ancho >= alto ? { width: 1600, height: null } : { width: null, height: 1600 });
  }
  const imagen = await contexto.renderAsync();
  const resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return resultado.uri;
}

export async function justificar(
  lista: ClaveLista,
  datos: { matriculaId: number; motivo: Motivo; detalle: string; fotoUri: string | null },
) {
  const uuid = await guardarMarca(lista, {
    matriculaId: datos.matriculaId, estado: 'J', motivo: datos.motivo, detalle: datos.detalle,
  });
  if (datos.fotoUri) {
    await encolarFoto({ uuid_cliente: uuid, registro_id: null, uri: datos.fotoUri, motivo: datos.motivo, detalle: datos.detalle });
  }
  await trasGuardar();
}

/** "Guardar lista": se encola y se envía después de las marcas de esa lista. */
export async function guardarLista(lista: ClaveLista) {
  await encolarCierre(lista.seccionId, lista.fecha, lista.bloqueId);
  await actualizarPendientes();
  await sincronizarAhora(true);
}
