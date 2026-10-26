// Glossario: il `glossary` nel frontmatter di una slide aggiunge un tooltip a ogni
// occorrenza del termine nel testo della slide.
//
//   ---
//   glossary:
//     tupla: Sequenza di valori che non si può modificare.
//   ---
//
// `applyGlossary` è una funzione pura sul Markdown della slide; `glossaryTransformer` la
// collega a Slidev (registrata in `setup/transformers.ts`), che passa alla trasformazione
// la slide con il suo frontmatter. Il termine si cerca a parola intera e con maiuscole
// esatte. Restano fuori: blocchi di codice e codice inline, titoli, formule `$…$`, tag HTML
// e componenti, interpolazioni `{{ }}`, destinazioni di link, commenti (note del relatore).

import type { MarkdownTransformer } from '@slidev/types'

type Glossary = Record<string, string>

// Tratti di una riga di testo in cui non si sostituisce niente. Ordine: dal più lungo al più corto.
const skipInline = new RegExp(
  [
    '^#{1,6}[ \\t].*$', // titolo
    '<!--[\\s\\S]*?-->', // commento
    '(`+)(?!`)[\\s\\S]*?(?<!`)\\1(?!`)', // codice inline
    '\\$\\$[\\s\\S]*?\\$\\$', // formula in blocco
    '\\$[^$\\n]+\\$', // formula inline
    '\\{\\{[\\s\\S]*?\\}\\}', // interpolazione Vue
    '<[^>\\n]*>', // tag HTML o componente, attributi compresi
    '\\]\\([^)\\n]*\\)', // destinazione di un link o di un'immagine
  ].join('|'),
  'gm',
)

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeAttribute(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;')
}

// Applica `fn` ai tratti di `text` che non corrispondono a `skip`.
function mapOutside(text: string, skip: RegExp, fn: (part: string) => string): string {
  let out = ''
  let last = 0
  for (const match of text.matchAll(skip)) {
    out += fn(text.slice(last, match.index)) + match[0]
    last = match.index + match[0].length
  }
  return out + fn(text.slice(last))
}

// Divide il Markdown in righe dentro e fuori dai blocchi di codice recintati (``` e ~~~).
function mapOutsideFences(content: string, fn: (run: string) => string): string {
  const out: string[] = []
  let run: string[] = []
  let fence: string | null = null
  const flush = () => {
    if (run.length)
      out.push(fn(run.join('\n')))
    run = []
  }
  for (const line of content.split('\n')) {
    if (fence === null) {
      const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)
      if (open) {
        flush()
        fence = open[1]
        out.push(line)
      }
      else {
        run.push(line)
      }
    }
    else {
      out.push(line)
      const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`)
      if (close.test(line))
        fence = null
    }
  }
  flush()
  return out.join('\n')
}

export function applyGlossary(content: string, glossary: Glossary): string {
  const terms = Object.keys(glossary).filter(term => term && glossary[term]?.trim())
  if (!terms.length)
    return content

  // Un solo passaggio con tutti i termini, dal più lungo: il testo già sostituito
  // (e la definizione nell'attributo) non viene riletto, quindi i tooltip non si annidano.
  const alternatives = terms.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')
  const term = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'gu')
  const wrap = (match: string) => `<Tooltip text="${escapeAttribute(glossary[match])}">${match}</Tooltip>`

  return mapOutsideFences(content, run => mapOutside(run, skipInline, part => part.replace(term, wrap)))
}

// Il glossario deve essere una mappa termine → definizione: altrimenti la build si ferma.
export function readGlossary(value: unknown, where: string): Glossary | null {
  if (value === undefined || value === null)
    return null
  const isMap = typeof value === 'object' && !Array.isArray(value)
  if (!isMap || !Object.values(value).every(definition => typeof definition === 'string'))
    throw new Error(`[python-doesnt-byte] il glossary di ${where} deve essere una mappa «termine: definizione» di testi.`)
  return value as Glossary
}

export const glossaryTransformer: MarkdownTransformer = (ctx) => {
  const glossary = readGlossary(ctx.slide.frontmatter?.glossary, `slide ${ctx.slide.index + 1}`)
  if (!glossary)
    return
  const code = ctx.s.original
  const result = applyGlossary(code, glossary)
  if (result !== code)
    ctx.s.overwrite(0, code.length, result)
}
