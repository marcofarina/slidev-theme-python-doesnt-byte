// Verifica il contrasto WCAG delle coppie testo/fondo dichiarate da Atmospheric, nei due temi.
// Uso: npm run contrast. Esce con 1 se una coppia è sotto soglia.
//
// I colori oklch() si convertono in sRGB tagliando i canali fuori gamma; i colori con
// trasparenza si compongono sul fondo su cui stanno (surface, salvo dove indicato).

import { readFileSync } from 'node:fs'

const tokens = JSON.parse(readFileSync(new URL('../tokens/tokens.json', import.meta.url), 'utf8'))
const byName = Object.fromEntries(tokens.color.tokens.map(t => [t.name, t.value]))

const THEMES = ['light', 'dark']
const VOLUMES = ['programmatore', 'artefice', 'archivista', 'apprendista']
const CALLOUTS = tokens.color.tokens
  .map(t => t.name.match(/^callout-(.+)-bg$/)?.[1])
  .filter(Boolean)

const AA = 4.5

// Eccezione documentata nel README di Atmospheric: il titolo del callout `warning` in light
// è 4,0:1 e passa solo come testo grande in grassetto (26 px bold), soglia WCAG 3:1.
const EXCEPTIONS = {
  'light:callout-warning-fg/callout-warning-bg': { min: 3, why: 'titolo 26 px in grassetto' },
}

function raw(name, theme) {
  const value = byName[name]
  if (value === undefined)
    throw new Error(`token sconosciuto: ${name}`)
  const v = typeof value === 'object' ? value[theme] : value
  const alias = String(v).match(/^\{([a-z0-9-]+)\}$/)
  return alias ? raw(alias[1], theme) : String(v)
}

function parse(css) {
  let m = css.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
    return [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).concat(1)
  }
  m = css.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean)
    return [r / 255, g / 255, b / 255, Number(a)]
  }
  m = css.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/)
  if (m)
    return oklchToSrgb(m[1] / 100, Number(m[2]), Number(m[3])).concat(1)
  throw new Error(`colore non riconosciuto: ${css}`)
}

function oklchToSrgb(L, C, H) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return linear.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.min(1, Math.max(0, v))
  })
}

function over([r, g, b, a], [br, bg, bb]) {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1]
}

function luminance([r, g, b]) {
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Fondo opaco: un fondo trasparente si compone sul suo supporto (surface di default).
function ground(name, theme, under = 'surface') {
  const color = parse(raw(name, theme))
  return color[3] < 1 ? over(color, parse(raw(under, theme))) : color
}

function ratio(fg, bg, theme, under) {
  const back = ground(bg, theme, under)
  const front = over(parse(raw(fg, theme)), back)
  const [hi, lo] = [luminance(front), luminance(back)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Coppie dichiarate nel README e negli `usage` dei token.
const pairs = []
for (const fg of ['ink-strong', 'ink', 'ink-body', 'ink-muted', 'ink-muted-soft'])
  pairs.push([fg, 'surface'])
for (const fg of ['ink-strong', 'ink', 'ink-body', 'ink-muted'])
  pairs.push([fg, 'surface-raised'])
pairs.push(['accent', 'surface'], ['on-accent', 'accent'])
for (const v of VOLUMES) {
  pairs.push([`vol-${v}-ink`, 'surface'], [`vol-${v}-ink`, 'surface-raised'], [`vol-${v}-ink`, `vol-${v}-tint`])
}
for (const c of CALLOUTS)
  pairs.push([`callout-${c}-fg`, `callout-${c}-bg`], ['ink-body', `callout-${c}-bg`])
for (const fg of ['code-fg', 'code-keyword', 'code-string', 'code-number', 'code-comment'])
  pairs.push([fg, 'code-bg'])

let failures = 0
for (const theme of THEMES) {
  for (const [fg, bg] of pairs) {
    const key = `${theme}:${fg}/${bg}`
    const exception = EXCEPTIONS[key]
    const min = exception?.min ?? AA
    const r = ratio(fg, bg, theme)
    if (r < min) {
      failures++
      console.log(`SOTTO SOGLIA  ${key}  ${r.toFixed(2)}:1 < ${min}:1`)
    }
    else if (exception) {
      console.log(`eccezione     ${key}  ${r.toFixed(2)}:1 ≥ ${min}:1 (${exception.why})`)
    }
  }
}

console.log(`${pairs.length * THEMES.length} coppie controllate, ${failures} sotto soglia`)
process.exit(failures ? 1 : 0)
