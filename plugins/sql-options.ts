// Opzioni dei blocchi SQL eseguibili (fase 14): il dataset da cui parte ogni Run e le tabelle
// del pannello «Database». Si scrivono dopo `{monaco-run}`, come nei blocchi `sql live` del
// libro:
//
//   ```sql {monaco-run} {autorun:false} dataset=hogwarts show=studente,casa
//
// Il runner (setup/sql-runner.ts) le riceve in `ctx.options`, cioè dalla prop `runnerOptions`
// di Monaco. Slidev però copia le opzioni tra graffe in un `v-bind` fino alla prima `}`
// (RE_MONACO), quindi `{runnerOptions: { dataset: 'hogwarts' }}` non compila. Questa
// trasformazione riscrive la riga in
//
//   ```sql {monaco-run} {autorun:false, runnerOptions: Object.fromEntries([['dataset','hogwarts'],['show',['studente','casa']]])}
//
// che non ha graffe annidate. È una funzione pura sul Markdown della slide; il transformer
// la collega a Slidev (registrato in `setup/transformers.ts`, dopo il glossario).

import type { MarkdownTransformer } from '@slidev/types'

const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/
const SQL_RUN = /^(\s*sql\s*\{monaco-run\})\s*(\{[^}]*\})?(.*)$/
const DATASET = /^[\w-]+(?:\/[\w-]+)*$/
const TABLE = /^\w+$/

export interface SqlOptions {
  dataset?: string
  show?: string[]
}

/** Legge `dataset=… show=…` dal resto della riga d'apertura; un errore dice che cosa non va. */
export function parseSqlOptions(rest: string): SqlOptions {
  const options: SqlOptions = {}
  for (const word of rest.trim().split(/\s+/).filter(Boolean)) {
    const [key, value = ''] = word.split(/=(.*)/s)
    if (key === 'dataset') {
      if (!DATASET.test(value))
        throw new Error(`dataset «${value}» non valido: lettere, cifre, - e _, con / per le sottocartelle di public/sql/`)
      options.dataset = value
    }
    else if (key === 'show') {
      const tables = value.split(',').filter(Boolean)
      if (tables.length === 0 || !tables.every(name => TABLE.test(name)))
        throw new Error(`show «${value}» non valido: nomi di tabella separati da virgole, senza spazi`)
      options.show = tables
    }
    else {
      throw new Error(`opzione «${word}» sconosciuta (valide: dataset=<nome>, show=<tabella>,<tabella>)`)
    }
  }
  return options
}

function quote(text: string): string {
  return `'${text}'`
}

/** L'espressione senza graffe che Vue valuta come `runnerOptions`. */
function optionsExpression(options: SqlOptions): string {
  const entries: string[] = []
  if (options.dataset)
    entries.push(`[${quote('dataset')},${quote(options.dataset)}]`)
  if (options.show)
    entries.push(`[${quote('show')},[${options.show.map(quote).join(',')}]]`)
  return `Object.fromEntries([${entries.join(',')}])`
}

/** Riscrive le righe d'apertura dei blocchi ```sql {monaco-run}; il resto del Markdown non cambia. */
export function applySqlOptions(markdown: string): string {
  const lines = markdown.split('\n')
  let open: { char: string, length: number } | undefined
  for (const [index, line] of lines.entries()) {
    const fence = FENCE.exec(line)
    if (open) {
      // Chiude solo una recinzione dello stesso carattere, lunga almeno quanto quella d'apertura.
      if (fence && fence[2][0] === open.char && fence[2].length >= open.length && fence[3].trim() === '')
        open = undefined
      continue
    }
    if (!fence)
      continue
    open = { char: fence[2][0], length: fence[2].length }
    const run = SQL_RUN.exec(fence[3])
    if (!run || run[3].trim() === '')
      continue
    let options: SqlOptions
    try {
      options = parseSqlOptions(run[3])
    }
    catch (error) {
      throw new Error(`[python-doesnt-byte] blocco sql alla riga ${index + 1}: ${(error as Error).message}`)
    }
    const inner = run[2] ? run[2].slice(1, -1).trim() : ''
    if (/(?:^|[,\s])runnerOptions\s*:/.test(inner))
      throw new Error(`[python-doesnt-byte] blocco sql alla riga ${index + 1}: usa dataset= e show= oppure runnerOptions, non tutti e due`)
    const bound = [inner, `runnerOptions: ${optionsExpression(options)}`].filter(Boolean).join(', ')
    lines[index] = `${fence[1]}${fence[2]}${run[1]} {${bound}}`
  }
  return lines.join('\n')
}

export const sqlOptionsTransformer: MarkdownTransformer = (ctx) => {
  // Dopo il glossario, che sovrascrive tutta la slide: si parte dal suo risultato.
  const code = ctx.s.toString()
  let result: string
  try {
    result = applySqlOptions(code)
  }
  catch (error) {
    throw new Error(`${(error as Error).message} (slide ${ctx.slide.index + 1})`)
  }
  if (result !== code)
    ctx.s.overwrite(0, ctx.s.original.length, result)
}
