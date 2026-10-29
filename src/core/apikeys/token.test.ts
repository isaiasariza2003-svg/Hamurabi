import { describe, expect, it } from 'vitest'
import { generateToken, sha256Hex, tokenPrefix } from './token'

describe('API tokens', () => {
  it('genera tokens con el formato que acepta la API y sin repetir', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken))
    expect(tokens.size).toBe(200)
    for (const t of tokens) expect(t).toMatch(/^hmb_[A-Za-z0-9]{40}$/)
  })

  it('prefijo visible', () => {
    expect(tokenPrefix('hmb_abcdefghXYZ')).toBe('hmb_abcdefgh')
  })

  it('SHA-256 en hexadecimal', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
