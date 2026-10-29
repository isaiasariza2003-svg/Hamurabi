import { describe, expect, it } from 'vitest'
import { format, integerToWords, isValidFormat } from './index'

describe('integerToWords', () => {
  it.each([
    [0, 'cero'],
    [1, 'uno'],
    [21, 'veintiuno'],
    [31, 'treinta y uno'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [1000, 'mil'],
    [1500, 'mil quinientos'],
    [21000, 'veintiún mil'],
    [31000, 'treinta y un mil'],
    [1000000, 'un millón'],
    [2500000, 'dos millones quinientos mil'],
    [1000000000000, 'un billón'],
  ])('%i -> %s', (n, expected) => {
    expect(integerToWords(n)).toBe(expected)
  })

  it('rechaza negativos y decimales', () => {
    expect(() => integerToWords(-1)).toThrow()
    expect(() => integerToWords(1.5)).toThrow()
  })
})

describe('format', () => {
  it('devuelve cadena vacía sin valor', () => {
    expect(format('', 'number', 'letras')).toBe('')
    expect(format(undefined, 'text')).toBe('')
  })

  it('sin formato devuelve el valor tal cual', () => {
    expect(format('Juan', 'text')).toBe('Juan')
    expect(format(1500, 'number')).toBe('1500')
  })

  it('formatea moneda y miles', () => {
    expect(format(1500, 'number', 'moneda')).toBe('$1.500,00')
    expect(format(-1234.5, 'number', 'moneda')).toBe('-$1.234,50')
    expect(format(1500, 'number', 'miles')).toBe('1.500')
  })

  it('moneda en letras', () => {
    expect(format(1500, 'number', 'monedaLetras')).toBe('mil quinientos pesos 00/100')
    expect(format(1, 'number', 'monedaLetras')).toBe('un peso 00/100')
    expect(format(21, 'number', 'monedaLetras')).toBe('veintiún pesos 00/100')
    expect(format(31, 'number', 'monedaLetras')).toBe('treinta y un pesos 00/100')
    expect(format(2000000, 'number', 'monedaLetras')).toBe('dos millones de pesos 00/100')
    expect(format(10.25, 'number', 'monedaLetras')).toBe('diez pesos 25/100')
  })

  it('número en letras', () => {
    expect(format(1500, 'number', 'letras')).toBe('mil quinientos')
    expect(format(-3, 'number', 'letras')).toBe('menos tres')
  })

  it('fechas sin desfase de zona horaria', () => {
    expect(format('2026-10-28', 'date')).toBe('28/10/2026')
    expect(format('2026-10-28', 'date', 'larga')).toBe('28 de octubre de 2026')
    expect(format('2026-10-28', 'date', 'diaSemana')).toBe('miércoles')
    expect(format('2026-01-01', 'date', 'mes')).toBe('enero')
  })

  it('fecha por partes: día, mes y año en número y en letras', () => {
    expect(format('2026-10-29', 'date', 'dia')).toBe('29')
    expect(format('2026-10-29', 'date', 'diaLetras')).toBe('veintinueve')
    expect(format('2026-10-01', 'date', 'diaLetras')).toBe('uno')
    expect(format('2026-03-05', 'date', 'mesNumero')).toBe('3')
    expect(format('2026-10-29', 'date', 'anio')).toBe('2026')
    expect(format('2026-10-29', 'date', 'anioLetras')).toBe('dos mil veintiséis')
  })

  it('texto', () => {
    expect(format('Juan', 'text', 'mayusculas')).toBe('JUAN')
    expect(format('juan PÉREZ', 'text', 'titulo')).toBe('Juan Pérez')
    expect(format('juan pérez', 'text', 'iniciales')).toBe('J.P.')
    expect(format('HOLA', 'text', 'minusculas')).toBe('hola')
  })

  it('selección y booleano admiten formatos de texto', () => {
    expect(format('soltero', 'select', 'mayusculas')).toBe('SOLTERO')
    expect(format(true, 'boolean', '', { trueText: 'Aprobado' })).toBe('Aprobado')
    expect(format(true, 'boolean', 'mayusculas', { trueText: 'Aprobado' })).toBe('APROBADO')
    expect(format(false, 'boolean')).toBe('No')
  })
})

describe('isValidFormat', () => {
  it('valida el formato según el tipo', () => {
    expect(isValidFormat('text', 'mayusculas')).toBe(true)
    expect(isValidFormat('text', '')).toBe(true)
    expect(isValidFormat('number', 'mayusculas')).toBe(false)
    expect(isValidFormat('date', 'larga')).toBe(true)
  })
})
