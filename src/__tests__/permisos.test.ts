import { escanea, pasaLista, puede } from '@/utils/permisos';

const docente = { permisos: ['app.acceso', 'asistencia.pasar_lista', 'asistencia.justificar', 'estudiantes.ver_historial'] };
const auxiliar = { permisos: ['app.acceso', 'asistencia.escanear_puerta'] };
const coordinador = { permisos: ['app.acceso', 'asistencia.todas_las_secciones'] };

describe('permisos del rol (configurados en el panel)', () => {
  test('docente: pasa lista, escanea desde su lista y ve historial', () => {
    expect(pasaLista(docente)).toBe(true);
    expect(escanea(docente)).toBe(true);
    expect(puede(docente, 'estudiantes.ver_historial')).toBe(true);
  });

  test('auxiliar: solo escanea en la puerta', () => {
    expect(pasaLista(auxiliar)).toBe(false);
    expect(escanea(auxiliar)).toBe(true);
    expect(puede(auxiliar, 'asistencia.justificar')).toBe(false);
  });

  test('rol personalizado con todas las secciones pasa lista', () => {
    expect(pasaLista(coordinador)).toBe(true);
  });

  test('sin datos de permisos no habilita nada', () => {
    expect(pasaLista(null)).toBe(false);
    expect(escanea({})).toBe(false);
  });
});
