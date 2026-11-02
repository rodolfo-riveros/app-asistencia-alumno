// Cola offline y motor de sincronización: sin red, con red, duplicados y conflicto.
import type { MarcaLote, ResultadoMarca } from '@/api/tipos';
import { combinar, contar, type RegistroCache } from '@/lista/estadoLista';
import { ESPERAS_MS, sincronizar, siguienteIntento, TAMANO_LOTE } from '@/sync/motor';
import type { ApiSync, CierreCola, FotoCola, MarcaCola, RepoSync } from '@/sync/tipos';
import type { Estado } from '@/theme/tokens';

// ------------------------------------------------------------ repositorio en memoria
class RepoMemoria implements RepoSync {
  cola: MarcaCola[] = [];
  cache = new Map<number, RegistroCache>();
  fotos: FotoCola[] = [];
  cierres: CierreCola[] = [];
  rechazos: string[] = [];

  async marcasListas(hasta: number, limite: number) {
    return this.cola
      .filter((m) => m.proximo_intento <= hasta)
      .sort((a, b) => a.marcado_en.localeCompare(b.marcado_en))
      .slice(0, limite);
  }
  async aplicarResultados(resultados: ResultadoMarca[], enviadas: MarcaCola[]) {
    for (const r of resultados) {
      const m = enviadas.find((x) => x.uuid_cliente === r.uuid_cliente);
      if (!m) continue;
      this.cola = this.cola.filter((x) => x.uuid_cliente !== m.uuid_cliente);
      if (r.registro_id && r.estado_final) {
        this.cache.set(m.matricula_id, {
          matricula_id: m.matricula_id, estado: r.estado_final, estado_original: null,
          registro_id: r.registro_id, marcado_en: r.marcado_en,
        });
      } else {
        this.cache.delete(m.matricula_id);
      }
      if (r.resultado === 'rechazada') {
        this.rechazos.push(r.detalle ?? '');
        this.fotos = this.fotos.filter((f) => f.uuid_cliente !== m.uuid_cliente);
      } else {
        this.fotos.forEach((f) => {
          if (f.uuid_cliente === m.uuid_cliente) f.registro_id = r.registro_id;
        });
      }
    }
  }
  async posponerMarcas(uuids: string[], ahora: number) {
    for (const m of this.cola) {
      if (uuids.includes(m.uuid_cliente)) {
        m.intentos += 1;
        m.proximo_intento = siguienteIntento(m.intentos, ahora);
      }
    }
  }
  async fotosListas(hasta: number) {
    return this.fotos.filter((f) => f.registro_id !== null && f.proximo_intento <= hasta);
  }
  async quitarFoto(uuid: string) {
    this.fotos = this.fotos.filter((f) => f.uuid_cliente !== uuid);
  }
  async posponerFoto(uuid: string, ahora: number) {
    const f = this.fotos.find((x) => x.uuid_cliente === uuid);
    if (f) f.proximo_intento = siguienteIntento(1, ahora);
  }
  async cierresListos(hasta: number) {
    return this.cierres.filter((c) => c.proximo_intento <= hasta);
  }
  async quitarCierre(c: CierreCola) {
    this.cierres = this.cierres.filter((x) => x !== c);
  }
  async posponerCierre(c: CierreCola, ahora: number) {
    c.proximo_intento = siguienteIntento(c.intentos + 1, ahora);
  }
  async hayMarcasDe(seccionId: number) {
    return this.cola.some((m) => m.seccion_id === seccionId);
  }
}

// ------------------------------------------------------------ servidor falso (idempotente)
class ServidorFalso implements ApiSync {
  registros = new Map<number, { estado: Estado; marcado_en: string; id: number; panel?: boolean }>();
  vistos = new Set<string>();
  sinRed = false;
  llamadas = 0;
  cierres = 0;
  fotos: number[] = [];
  private siguienteId = 1;

  async enviarLote(marcas: MarcaLote[]): Promise<ResultadoMarca[]> {
    this.llamadas++;
    if (this.sinRed) throw Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });
    return marcas.map((m) => {
      const actual = this.registros.get(m.matricula_id);
      const base = { uuid_cliente: m.uuid_cliente, codigo: null, detalle: null };
      if (this.vistos.has(m.uuid_cliente)) {
        return { ...base, resultado: 'duplicada', registro_id: actual?.id ?? null, estado_final: actual?.estado ?? null, marcado_en: actual?.marcado_en ?? null };
      }
      this.vistos.add(m.uuid_cliente);
      if (actual && (actual.panel || m.marcado_en < actual.marcado_en)) {
        return { ...base, resultado: 'rechazada', codigo: 'MARCA_ANTIGUA', detalle: 'Ya hay una marca más reciente.', registro_id: actual.id, estado_final: actual.estado, marcado_en: actual.marcado_en };
      }
      if (m.estado === null) {
        this.registros.delete(m.matricula_id);
        return { ...base, resultado: 'aplicada', registro_id: null, estado_final: null, marcado_en: null };
      }
      const id = actual?.id ?? this.siguienteId++;
      this.registros.set(m.matricula_id, { estado: m.estado, marcado_en: m.marcado_en, id });
      return { ...base, resultado: 'aplicada', registro_id: id, estado_final: m.estado, marcado_en: m.marcado_en };
    });
  }
  async subirJustificacion(registroId: number) {
    if (this.sinRed) throw Object.assign(new Error('Network Error'), { isAxiosError: true });
    this.fotos.push(registroId);
  }
  async cerrarSesion() {
    if (this.sinRed) throw Object.assign(new Error('Network Error'), { isAxiosError: true });
    this.cierres++;
  }
}

let n = 0;
function marca(matricula: number, estado: Estado | null, minuto: number, extra: Partial<MarcaCola> = {}): MarcaCola {
  return {
    uuid_cliente: `uuid-${++n}`, matricula_id: matricula, seccion_id: 1, fecha: '2026-10-06', bloque_id: null,
    estado, metodo: 'MANUAL', marcado_en: `2026-10-06T12:${String(minuto).padStart(2, '0')}:00.000Z`,
    motivo: null, detalle: null, intentos: 0, proximo_intento: 0, ...extra,
  };
}

const T0 = 1_000_000;

describe('cola offline', () => {
  test('sin red: las marcas se quedan en el teléfono y se reintenta con espera', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    api.sinRed = true;
    repo.cola.push(marca(1, 'P', 40), marca(2, 'F', 41));

    const r = await sincronizar(repo, api, { ahora: () => T0 });
    expect(r.sinRed).toBe(true);
    expect(repo.cola).toHaveLength(2);
    expect(repo.cola[0].proximo_intento).toBe(T0 + ESPERAS_MS[0]);

    // Antes de los 5 s no se vuelve a intentar.
    await sincronizar(repo, api, { ahora: () => T0 + 1000 });
    expect(api.llamadas).toBe(1);

    // Las esperas crecen: 5 s, 30 s, 2 min, 10 min (y se quedan en 10 min).
    expect(siguienteIntento(2, 0)).toBe(30_000);
    expect(siguienteIntento(9, 0)).toBe(600_000);
  });

  test('con red: se envía todo, se vacía la cola y la caché queda con el servidor', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    repo.cola.push(marca(1, 'P', 40), marca(2, 'T', 41));

    const r = await sincronizar(repo, api, { ahora: () => T0 });
    expect(r).toMatchObject({ enviadas: 2, aplicadas: 2, sinRed: false });
    expect(repo.cola).toHaveLength(0);
    expect(repo.cache.get(2)?.estado).toBe('T');
  });

  test('modo avión → marcar más → volver la red: todo llega sin duplicar', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    repo.cola.push(marca(1, 'P', 40));
    await sincronizar(repo, api, { ahora: () => T0 });

    api.sinRed = true;
    repo.cola.push(marca(2, 'P', 42), marca(3, 'F', 43));
    await sincronizar(repo, api, { ahora: () => T0 });
    expect(repo.cola).toHaveLength(2);

    api.sinRed = false;
    await sincronizar(repo, api, { ahora: () => T0, forzar: true });
    expect(repo.cola).toHaveLength(0);
    expect([...api.registros.keys()].sort()).toEqual([1, 2, 3]);
  });

  test('duplicados: reenviar la misma marca no la aplica dos veces', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    const m = marca(1, 'P', 40);
    repo.cola.push(m);
    await sincronizar(repo, api, { ahora: () => T0 });
    // Se perdió la respuesta y el teléfono la reenvía.
    repo.cola.push({ ...m });
    const r = await sincronizar(repo, api, { ahora: () => T0 });
    expect(r.duplicadas).toBe(1);
    expect(api.registros.size).toBe(1);
    expect(repo.cola).toHaveLength(0);
  });

  test('conflicto: gana la marca más reciente y la app muestra el estado final', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    api.registros.set(1, { estado: 'T', marcado_en: '2026-10-06T12:50:00.000Z', id: 99 });
    repo.cola.push(marca(1, 'F', 45)); // más antigua que la del servidor
    const r = await sincronizar(repo, api, { ahora: () => T0 });
    expect(r.rechazadas).toBe(1);
    expect(repo.cache.get(1)?.estado).toBe('T');
    expect(repo.rechazos).toHaveLength(1);
  });

  test('lotes de hasta 200 marcas', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    for (let i = 0; i < 450; i++) repo.cola.push(marca(i, 'P', 40));
    await sincronizar(repo, api, { ahora: () => T0 });
    expect(api.llamadas).toBe(Math.ceil(450 / TAMANO_LOTE));
    expect(repo.cola).toHaveLength(0);
  });

  test('foto de justificación: se sube cuando el servidor da el registro', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    const j = marca(5, 'J', 40, { motivo: 'SALUD', detalle: 'Cita médica' });
    repo.cola.push(j);
    repo.fotos.push({ uuid_cliente: j.uuid_cliente, registro_id: null, uri: 'file://x.jpg', motivo: 'SALUD', detalle: '', intentos: 0, proximo_intento: 0 });
    const r = await sincronizar(repo, api, { ahora: () => T0 });
    expect(r.fotos).toBe(1);
    expect(api.fotos).toEqual([api.registros.get(5)?.id]);
  });

  test('"Guardar lista" sin red se envía después de las marcas', async () => {
    const repo = new RepoMemoria();
    const api = new ServidorFalso();
    repo.cola.push(marca(1, 'P', 40));
    repo.cierres.push({ seccion_id: 1, fecha: '2026-10-06', bloque_id: null, intentos: 0, proximo_intento: 0 });
    api.sinRed = true;
    await sincronizar(repo, api, { ahora: () => T0 });
    expect(api.cierres).toBe(0);
    api.sinRed = false;
    await sincronizar(repo, api, { ahora: () => T0, forzar: true });
    expect(api.cierres).toBe(1);
    expect(repo.cierres).toHaveLength(0);
  });
});

describe('estado de la lista (caché + cola)', () => {
  const estudiantes = [1, 2, 3].map((id) => ({
    matricula_id: id, estudiante_id: id, apellidos: `Ap${id}`, nombres: `N${id}`, iniciales: 'AN',
  }));

  test('la marca local más reciente se muestra sobre la del servidor', () => {
    const cache: RegistroCache[] = [
      { matricula_id: 1, estado: 'P', estado_original: null, registro_id: 10, marcado_en: '2026-10-06T12:40:00Z' },
    ];
    const cola = [marca(1, 'T', 50), marca(1, 'F', 51), marca(2, 'P', 45)];
    const filas = combinar(estudiantes, cache, cola);
    expect(filas.map((f) => f.estado)).toEqual(['F', 'P', null]);
    expect(filas[0]).toMatchObject({ pendiente: true, registro_id: 10 });
    expect(contar(filas)).toMatchObject({ p: 1, f: 1, sinMarcar: 1, total: 3 });
  });

  test('quitar la marca localmente la deja sin marcar', () => {
    const cache: RegistroCache[] = [
      { matricula_id: 3, estado: 'P', estado_original: null, registro_id: 11, marcado_en: '2026-10-06T12:40:00Z' },
    ];
    const filas = combinar(estudiantes, cache, [marca(3, null, 52)]);
    expect(filas[2].estado).toBeNull();
  });
});
