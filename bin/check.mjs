#!/usr/bin/env node
// Controllo strutturale dei deck, senza compilare (fase 12).
// Uso: `npx pdb-check <deck.md…>`. Per ogni difetto stampa una riga
//   ✗ <file>: slide N: <motivo>
// ed esce con 1; se non ne trova, stampa «✓ <file>» e esce con 0. N è il numero della slide
// nel deck (quello del footer), <file> il file in cui la slide è scritta (segue i `src:`).
//
// Legge il deck con @slidev/parser. Layout, slot e volumi si leggono dal tema stesso
// (layouts/*.vue, composables/frame.ts), non da elenchi scritti qui.

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { basename, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { injectPreparserExtensionLoader, load } from '@slidev/parser/fs'
import { addResultSlides } from '../setup/result-slides.mjs'

// Le slide del risultato (`output: next`) le aggiunge il preparser del tema: qui si aggiungono
// allo stesso modo, così i numeri delle slide sono quelli di Slidev e le slide generate si
// controllano come le altre.
injectPreparserExtensionLoader(async () => [{ name: 'python-doesnt-byte:result', transformRawLines: addResultSlides }])

const themeFile = path => fileURLToPath(new URL(`../${path}`, import.meta.url))

// Il massimo di righe di un blocco di codice: 11 con il solo titolo (vedi «Fatti verificati»
// del piano); con kicker e titolo ne stanno 10.
export const MAX_CODE_LINES = 11

// ── Il tema ──────────────────────────────────────────────────────

function themeLayouts() {
  const layouts = new Map()
  for (const name of readdirSync(themeFile('layouts'))) {
    if (!name.endsWith('.vue'))
      continue
    const source = readFileSync(themeFile(`layouts/${name}`), 'utf8')
    const slots = [...source.matchAll(/<slot\s+name="([\w-]+)"/g)].map(match => match[1])
    // Uno slot provato con `$slots.nome` (come ::caption:: di figure) è facoltativo.
    const optional = new Set([...source.matchAll(/\$slots(?:\.([\w-]+)|\[['"]([\w-]+)['"]\])/g)].map(match => match[1] ?? match[2]))
    layouts.set(name.replace(/\.vue$/, ''), { slots: new Set(slots), mandatory: slots.filter(slot => !optional.has(slot)) })
  }
  return layouts
}

function themeVolumes() {
  const source = readFileSync(themeFile('composables/frame.ts'), 'utf8')
  const keys = [...source.matchAll(/^\s+(\w+):\s*\{\s*number:/gm)].map(match => match[1])
  if (keys.length === 0)
    throw new Error('composables/frame.ts: non trovo la tabella dei volumi')
  return keys
}

// ── Il sorgente di una slide ─────────────────────────────────────

/** Separa il contenuto in righe di testo e righe di codice (dentro i blocchi ``` e ~~~). */
function scan(content) {
  const text = []
  const blocks = []
  let runnable = 0
  let fence
  for (const line of content.split('\n')) {
    if (!fence) {
      const open = /^\s*(`{3,}|~{3,})/.exec(line)
      if (open && /\{monaco-run\}/.test(line))
        runnable++
      if (open)
        fence = { char: open[1][0], size: open[1].length, lang: line.trim().slice(open[1].length).trim().split(/[\s{]/)[0], lines: [] }
      else
        text.push(line)
      continue
    }
    const close = new RegExp(`^\\s*${fence.char}{${fence.size},}\\s*$`).test(line)
    if (close) {
      while (fence.lines.length > 0 && fence.lines.at(-1).trim() === '')
        fence.lines.pop()
      // I diagrammi Mermaid hanno la loro misura: non sono codice da leggere riga per riga.
      if (fence.lang !== 'mermaid')
        blocks.push(fence.lines.length)
      fence = undefined
    }
    else {
      fence.lines.push(line)
    }
  }
  if (fence && fence.lang !== 'mermaid')
    blocks.push(fence.lines.length)
  return { text, blocks, runnable }
}

const withoutInlineCode = line => line.replace(/(`+)(?:(?!\1).)+\1/g, '')

// ── Controlli ────────────────────────────────────────────────────

export function checkSlide(slide, number, theme) {
  const errors = []
  const fm = slide.frontmatter ?? {}
  const layout = fm.layout ?? (number === 1 ? 'cover' : 'default')
  const known = theme.layouts.get(layout)
  if (!known)
    errors.push(`layout «${layout}» non esiste nel tema (validi: ${[...theme.layouts.keys()].join(', ')})`)

  for (const [key, value] of Object.entries(fm)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      continue
    if (key === 'glossary') {
      for (const [term, definition] of Object.entries(value)) {
        if (definition !== null && typeof definition === 'object')
          errors.push(`glossary: la definizione di «${term}» contiene «: » e va tra virgolette`)
      }
    }
    else {
      errors.push(`\`${key}:\` contiene «: » ed è diventato un oggetto: va tra virgolette`)
    }
  }

  if (fm.verify !== undefined && !['error', 'skip'].includes(String(fm.verify)))
    errors.push(`verify: «${fm.verify}» non è valido (error o skip)`)

  const { text, blocks, runnable } = scan(slide.content ?? '')

  if (fm.output !== undefined) {
    if (String(fm.output) !== 'next')
      errors.push(`output: «${fm.output}» non è valido (solo next)`)
    else if (runnable === 0)
      errors.push('`output: next` senza un blocco eseguibile ({monaco-run}): non c’è un risultato da mostrare')
  }

  const used = text.flatMap(line => [...line.matchAll(/^::([\w-]+)::\s*$/g)].map(match => match[1]))
  if (known) {
    for (const slot of new Set(used)) {
      if (slot !== 'default' && !known.slots.has(slot))
        errors.push(`${layout}: lo slot ::${slot}:: non esiste${known.slots.size > 0 ? ` (quelli del layout: ${[...known.slots].map(name => `::${name}::`).join(', ')})` : ' (il layout non ne ha)'}`)
    }
    // Un layout con un solo slot nominato lo lascia libero; con due o più li vuole tutti.
    if (known.mandatory.length > 1) {
      for (const slot of known.mandatory) {
        if (!used.includes(slot))
          errors.push(`${layout}: manca lo slot ::${slot}::`)
      }
    }
  }

  if (layout === 'question') {
    const tags = text.flatMap(line => [...line.matchAll(/<Options\b([^>]*)>/g)].map(match => match[1]))
    if (tags.length > 1)
      errors.push(`question: ${tags.length} <Options>, ne serve una sola`)
    for (const attributes of tags) {
      if (!/(?:^|\s):?answer\s*=/.test(attributes))
        errors.push('question: <Options> senza `answer`')
    }
  }

  // Nel markdown `__x__` diventa grassetto: `# __str__` uscirebbe «str».
  for (const line of text) {
    if (/^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)/.test(line) && /__\w+__/.test(withoutInlineCode(line)))
      errors.push(`«${line.trim()}»: i nomi con __ vanno tra backtick (per esempio \`__init__\`)`)
  }

  for (const lines of blocks) {
    if (lines > MAX_CODE_LINES)
      errors.push(`blocco di codice di ${lines} righe (massimo ${MAX_CODE_LINES}): dividilo o evidenzia per passi`)
  }
  return errors
}

export function checkHeadmatter(head) {
  const errors = []
  const volumes = themeVolumes()
  if (!volumes.includes(String(head.volume ?? '').trim().toLowerCase()))
    errors.push(`volume «${head.volume ?? ''}» non è valido (${volumes.join(', ')})`)
  const chapter = head.chapter
  if (!(Number.isInteger(chapter) || (typeof chapter === 'string' && /^\d+$/.test(chapter.trim()))))
    errors.push(`chapter «${chapter ?? ''}» non è un numero`)
  if (typeof head.lesson !== 'string' || head.lesson.trim() === '')
    errors.push('manca `lesson` (il titolo della lezione nel footer)')
  if (typeof head.lessonUrl !== 'string' || !head.lessonUrl.startsWith('https://'))
    errors.push(`lessonUrl «${head.lessonUrl ?? ''}» deve cominciare con https://`)
  return errors
}

/** Gli errori di un deck come [{ file, where, message }]. */
export async function checkDeck(entry) {
  const shown = file => relative(process.cwd(), file) || basename(file)
  let deck
  try {
    deck = await load(process.cwd(), entry)
  }
  catch (error) {
    return { slides: 0, problems: [{ file: shown(entry), where: '', message: `non si legge: ${error.message}` }] }
  }
  const theme = { layouts: themeLayouts() }
  const problems = checkHeadmatter(deck.headmatter ?? {}).map(message => ({ file: shown(entry), where: 'headmatter', message }))
  deck.slides.forEach((slide, index) => {
    const messages = checkSlide(slide, index + 1, theme)
    // La slide del risultato la genera il tema dopo una slide con `output: next`.
    if (slide.frontmatter?.layout === 'result' && String(deck.slides[index - 1]?.frontmatter?.output) !== 'next')
      messages.push('il layout «result» non si scrive a mano: metti `output: next` nella slide del codice')
    for (const message of messages)
      problems.push({ file: shown(slide.source?.filepath ?? entry), where: `slide ${index + 1}`, message })
  })
  return { slides: deck.slides.length, problems }
}

// ── Riga di comando ──────────────────────────────────────────────

async function main(decks) {
  if (decks.length === 0) {
    console.error('Uso: pdb-check <deck.md…>')
    process.exit(2)
  }
  let failed = false
  for (const deck of decks) {
    if (!existsSync(deck)) {
      console.error(`✗ ${deck}: il file non esiste`)
      failed = true
      continue
    }
    const { slides, problems } = await checkDeck(deck)
    for (const { file, where, message } of problems)
      console.error(`✗ ${file}: ${where ? `${where}: ` : ''}${message}`)
    if (problems.length === 0)
      console.log(`✓ ${deck} (${slides} slide)`)
    else
      failed = true
  }
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]))
  await main(process.argv.slice(2))
