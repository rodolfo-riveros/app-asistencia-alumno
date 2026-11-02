import { fechaCabecera, fechaISO, fechaLarga, horaTexto } from '@/utils/fechas';
import { estadoAlTocar, estadoPorHora, estadoSeccion, formatearPorcentaje } from '@/utils/reglas';
import { coincide, sinTildes } from '@/utils/texto';

const TURNO = { hora_ingreso: '07:45', tolerancia_min: 10, hora_limite_falta: '09:45' };
// Lima = UTC−5 → 7:55 en Lima son las 12:55 UTC.
const lima = (h: number, m: number, s = 0) => new Date(Date.UTC(2026, 9, 6, h + 5, m, s));

describe('estadoPorHora (regla 1)', () => {
  test.each([
    [7, 30, 0, 'P'],
    [7, 55, 0, 'P'],
    [7, 55, 59, 'P'],
    [7, 56, 0, 'T'],
    [9, 45, 0, 'T'],
  ])('%i:%i:%i → %s', (h, m, s, esperado) => {
    expect(estadoPorHora(lima(h, m, s), TURNO).estado).toBe(esperado);
  });

  test('después de la hora límite es T con advertencia', () => {
    expect(estadoPorHora(lima(9, 46), TURNO)).toEqual({ estado: 'T', fueraDeHora: true });
  });
});

describe('estadoAlTocar', () => {
  test('la primera marca Presente se ajusta por la hora', () => {
    expect(estadoAlTocar(null, 'P', lima(7, 50), TURNO)).toBe('P');
    expect(estadoAlTocar(null, 'P', lima(8, 10), TURNO)).toBe('T');
  });
  test('si ya tenía marca, el docente sobrescribe sin ajuste', () => {
    expect(estadoAlTocar('T', 'P', lima(8, 10), TURNO)).toBe('P');
    expect(estadoAlTocar('P', 'F', lima(8, 10), TURNO)).toBe('F');
  });
  test('tocar el botón activo desmarca', () => {
    expect(estadoAlTocar('F', 'F', lima(8, 10), TURNO)).toBeNull();
  });
});

describe('textos en español (Perú)', () => {
  test('fechas', () => {
    expect(fechaLarga('2026-10-06')).toBe('Martes, 6 de octubre');
    expect(fechaCabecera('2026-10-06')).toBe('Martes 6 oct');
    expect(horaTexto('2026-10-06T12:52:00Z')).toBe('7:52');
  });
  test('la fecha de hoy es la de Lima aunque en UTC ya sea mañana', () => {
    expect(fechaISO(new Date('2026-10-07T03:00:00Z'))).toBe('2026-10-06');
  });
  test('porcentajes con coma', () => {
    expect(formatearPorcentaje(92.9)).toBe('92,9 %');
    expect(formatearPorcentaje(95)).toBe('95 %');
    expect(formatearPorcentaje(null)).toBe('—');
  });
  test('búsqueda sin tildes', () => {
    expect(sinTildes('Gutiérrez Layme')).toBe('gutierrez layme');
    expect(coincide('Gutiérrez Layme Adriana Sofía', 'gutierrez sofia')).toBe(true);
    expect(coincide('Flores Cusi Mateo', 'quispe')).toBe(false);
  });
  test('estado de la sección', () => {
    expect(estadoSeccion(28, 28)).toBe('COMPLETA');
    expect(estadoSeccion(27, 18)).toBe('EN_CURSO');
    expect(estadoSeccion(30, 0)).toBe('PENDIENTE');
  });
});
