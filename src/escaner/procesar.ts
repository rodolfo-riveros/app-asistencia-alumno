// Con red: pregunta al servidor (autoridad). Sin red o si tarda: valida contra
// la nómina guardada (sha256 del token) y encola la marca para enviarla luego.
import * as Crypto from 'expo-crypto';

import { esErrorDeRed, mensajeDeError } from '@/api/cliente';
import { escanear, type RespuestaEscaneo } from '@/api/endpoints';
import { buscarPorCarnet, guardarRegistroConfirmado, marcaEfectiva, metaNomina } from '@/db/asistencia';
import { marcar, trasGuardar } from '@/lista/acciones';
import { notificarCambio } from '@/store/sync';
import { obtenerDispositivoId } from '@/sync/sincronizador';
import { fechaISO, horaTexto } from '@/utils/fechas';

import { invalido, leerCodigo, resolverLocal, type ResultadoEscaneo, type SeccionLocal } from './resolver';

export interface OpcionesEscaneo {
  modo: 'PUERTA' | 'SECCION';
  seccionDestinoId: number | null;
  online: boolean;
}

export async function procesarEscaneo(
  codigo: string,
  op: OpcionesEscaneo,
): Promise<{ resultado: ResultadoEscaneo; escaneadosHoy: number | null }> {
  const id = Crypto.randomUUID();
  const ahora = new Date();
  const token = leerCodigo(codigo);
  if (!token) return { resultado: invalido(id, ahora), escaneadosHoy: null };

  if (op.online) {
    try {
      const r = await escanear({
        codigo: codigo.trim(),
        modo: op.modo,
        seccion_id: op.seccionDestinoId,
        marcado_en: ahora.toISOString(),
        uuid_cliente: id,
        dispositivo_id: await obtenerDispositivoId(),
      });
      await recordarConfirmado(r);
      return { resultado: desdeServidor(id, ahora, r), escaneadosHoy: r.escaneados_hoy ?? null };
    } catch (e) {
      if (!esErrorDeRed(e)) {
        return {
          resultado: { ...invalido(id, ahora, mensajeDeError(e)), tipo: 'rechazado', titulo: 'No se registró' },
          escaneadosHoy: null,
        };
      }
      notificarCambio({ online: false });
    }
  }
  return { resultado: await resolverSinRed(id, token, ahora, op), escaneadosHoy: null };
}

async function resolverSinRed(id: string, token: string, ahora: Date, op: OpcionesEscaneo): Promise<ResultadoEscaneo> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
  const [estudiante, meta] = await Promise.all([buscarPorCarnet(hash), metaNomina()]);
  const s = estudiante ? meta?.secciones.find((x) => x.id === estudiante.seccion_id) : undefined;
  const turno = s ? meta?.turnos.find((t) => t.id === s.turno_id) ?? null : null;
  const seccion: SeccionLocal | null = s
    ? { id: s.id, nombre: s.nombre, nombre_corto: s.nombre_corto, descripcion: s.descripcion, puede_escanear: s.puede_escanear, turno }
    : null;
  const fecha = fechaISO(ahora);
  const marcaActual = estudiante && seccion ? await marcaEfectiva(seccion.id, fecha, estudiante.matricula_id) : null;

  const { resultado, registrar } = resolverLocal({
    modo: op.modo, seccionDestinoId: op.seccionDestinoId, estudiante, seccion, marcaActual, ahora, id,
  });
  if (registrar) {
    await marcar(
      { seccionId: registrar.seccion_id, fecha, bloqueId: null },
      { uuid: id, metodo: 'QR', marcado_en: ahora.toISOString(), matriculaId: registrar.matricula_id, estado: registrar.estado },
    );
  }
  return resultado;
}

/** Guarda en el teléfono lo que el servidor registró, para que la lista lo muestre. */
async function recordarConfirmado(r: RespuestaEscaneo) {
  if ((r.resultado !== 'ok' && r.resultado !== 'duplicado') || !r.estudiante || !r.seccion || !r.estado) return;
  await guardarRegistroConfirmado({
    seccion_id: r.seccion.id,
    fecha: r.fecha ?? fechaISO(),
    matricula_id: r.estudiante.matricula_id,
    estado: r.estado,
    registro_id: r.registro_id ?? null,
    marcado_en: r.marcado_en ?? null,
  });
  await trasGuardar();
}

function desdeServidor(id: string, ahora: Date, r: RespuestaEscaneo): ResultadoEscaneo {
  const estudiante = r.estudiante
    ? {
        matricula_id: r.estudiante.matricula_id, estudiante_id: r.estudiante.id,
        nombre_completo: r.estudiante.nombre_completo, iniciales: r.estudiante.iniciales,
      }
    : null;
  const seccion = r.seccion ? { id: r.seccion.id, nombre_corto: r.seccion.nombre_corto, descripcion: r.seccion.descripcion } : null;
  const base = {
    id, hora: horaTexto(ahora) ?? '', estudiante, seccion, advertencia: r.advertencia ?? null, sinConexion: false,
  };
  switch (r.resultado) {
    case 'ok':
      return { ...base, tipo: 'ok', estado: r.estado ?? null, titulo: r.mensaje, detalle: seccion?.descripcion ?? '' };
    case 'duplicado':
      return { ...base, tipo: 'duplicado', estado: r.estado ?? null, titulo: estudiante?.nombre_completo ?? 'Ya registrado', detalle: r.mensaje };
    case 'otra_seccion':
      return { ...base, tipo: 'otra_seccion', estado: null, titulo: estudiante?.nombre_completo ?? 'Otra sección', detalle: r.mensaje };
    case 'invalido':
      return { ...invalido(id, ahora, r.detalle ?? 'Carnet dado de baja o inexistente') };
    default:
      return { ...base, tipo: 'rechazado', estado: null, titulo: estudiante?.nombre_completo ?? 'No se registró', detalle: r.mensaje };
  }
}
