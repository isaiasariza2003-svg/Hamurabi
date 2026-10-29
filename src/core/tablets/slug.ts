/** Clave válida para escribir `clave.formato`: letras, números y guion bajo, sin empezar por número. */
export const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

/** Convierte una etiqueta visible en una clave camelCase: "Fecha de inicio" -> "fechaDeInicio". */
export function slugifyKey(label: string): string {
  const words = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  const key = words
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
  return /^[0-9]/.test(key) ? `_${key}` : key
}

/** Texto que se muestra en el chip y que el usuario puede escribir: `clave` o `clave.formato`. */
export function tagNotation(key: string, format: string): string {
  return format ? `${key}.${format}` : key
}
