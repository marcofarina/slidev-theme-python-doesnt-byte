// Genera styles/tokens.css da tokens/tokens.json (copia dei token di Atmospheric).
// Uso: npm run tokens. Il file generato si committa: chi usa il tema non esegue lo script.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)
const source = fileURLToPath(new URL('tokens/tokens.json', root))
const target = fileURLToPath(new URL('styles/tokens.css', root))

const tokens = JSON.parse(readFileSync(source, 'utf8'))

const VOLUMES = ['programmatore', 'artefice', 'archivista', 'apprendista']

// Valori per tema che tokens.json non porta come coppia ma descrive nell'uso del token:
// `glow-opacity` vale 0.55 in light e 1 in dark (vedi `usage` del token e bundle.css).
const DARK_OVERRIDES = { 'glow-opacity': '1' }

// `{accent}` → `var(--accent)`; gli altri valori passano invariati.
function resolve(value) {
  return String(value).replace(/\{([a-z0-9-]+)\}/g, (_, name) => `var(--${name})`)
}

function isThemed(value) {
  return value !== null && typeof value === 'object'
}

const light = []
const dark = []
const shared = []

function add(name, value) {
  if (isThemed(value)) {
    light.push([name, resolve(value.light)])
    dark.push([name, resolve(value.dark)])
  } else {
    shared.push([name, resolve(value)])
    if (DARK_OVERRIDES[name] !== undefined)
      dark.push([name, DARK_OVERRIDES[name]])
  }
}

for (const t of tokens.color.tokens) add(t.name, t.value)
for (const t of tokens.shadow.tokens) add(t.name, t.value)
for (const t of tokens.spacing.tokens) add(t.name, t.value)
for (const t of tokens.radius.tokens) add(t.name, t.value)
for (const t of tokens.slide.tokens) add(t.name, t.value)

for (const [family, stack] of Object.entries(tokens.type.families))
  shared.push([`font-${family}`, stack])

// Stili di testo: --type-<nome>-family / -size / -line / -weight / -tracking / -style.
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    const prefix = `type-${style.name}`
    shared.push([`${prefix}-family`, `var(--font-${style.family ?? group.family})`])
    shared.push([`${prefix}-size`, style.fontSize])
    shared.push([`${prefix}-line`, style.lineHeight])
    shared.push([`${prefix}-weight`, String(style.fontWeight)])
    if (style.letterSpacing)
      shared.push([`${prefix}-tracking`, style.letterSpacing])
    if (style.fontStyle)
      shared.push([`${prefix}-style`, style.fontStyle])
  }
}

// Variabili derivate dal volume, come in bundle.css. Senza volume: accent e grad-1…3.
const volumeDefaults = [
  ['vol', 'var(--accent)'],
  ['vol-ink', 'var(--accent)'],
  ['vol-tint', 'var(--accent-tint)'],
  ['beam-1', 'var(--grad-1)'],
  ['beam-2', 'var(--grad-2)'],
  ['beam-3', 'var(--grad-3)'],
]

function volumeVars(key) {
  return [
    ['vol', `var(--vol-${key})`],
    ['vol-ink', `var(--vol-${key}-ink)`],
    ['vol-tint', `var(--vol-${key}-tint)`],
    ['beam-1', `var(--vol-${key}-beam-1)`],
    ['beam-2', `var(--vol-${key}-beam-2)`],
    ['beam-3', `var(--vol-${key}-beam-3)`],
  ]
}

function block(selector, entries) {
  const body = entries.map(([name, value]) => `  --${name}: ${value};`).join('\n')
  return `${selector} {\n${body}\n}\n`
}

const out = [
  `/* Generato da scripts/build-tokens.mjs a partire da tokens/tokens.json.\n`
  + `   Non modificare a mano: correggi i token e rilancia \`npm run tokens\`. */\n`,
  '/* Tema chiaro (predefinito) */',
  block(':root,\nhtml:not(.dark)', light),
  '/* Tema scuro: Slidev mette la classe `dark` su <html> */',
  block('html.dark', dark),
  '/* Valori uguali nei due temi */',
  block(':root', shared),
  '/* Volume: si attiva con data-volume="<chiave>" su un antenato */',
  block(':root', volumeDefaults),
  ...VOLUMES.map(key => block(`[data-volume='${key}']`, volumeVars(key))),
].join('\n')

writeFileSync(target, out)
console.log(`styles/tokens.css: ${light.length} token per tema, ${shared.length} condivisi, ${VOLUMES.length} volumi`)
