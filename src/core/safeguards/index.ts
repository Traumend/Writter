// Worldview Safeguards (I4): validación previa a ofrecer un diff de IA.
export type SafeguardInput = { locked: boolean; allowLocked: boolean; replacement: string; target: string }

export function checkSafeguards(i: SafeguardInput): { ok: true } | { ok: false; reason: string } {
  if (i.locked && !i.allowLocked && i.replacement !== i.target) {
    return { ok: false, reason: 'La región/archivo está locked: true y la instrucción no autoriza tocarla explícitamente.' }
  }
  return { ok: true }
}

// Estimación local de tokens (sin red): ~4 chars/token. Visible antes de enviar (AC-5).
export const estimateTokens = (s: string) => Math.ceil(s.length / 4)
