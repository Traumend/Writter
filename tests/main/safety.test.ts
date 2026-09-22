import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// El watcher sigue vivo tras cerrar la ventana: enviar por webContents a una ventana destruida lanza
// "Object has been destroyed" como excepción no capturada del proceso principal.
const main = readFileSync('src/main/index.ts', 'utf8')

test('main: nada envía al renderer sin comprobar que la ventana sigue viva', () => {
  const sends = main.split('\n').map((ln, i) => [ln, i + 1] as const).filter(([ln]) => /win[!?]?\.webContents\.send\(/.test(ln))
  expect(sends.length).toBeGreaterThan(0)
  const unguarded = sends.filter(([ln]) => !/isDestroyed\(\)/.test(ln) && !/alive\(\)/.test(ln)).map(([, i]) => i)
  expect(unguarded).toEqual([])
})

test('main: al cerrar la ventana se cierra el observador del vault', () => {
  expect(/closeWatcher\(\)/.test(main)).toBe(true)
})
