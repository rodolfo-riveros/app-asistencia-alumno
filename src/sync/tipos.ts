import type { MarcaLote, Motivo, ResultadoMarca } from '@/api/tipos';
import type { Estado } from '@/theme/tokens';

/** Una marca guardada en el teléfono esperando ser enviada. */
export interface MarcaCola {
  uuid_cliente: string;
  matricula_id: number;
  seccion_id: number;
  fecha: string;
  bloque_id: number | null;
  estado: Estado | null; // null = se quitó la marca
  metodo: 'MANUAL' | 'QR';
  marcado_en: string; // ISO, hora del teléfono
  motivo: Motivo | null; // solo para J
  detalle: string | null;
  intentos: number;
  proximo_intento: number; // epoch ms
}

export interface FotoCola {
  uuid_cliente: string; // la marca J a la que pertenece
  registro_id: number | null; // se conoce cuando el servidor aplica la marca
  uri: string;
  motivo: Motivo;
  detalle: string;
  intentos: number;
  proximo_intento: number;
}

export interface CierreCola {
  seccion_id: number;
  fecha: string;
  bloque_id: number | null;
  intentos: number;
  proximo_intento: number;
}

/** Almacenamiento de las colas (SQLite en la app, memoria en los tests). */
export interface RepoSync {
  marcasListas(hasta: number, limite: number): Promise<MarcaCola[]>;
  aplicarResultados(resultados: ResultadoMarca[], enviadas: MarcaCola[]): Promise<void>;
  posponerMarcas(uuids: string[], ahora: number): Promise<void>;
  fotosListas(hasta: number): Promise<FotoCola[]>;
  quitarFoto(uuid: string, rechazo?: string): Promise<void>;
  posponerFoto(uuid: string, ahora: number): Promise<void>;
  cierresListos(hasta: number): Promise<CierreCola[]>;
  quitarCierre(c: CierreCola): Promise<void>;
  posponerCierre(c: CierreCola, ahora: number): Promise<void>;
  hayMarcasDe(seccionId: number, fecha: string, bloqueId: number | null): Promise<boolean>;
}

export interface ApiSync {
  enviarLote(marcas: MarcaLote[]): Promise<ResultadoMarca[]>;
  subirJustificacion(registroId: number, motivo: Motivo, detalle: string, fotoUri: string | null): Promise<unknown>;
  cerrarSesion(seccionId: number, fecha: string, bloqueId: number | null): Promise<unknown>;
}

export interface ResumenSync {
  enviadas: number;
  aplicadas: number;
  duplicadas: number;
  rechazadas: number;
  fotos: number;
  cierres: number;
  sinRed: boolean;
}
