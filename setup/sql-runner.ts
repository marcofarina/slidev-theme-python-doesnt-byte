// Runner SQL per i blocchi ```sql {monaco-run}``` (fase 14), registrato in
// setup/code-runners.ts.
//
// sql.js (SQLite compilato in WASM) non sta nel bundle del tema né su una CDN:
// `pdb-copy-sqljs` (bin/copy-sqljs.mjs) lo copia in `public/sqljs/` del deck e qui si carica
// da `<base>sqljs/sql-wasm.js` al primo Run, come Pyodide.
//
// Ogni Run è un database nuovo: parte dal dataset del blocco (`dataset=<nome>`, il file
// `<base>sql/<nome>.sql` del deck) o da un database vuoto, con le chiavi esterne attive come
// nel libro, ed esegue le istruzioni nell'ordine. L'output mostra una tabella per ogni
// istruzione che restituisce righe e, dopo INSERT, UPDATE e DELETE, quante righe ha toccato.
// Un errore ferma le istruzioni successive e diventa l'ultima riga dell'output.
//
// Pannello «Database» (`show=<tabella>,…`): le tabelle indicate fotografate prima e dopo le
// istruzioni e confrontate per rowid, con le righe nuove, cambiate e tolte segnate da `+`, `~`
// e `−`, oltre che dal colore. Le opzioni arrivano in `ctx.options` (plugins/sql-options.ts).

import type { CodeRunnerOutputs } from '@slidev/types'

// ── sql.js: solo la parte dell'API che usiamo ────────────────────
type SqlValue = number | string | Uint8Array | null

interface Statement {
  getColumnNames: () => string[]
  getSQL: () => string
  step: () => boolean
  get: () => SqlValue[]
  bind: (values: SqlValue[]) => boolean
  free: () => boolean
}

interface StatementIterator extends Iterator<Statement> {
  [Symbol.iterator]: () => StatementIterator
}

interface Database {
  exec: (sql: string) => unknown
  prepare: (sql: string) => Statement
  iterateStatements: (sql: string) => StatementIterator
  getRowsModified: () => number
  close: () => void
}

interface SqlJs {
  Database: new () => Database
}

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJs>
  }
}

// ── Limiti dell'output, misurati sulla tela ──────────────────────
// Righe di un SELECT prima di «… altre N righe»; righe di una tabella del pannello.
const RESULT_ROWS = 8
const PANEL_ROWS = 5

// Stato del caricamento, per l'etichetta del runner (styles/interactive.css).
const STATE_ATTRIBUTE = 'data-pdb-sql'

export interface SqlRunnerOptions {
  dataset?: string
  show?: string[]
}

let instance: Promise<SqlJs> | undefined
const datasets = new Map<string, Promise<string>>()

function baseURL(folder: string): string {
  return new URL(`${import.meta.env.BASE_URL}${folder}/`, document.baseURI).href
}

class Missing extends Error {}

// Un file assente può tornare 200 con la pagina del deck (ripiego delle rotte di Vite e di
// molti server statici): conta come assente.
async function exists(url: string): Promise<boolean> {
  return fetch(url, { method: 'HEAD' }).then(
    r => r.ok && !r.headers.get('content-type')?.includes('text/html'),
    () => false,
  )
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`${src} non si carica`))
    document.head.append(script)
  })
}

function loadSqlJsOnce(): Promise<SqlJs> {
  if (!instance) {
    const url = baseURL('sqljs')
    instance = (async () => {
      try {
        // sql-wasm.js è uno script classico: definisce `initSqlJs` sulla finestra.
        if (typeof window.initSqlJs !== 'function')
          await loadScript(`${url}sql-wasm.js`)
        if (typeof window.initSqlJs !== 'function')
          throw new Error('sql-wasm.js non definisce initSqlJs')
        return await window.initSqlJs({ locateFile: file => `${url}${file}` })
      }
      catch (error) {
        const found = await exists(`${url}sql-wasm.js`) && await exists(`${url}sql-wasm.wasm`)
        throw found ? error : new Missing()
      }
    })()
    instance.catch(() => instance = undefined)
  }
  return instance
}

function loadDataset(name: string): Promise<string> {
  let text = datasets.get(name)
  if (!text) {
    const url = `${baseURL('sql')}${name}.sql`
    text = fetch(url).then((response) => {
      if (!response.ok || response.headers.get('content-type')?.includes('text/html'))
        throw new Missing()
      return response.text()
    })
    datasets.set(name, text)
    text.catch(() => datasets.delete(name))
  }
  return text
}

// ── Esecuzione ───────────────────────────────────────────────────
interface RowsResult {
  kind: 'rows'
  columns: string[]
  rows: SqlValue[][]
  total: number
}

interface ChangesResult {
  kind: 'changes'
  verb: 'INSERT' | 'UPDATE' | 'DELETE'
  count: number
}

type StatementResult = RowsResult | ChangesResult

const DML = /^\s*(INSERT|REPLACE|UPDATE|DELETE)\b/i

function runStatement(db: Database, statement: Statement): StatementResult | undefined {
  const columns = statement.getColumnNames()
  const rows: SqlValue[][] = []
  let total = 0
  while (statement.step()) {
    total++
    if (rows.length < RESULT_ROWS)
      rows.push(statement.get())
  }
  if (columns.length > 0)
    return { kind: 'rows', columns, rows, total }
  // `getRowsModified` vale per l'ultima INSERT, UPDATE o DELETE: dopo un CREATE TABLE
  // ripeterebbe il numero precedente, quindi si legge solo dopo quelle tre.
  const verb = DML.exec(statement.getSQL())?.[1].toUpperCase()
  if (verb)
    return { kind: 'changes', verb: verb === 'REPLACE' ? 'INSERT' : verb as ChangesResult['verb'], count: db.getRowsModified() }
  return undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── Pannello «Database»: fotografie e confronto ──────────────────
interface Snapshot {
  name: string
  exists: boolean
  columns: string[]
  // rowid → valori; senza rowid (vista, WITHOUT ROWID) le righe non si confrontano.
  rows: Map<number, SqlValue[]> | SqlValue[][]
}

function query(db: Database, sql: string, values: SqlValue[] = []): { columns: string[], rows: SqlValue[][] } {
  const statement = db.prepare(sql)
  try {
    statement.bind(values)
    const rows: SqlValue[][] = []
    while (statement.step())
      rows.push(statement.get())
    return { columns: statement.getColumnNames(), rows }
  }
  finally {
    statement.free()
  }
}

function snapshot(db: Database, wanted: string): Snapshot {
  const found = query(db, `SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name = ? COLLATE NOCASE`, [wanted])
  if (found.rows.length === 0)
    return { name: wanted, exists: false, columns: [], rows: new Map() }
  const name = String(found.rows[0][0])
  const quoted = `"${name.replace(/"/g, '""')}"`
  try {
    const read = query(db, `SELECT _rowid_, * FROM ${quoted} ORDER BY _rowid_`)
    return {
      name,
      exists: true,
      columns: read.columns.slice(1),
      rows: new Map(read.rows.map(row => [Number(row[0]), row.slice(1)])),
    }
  }
  catch {
    const read = query(db, `SELECT * FROM ${quoted}`)
    return { name, exists: true, columns: read.columns, rows: read.rows }
  }
}

type Mark = 'added' | 'changed' | 'removed'

interface PanelRow {
  rowid: number
  values: SqlValue[]
  mark?: Mark
  changed?: Set<number>
}

interface PanelTable {
  name: string
  state: 'kept' | 'created' | 'dropped' | 'missing'
  columns: string[]
  rows: PanelRow[]
  total: number
}

function sameValue(a: SqlValue | undefined, b: SqlValue | undefined): boolean {
  if (a instanceof Uint8Array && b instanceof Uint8Array)
    return a.length === b.length && a.every((byte, i) => byte === b[i])
  return a === b
}

/** Confronta le due fotografie di una tabella per rowid, colonna per colonna (per nome). */
function compare(before: Snapshot, after: Snapshot): PanelTable {
  if (!after.exists) {
    return { name: after.name, state: before.exists ? 'dropped' : 'missing', columns: [], rows: [], total: 0 }
  }
  const state = before.exists ? 'kept' : 'created'
  if (Array.isArray(after.rows)) {
    const rows = after.rows.map((values, rowid) => ({ rowid, values }))
    return { name: after.name, state, columns: after.columns, rows, total: rows.length }
  }
  const old = before.exists && !Array.isArray(before.rows) ? before.rows : new Map<number, SqlValue[]>()
  const oldIndex = new Map(before.columns.map((column, i) => [column, i]))
  const rows: PanelRow[] = []
  for (const [rowid, values] of after.rows) {
    const previous = old.get(rowid)
    if (!previous) {
      rows.push({ rowid, values, mark: 'added' })
      continue
    }
    const changed = new Set<number>()
    after.columns.forEach((column, i) => {
      const j = oldIndex.get(column)
      if (j === undefined || !sameValue(values[i], previous[j]))
        changed.add(i)
    })
    rows.push(changed.size > 0 ? { rowid, values, mark: 'changed', changed } : { rowid, values })
  }
  const total = rows.length
  for (const [rowid, previous] of old) {
    if (!after.rows.has(rowid)) {
      // Una riga tolta si mostra con le colonne di adesso.
      const values = after.columns.map(column => oldIndex.has(column) ? previous[oldIndex.get(column)!] : null)
      rows.push({ rowid, values, mark: 'removed' })
    }
  }
  rows.sort((a, b) => a.rowid - b.rowid)
  return { name: after.name, state, columns: after.columns, rows, total }
}

/** Le righe da mostrare: prima tutte quelle segnate, poi le altre fino al limite, in ordine di rowid. */
function visibleRows(table: PanelTable): PanelRow[] {
  const marked = table.rows.filter(row => row.mark)
  const others = table.rows.filter(row => !row.mark)
  const room = Math.max(PANEL_ROWS - marked.length, 0)
  return [...marked, ...others.slice(0, room)].sort((a, b) => a.rowid - b.rowid)
}

// ── HTML dell'output ─────────────────────────────────────────────
// L'output è un <div class="at-output at-sql"> nostro, come il <pre class="at-output"> del
// runner Python: Slidev lo mostra così com'è. `data-error` dice a pdb-verify che il blocco
// è finito con un errore.

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('it-IT')} ${count === 1 ? one : many}`
}

// Una colonna è numerica se ha almeno un numero e, per il resto, solo NULL: si allinea a destra,
// intestazione compresa.
function numericColumns(columns: string[], rows: SqlValue[][]): boolean[] {
  return columns.map((_, i) =>
    rows.some(row => typeof row[i] === 'number') && rows.every(row => row[i] === null || typeof row[i] === 'number'))
}

function cell(value: SqlValue | undefined, numeric: boolean, extra?: string): string {
  const empty = value === null || value === undefined
  const classes = [empty && 'at-sql__null', numeric && 'at-sql__num', extra].filter(Boolean).join(' ')
  const text = empty
    ? 'NULL'
    : value instanceof Uint8Array ? `‹blob di ${plural(value.length, 'byte', 'byte')}›` : String(value)
  return `<td${classes ? ` class="${classes}"` : ''}>${escapeHtml(text)}</td>`
}

function header(columns: string[], numeric: boolean[], marks: boolean): string {
  const mark = marks ? '<th class="at-db__mark" aria-hidden="true"></th>' : ''
  const cells = columns.map((column, i) => `<th${numeric[i] ? ' class="at-sql__num"' : ''}>${escapeHtml(column)}</th>`)
  return `<thead><tr>${mark}${cells.join('')}</tr></thead>`
}

function renderRows(result: RowsResult): string {
  const numeric = numericColumns(result.columns, result.rows)
  const body = result.rows.map(row => `<tr>${row.map((value, i) => cell(value, numeric[i])).join('')}</tr>`).join('')
  const parts = [`<table class="at-sql__table">${header(result.columns, numeric, false)}<tbody>${body}</tbody></table>`]
  if (result.total === 0)
    parts.push('<div class="at-sql__note">Nessuna riga</div>')
  else if (result.total > result.rows.length)
    parts.push(`<div class="at-sql__note">… ${plural(result.total - result.rows.length, 'altra riga', 'altre righe')}</div>`)
  return parts.join('')
}

const VERBS = {
  INSERT: ['riga inserita', 'righe inserite', 'nessuna riga inserita'],
  UPDATE: ['riga aggiornata', 'righe aggiornate', 'nessuna riga aggiornata'],
  DELETE: ['riga eliminata', 'righe eliminate', 'nessuna riga eliminata'],
} as const

function changesText(result: ChangesResult): string {
  const [one, many, none] = VERBS[result.verb]
  return result.count === 0 ? none : plural(result.count, one, many)
}

/** Più INSERT, UPDATE e DELETE di seguito stanno su una riga sola: «1 riga inserita · 2 righe aggiornate». */
function renderResults(results: StatementResult[]): string[] {
  const parts: string[] = []
  let notes: string[] = []
  const flush = () => {
    if (notes.length > 0) {
      const text = notes.join(' · ')
      parts.push(`<div class="at-sql__note">${text[0].toUpperCase()}${text.slice(1)}.</div>`)
    }
    notes = []
  }
  for (const result of results) {
    if (result.kind === 'changes') {
      notes.push(changesText(result))
      continue
    }
    flush()
    parts.push(renderRows(result))
  }
  flush()
  return parts
}

const MARKS: Record<Mark, { sign: string, word: string }> = {
  added: { sign: '+', word: 'nuova' },
  changed: { sign: '~', word: 'cambiata' },
  removed: { sign: '−', word: 'tolta' },
}

function renderPanelTable(table: PanelTable): string {
  if (table.state === 'missing')
    return `<div class="at-db__name">${escapeHtml(table.name)}</div><div class="at-sql__note">Questa tabella non c’è nel database.</div>`
  if (table.state === 'dropped')
    return `<div class="at-db__name">${escapeHtml(table.name)}</div><div class="at-sql__note">Tabella eliminata.</div>`
  const rows = visibleRows(table)
  const numeric = numericColumns(table.columns, table.rows.map(row => row.values))
  const body = rows.map((row) => {
    const mark = row.mark ? MARKS[row.mark] : undefined
    const sign = `<td class="at-db__mark">${mark ? `<span aria-hidden="true">${mark.sign}</span><span class="at-db__word">${mark.word}</span>` : ''}</td>`
    const cells = row.values.map((value, i) => cell(value, numeric[i], row.changed?.has(i) ? 'at-db__changed' : undefined)).join('')
    return `<tr${row.mark ? ` class="at-db__row--${row.mark}"` : ''}>${sign}${cells}</tr>`
  }).join('')
  // Le righe invariate che non stanno nel limite si contano accanto al nome: una riga in più
  // sotto la tabella non entrerebbe nella slide del risultato.
  const hidden = table.rows.length - rows.length
  const count = `${plural(table.total, 'riga', 'righe')}${hidden > 0 ? `, ${plural(hidden, 'non mostrata', 'non mostrate')}` : ''}`
  const badge = table.state === 'created' ? ' <span class="at-db__badge">nuova</span>' : ''
  return [
    `<div class="at-db__name">${escapeHtml(table.name)}${badge} <span class="at-db__count">${count}</span></div>`,
    `<table class="at-sql__table at-db__table">${header(table.columns, numeric, true)}<tbody>${body}</tbody></table>`,
  ].join('')
}

function renderPanel(tables: PanelTable[]): string {
  const used = new Set(tables.flatMap(table => table.rows.flatMap(row => row.mark ? [row.mark] : [])))
  const legend = used.size > 0
    ? (['added', 'changed', 'removed'] as Mark[]).filter(mark => used.has(mark)).map(mark => `${MARKS[mark].sign} ${MARKS[mark].word}`).join(' · ')
    : 'Nessuna riga cambiata'
  const body = tables.map(table => `<div class="at-db__item">${renderPanelTable(table)}</div>`).join('')
  return `<section class="at-db" aria-label="Database"><div class="at-db__title">Database <span class="at-db__legend">${escapeHtml(legend)}</span></div><div class="at-db__tables">${body}</div></section>`
}

function render(results: StatementResult[], error: string | undefined, panel: PanelTable[] | undefined): CodeRunnerOutputs {
  const parts = renderResults(results)
  if (error)
    parts.push(`<div class="at-output__err">${escapeHtml(error)}</div>`)
  if (panel)
    parts.push(renderPanel(panel))
  if (parts.length === 0)
    return { html: '<pre class="at-output at-output--empty">Nessun output</pre>' }
  return { html: `<div class="at-output at-sql"${error ? ' data-error' : ''}>${parts.join('')}</div>` }
}

function failure(message: string): CodeRunnerOutputs {
  return render([], message, undefined)
}

export async function runSql(code: string, options: SqlRunnerOptions): Promise<CodeRunnerOutputs> {
  // Se sql.js è già carico, `loading` e `ready` cambiano nello stesso task: nessun lampo.
  const root = document.documentElement
  root.setAttribute(STATE_ATTRIBUTE, 'loading')
  let SQL: SqlJs
  try {
    SQL = await loadSqlJsOnce()
    root.setAttribute(STATE_ATTRIBUTE, 'ready')
  }
  catch (error) {
    root.setAttribute(STATE_ATTRIBUTE, 'failed')
    console.error('[python-doesnt-byte] sql.js non si carica:', error)
    if (error instanceof Missing)
      return failure(`sql.js non è nel deck (${baseURL('sqljs')}). Esegui «npx pdb-copy-sqljs» nella cartella del deck, poi ricarica la pagina.`)
    return failure(`sql.js non si avvia: ${errorMessage(error)}`)
  }

  let seed = ''
  if (options.dataset) {
    try {
      seed = await loadDataset(options.dataset)
    }
    catch (error) {
      if (error instanceof Missing)
        return failure(`Il dataset «${options.dataset}» non è nel deck: manca public/sql/${options.dataset}.sql.`)
      return failure(`Il dataset «${options.dataset}» non si legge: ${errorMessage(error)}`)
    }
  }

  const db = new SQL.Database()
  try {
    db.exec('PRAGMA foreign_keys = ON;')
    if (seed) {
      try {
        db.exec(seed)
      }
      catch (error) {
        return failure(`Il dataset «${options.dataset}» non si carica: ${errorMessage(error)}`)
      }
    }

    const show = options.show ?? []
    const before = show.map(name => snapshot(db, name))
    const results: StatementResult[] = []
    let error: string | undefined
    try {
      for (const statement of db.iterateStatements(code)) {
        const result = runStatement(db, statement)
        if (result)
          results.push(result)
      }
    }
    catch (raised) {
      error = `Errore: ${errorMessage(raised)}`
    }
    const panel = show.length > 0 ? show.map((name, i) => compare(before[i], snapshot(db, name))) : undefined
    return render(results, error, panel)
  }
  finally {
    db.close()
  }
}
