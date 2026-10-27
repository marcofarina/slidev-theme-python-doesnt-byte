// La slide del risultato (fase 13).
//
// Una slide con `output: next` nel frontmatter e un blocco ```… {monaco-run} riceve subito
// dopo una slide generata: layout `result`, titolo «<titolo della slide>: il risultato», lo
// stesso blocco con `autorun:true`. Il layout nasconde l'editor e dà all'output tutta l'altezza.
// Nella slide del codice «Esegui» porta alla slide generata (components/SlideFrame.vue).
//
// La trasformazione lavora sulle righe grezze di un file markdown, prima che Slidev le divida in
// slide: la usano il preparser del tema (setup/preparser.ts) e bin/check.mjs e bin/verify.mjs,
// che devono contare le stesse slide che conta Slidev. È JavaScript e non TypeScript perché
// Node non toglie i tipi ai file dentro node_modules, dove il tema sta quando lo usa un deck.

export const RESULT_LAYOUT = 'result'
export const RESULT_SUFFIX = ': il risultato'

// Chiavi del frontmatter che valgono anche per la slide generata: `verify` perché il blocco si
// esegue lì, le altre perché un deck può cambiare volume o lezione per una sola slide.
const COPIED_KEYS = ['verify', 'volume', 'chapter', 'lesson', 'lessonUrl']

const RUNNABLE = /^(\s*(?:`{3,}|~{3,})\s*[\w'-]*\s*\{monaco-run\})\s*(\{[^}]*\})?(.*)$/

function openFence(line) {
  const match = /^\s*(`{3,}|~{3,})/.exec(line)
  return match && { char: match[1][0], size: match[1].length }
}

function closesFence(fence, line) {
  return new RegExp(`^\\s*${fence.char}{${fence.size},}\\s*$`).test(line)
}

// Lo stesso conteggio dei commenti HTML di @slidev/parser: un `---` dentro un commento (le note
// del relatore) non separa le slide.
function insideComment(line, open) {
  let cursor = 0
  while (cursor < line.length) {
    if (open) {
      const end = line.indexOf('-->', cursor)
      if (end < 0)
        return true
      open = false
      cursor = end + 3
    }
    else {
      const start = line.indexOf('<!--', cursor)
      if (start < 0)
        return false
      const end = line.indexOf('-->', start + 4)
      if (end < 0)
        return true
      cursor = end + 3
    }
  }
  return open
}

/**
 * Le slide di un file come intervalli di righe: `start` è il separatore (o 0), `frontmatter` le
 * righe fra i due `---`, `body` la prima riga del contenuto, `end` il separatore successivo (o la
 * fine). Stesse regole di @slidev/parser, più i recinti ~~~, che Slidev non salta.
 */
export function splitSlides(lines) {
  const slides = []
  let start = 0
  let body = 0
  let frontmatter = [0, 0]
  let fence
  let comment = false
  const close = (end) => {
    if (end > start)
      slides.push({ start, frontmatter, body, end })
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (fence) {
      if (closesFence(fence, line))
        fence = undefined
      continue
    }
    if (comment) {
      comment = insideComment(line, true)
      continue
    }
    const trimmed = line.trimEnd()
    if (trimmed.startsWith('---')) {
      close(i)
      start = i
      frontmatter = [i + 1, i + 1]
      if (trimmed[3] !== '-' && lines[i + 1]?.trim()) {
        let j = i + 1
        while (j < lines.length && lines[j].trimEnd() !== '---')
          j++
        frontmatter = [i + 1, j]
        i = j
      }
      body = i + 1
      continue
    }
    fence = openFence(line)
    if (!fence)
      comment = insideComment(line, false)
  }
  close(lines.length)
  return slides
}

/** Il valore di una chiave semplice del frontmatter (`chiave: valore`), senza virgolette. */
function scalar(lines, key) {
  for (const line of lines) {
    const match = new RegExp(`^${key}\\s*:\\s*(.*?)\\s*(?:\\s#.*)?$`).exec(line)
    if (match)
      return match[1].replace(/^(['"])(.*)\1$/, '$2')
  }
  return undefined
}

/** Il titolo (`# …` fuori dai blocchi di codice) e i blocchi eseguibili del corpo di una slide. */
function scanBody(lines) {
  let title
  const blocks = []
  let fence
  let comment = false
  for (const line of lines) {
    if (fence) {
      fence.lines.push(line)
      if (closesFence(fence, line)) {
        if (fence.runnable)
          blocks.push(fence.lines)
        fence = undefined
      }
      continue
    }
    if (comment) {
      comment = insideComment(line, true)
      continue
    }
    const open = openFence(line)
    if (open) {
      fence = { ...open, runnable: RUNNABLE.test(line), lines: [line] }
      continue
    }
    comment = insideComment(line, false)
    const heading = /^#\s+(.+?)(?:\s+#+)?\s*$/.exec(line)
    if (heading && title === undefined)
      title = heading[1]
  }
  return { title, blocks }
}

/** La riga d'apertura del blocco nella slide generata: parte da sola, subito. */
function autorunFence(line) {
  const [, head, options = '', rest] = RUNNABLE.exec(line)
  const kept = options.slice(1, -1).split(',').map(entry => entry.trim())
    .filter(entry => entry && !/^['"]?(?:autorun|showOutputAt)['"]?\s*:/.test(entry))
  return `${head} {${[...kept, 'autorun:true'].join(', ')}}${rest}`
}

/** `true` se il frontmatter chiede la slide del risultato. */
export function wantsResult(frontmatterLines) {
  return scalar(frontmatterLines, 'output') === 'next'
}

/**
 * Aggiunge, nel posto, le slide del risultato a un file markdown diviso in righe. Restituisce
 * quante ne ha aggiunte. Una slide con `output: next` ma senza blocchi eseguibili non ne riceve:
 * lo segnala pdb-check. Nemmeno una slide nascosta (`hide`, `disabled`).
 */
export function addResultSlides(lines) {
  const slides = splitSlides(lines)
  let added = 0
  // Dall'ultima alla prima: le righe inserite non spostano le slide ancora da guardare.
  for (const slide of slides.reverse()) {
    const frontmatter = lines.slice(...slide.frontmatter)
    if (!wantsResult(frontmatter))
      continue
    if (['true', 'yes'].includes(scalar(frontmatter, 'hide')) || ['true', 'yes'].includes(scalar(frontmatter, 'disabled')))
      continue
    const { title, blocks } = scanBody(lines.slice(slide.body, slide.end))
    if (blocks.length === 0)
      continue

    const heading = title ? `${title.replace(/[\s?.:!…]+$/, '')}${RESULT_SUFFIX}` : 'Il risultato'
    const copied = frontmatter.filter(line => COPIED_KEYS.some(key => new RegExp(`^${key}\\s*:`).test(line)))
    const generated = [
      '---',
      `layout: ${RESULT_LAYOUT}`,
      ...copied,
      '---',
      '',
      `# ${heading}`,
      '',
      ...blocks.flatMap((block, index) => [
        ...(index > 0 ? [''] : []),
        autorunFence(block[0]),
        ...block.slice(1),
      ]),
      '',
    ]
    lines.splice(slide.end, 0, ...generated)
    added++
  }
  return added
}
