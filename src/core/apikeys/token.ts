const TOKEN_PREFIX = 'hmb_'
const TOKEN_LENGTH = 40
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Parte visible del token que se guarda para reconocerlo: `hmb_` + 8 caracteres. */
export const tokenPrefix = (token: string) => token.slice(0, TOKEN_PREFIX.length + 8)

/** Token aleatorio `hmb_` + 40 caracteres base62 (~238 bits). La API exige este formato. */
export function generateToken(): string {
  let out = ''
  while (out.length < TOKEN_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH))) {
      // Se descartan los bytes >= 248 para que todos los caracteres sean equiprobables.
      if (b < 248 && out.length < TOKEN_LENGTH) out += ALPHABET[b % ALPHABET.length]
    }
  }
  return TOKEN_PREFIX + out
}

/** Huella que se guarda en la base; la Edge Function calcula la misma para validar. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
