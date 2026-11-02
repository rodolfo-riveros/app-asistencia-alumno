import { celdasDelMes } from '@/lista/calendario';
import { leerCodigo, lineaHistorial, resolverLocal, type Contexto, type SeccionLocal } from '@/escaner/resolver';

const lima = (h: number, m: number) => new Date(Date.UTC(2026, 9, 6, h + 5, m));
const TURNO = { hora_ingreso: '07:45', tolerancia_min: 10, hora_limite_falta: '09:45' };

const S3B: SeccionLocal = {
  id: 18, nombre: '3.º grado · Sección B', nombre_corto: '3.º B', descripcion: '3.º grado · Sección B · Primaria',
  puede_escanear: true, turno: TURNO,
};
const S5C: SeccionLocal = { ...S3B, id: 21, nombre_corto: '5.º C', puede_escanear: false };
const MATEO = { matricula_id: 5, estudiante_id: 9, seccion_id: 18, apellidos: 'Flores Cusi', nombres: 'Mateo Joaquín', iniciales: 'FM' };

function ctx(p: Partial<Contexto>): Contexto {
  return {
    modo: 'SECCION', seccionDestinoId: 18, estudiante: MATEO, seccion: S3B, marcaActual: null, ahora: lima(7, 52), id: 'x', ...p,
  };
}

describe('leerCodigo', () => {
  test('solo acepta AE1.<token>', () => {
    expect(leerCodigo('AE1.abcDEF123_-xyz7890qwe')).toBe('abcDEF123_-xyz7890qwe');
    expect(leerCodigo('  AE1.abcDEF123_-xyz7890qwe  ')).toBe('abcDEF123_-xyz7890qwe');
    expect(leerCodigo('https://ejemplo.com')).toBeNull();
    expect(leerCodigo('AE1.corto')).toBeNull();
    expect(leerCodigo('AE1.con espacios no valido')).toBeNull();
  });
});

describe('resolverLocal (escaneo sin conexión)', () => {
  test('presente antes de las 7:56', () => {
    const d = resolverLocal(ctx({}));
    expect(d.resultado).toMatchObject({ tipo: 'ok', estado: 'P', titulo: 'Presente registrado', hora: '7:52' });
    expect(d.registrar).toEqual({ matricula_id: 5, seccion_id: 18, estado: 'P' });
  });

  test('tarde desde las 7:56 y advertencia después de la hora límite', () => {
    expect(resolverLocal(ctx({ ahora: lima(7, 56) })).resultado).toMatchObject({ estado: 'T', titulo: 'Tarde registrada', advertencia: null });
    expect(resolverLocal(ctx({ ahora: lima(9, 50) })).resultado.advertencia).toContain('hora límite');
  });

  test('duplicado: no registra de nuevo y muestra la hora anterior', () => {
    const d = resolverLocal(ctx({ marcaActual: { estado: 'P', marcado_en: '2026-10-06T12:41:00Z' } }));
    expect(d.resultado).toMatchObject({ tipo: 'duplicado', detalle: 'Ya registrado a las 7:41' });
    expect(d.registrar).toBeNull();
  });

  test('inválido: carnet que no está en la nómina (dado de baja o inexistente)', () => {
    const d = resolverLocal(ctx({ estudiante: null, seccion: null }));
    expect(d.resultado).toMatchObject({ tipo: 'invalido', titulo: 'Código no válido', detalle: 'Carnet dado de baja o inexistente' });
    expect(d.registrar).toBeNull();
  });

  test('otra sección en modo sección', () => {
    const d = resolverLocal(ctx({ seccionDestinoId: 21 }));
    expect(d.resultado).toMatchObject({ tipo: 'otra_seccion', detalle: 'Pertenece a 3.º B — no se registró' });
    expect(d.registrar).toBeNull();
  });

  test('modo puerta: registra si puede escanear esa sección, si no es otra sección', () => {
    expect(resolverLocal(ctx({ modo: 'PUERTA', seccionDestinoId: null })).resultado.tipo).toBe('ok');
    const d = resolverLocal(ctx({ modo: 'PUERTA', seccionDestinoId: null, seccion: S5C, estudiante: { ...MATEO, seccion_id: 21 } }));
    expect(d.resultado).toMatchObject({ tipo: 'otra_seccion', detalle: 'Pertenece a 5.º C — no está entre tus secciones' });
  });

  test('línea de "Últimos escaneados"', () => {
    expect(lineaHistorial(resolverLocal(ctx({ ahora: lima(7, 58) })).resultado)).toEqual({
      titulo: 'Flores Cusi, Mateo Joaquín', detalle: '3.º B · Tarde',
    });
  });
});

describe('calendario del historial', () => {
  test('el 1 de octubre de 2026 (jueves) cae en la 4.ª columna y se completan semanas', () => {
    const dias = Array.from({ length: 31 }, (_, i) => ({
      fecha: `2026-10-${String(i + 1).padStart(2, '0')}`, dia: i + 1, dia_semana: ((3 + i) % 7) + 1,
      habil: true, estado: null,
    }));
    const celdas = celdasDelMes(dias);
    expect(celdas.slice(0, 3).every((c) => c.tipo === 'vacia')).toBe(true);
    expect(celdas[3]).toMatchObject({ tipo: 'dia', dia: 1 });
    expect(celdas.length % 7).toBe(0);
  });
});
