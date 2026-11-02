// Marcas diacríticas combinables (U+0300–U+036F) que quedan tras normalize("NFD").
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** Minúsculas y sin tildes, para buscar 'Gutierrez' y encontrar 'Gutiérrez'. */
export function sinTildes(texto: string): string {
  return (texto || '').normalize('NFD').replace(DIACRITICOS, '').toLowerCase();
}

/** Todas las palabras de la búsqueda deben aparecer en el texto. */
export function coincide(texto: string, busqueda: string): boolean {
  const q = sinTildes(busqueda).trim();
  if (!q) return true;
  const base = sinTildes(texto);
  return q.split(/\s+/).every((parte) => base.includes(parte));
}

export function plural(n: number, singular: string, pluralTexto?: string): string {
  return `${n} ${n === 1 ? singular : (pluralTexto ?? `${singular}s`)}`;
}
