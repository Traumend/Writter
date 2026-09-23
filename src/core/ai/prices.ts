// Estimación de coste de las llamadas BYOK (ScriptWriterX §34): precios públicos aproximados
// en dólares por millón de tokens. Es orientativo: el proveedor manda, y los modelos gratis valen 0.
export type Price = { in: number; out: number }

const TABLE: [RegExp, Price][] = [
  [/:free\b|free$/i, { in: 0, out: 0 }],
  [/ollama|llama|mistral|qwen|phi/i, { in: 0, out: 0 }], // local: sin coste por token
  [/opus/i, { in: 15, out: 75 }],
  [/sonnet/i, { in: 3, out: 15 }],
  [/haiku/i, { in: 0.8, out: 4 }],
  [/gpt-4o-mini|gpt-5-mini|o4-mini/i, { in: 0.15, out: 0.6 }],
  [/gpt-4o|gpt-4\.1/i, { in: 2.5, out: 10 }],
  [/gpt-5/i, { in: 1.25, out: 10 }],
  [/o3|o1/i, { in: 2, out: 8 }],
  [/deepseek/i, { in: 0.3, out: 1.1 }],
  [/gemini.*flash/i, { in: 0.1, out: 0.4 }],
  [/gemini.*pro/i, { in: 1.25, out: 5 }],
  [/grok/i, { in: 2, out: 10 }]
]

export const priceOf = (model: string): Price | null => TABLE.find(([re]) => re.test(model))?.[1] ?? null

// Coste estimado en dólares; null cuando el modelo no está en la tabla (mejor no inventar cifras).
export function estimateCost(model: string, tokensIn: number, tokensOut: number): number | null {
  const p = priceOf(model)
  if (!p) return null
  return (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out
}

export const fmtCost = (usd: number | null): string => (usd === null ? '—' : usd === 0 ? '0' : usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`)
