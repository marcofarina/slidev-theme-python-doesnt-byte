// Il runner SQL funziona senza rete (fase 14). Uso: npm run test:sql.
//
// Compila example.md (prebuild copia sql.js in public/sqljs/), serve dist/ su 127.0.0.1 e apre
// il deck in Chromium bloccando ogni richiesta che non sia locale. Le slide SQL di
// examples/sql.md sono tre, nell'ordine:
//   1. un SELECT: si preme Esegui e si confrontano le righe della tabella;
//   2. INSERT, UPDATE e DELETE con il pannello «Database» e `output: next`: Esegui porta alla
//      slide del risultato, dove si controllano le righe segnate +, ~ e − e la legenda;
//   3. un INSERT che viola la chiave esterna (`verify: error`): si controlla il messaggio.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { injectPreparserExtensionLoader, load } from '@slidev/parser/fs'
import { chromium } from 'playwright-chromium'
import { serve } from '../bin/deck-tools.mjs'
import { addResultSlides } from '../setup/result-slides.mjs'

// I numeri delle slide contano anche quelle del risultato, come in Slidev.
injectPreparserExtensionLoader(async () => [{ name: 'python-doesnt-byte:result', transformRawLines: addResultSlides }])

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const entry = join(root, 'example.md')

const SELECT = [
  ['nome', 'casa'],
  ['Draco Malfoy', 'Serpeverde'],
  ['Hermione Granger', 'Grifondoro'],
  ['Neville Longbottom', 'Grifondoro'],
]
// Le righe segnate del pannello, nell'ordine di rowid: segno, valori, celle cambiate.
const PANEL = [
  { sign: '−', values: ['3', 'Cedric Diggory', 'Tassorosso', '6'], changed: [] },
  { sign: '~', values: ['5', 'Ginny Weasley', 'Grifondoro', '5'], changed: ['5'] },
  { sign: '+', values: ['7', 'Luna Lovegood', 'Corvonero', '4'], changed: [] },
]
const NOTE = '1 riga inserita · 1 riga aggiornata · 1 riga eliminata.'
const LEGEND = '+ nuova · ~ cambiata · − tolta'
const ERROR = 'Errore: FOREIGN KEY constraint failed'

let failures = 0
function check(ok, success, failure) {
  if (ok) {
    console.log(`✓ ${success}`)
  }
  else {
    console.error(`✗ ${failure}`)
    failures++
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── Build ────────────────────────────────────────────────────────
const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
if (build.status !== 0) {
  console.error('✗ npm run build non è andato a buon fine')
  process.exit(1)
}
if (!existsSync(join(dist, 'sqljs', 'sql-wasm.wasm'))) {
  console.error('✗ dist/sqljs/sql-wasm.wasm non c’è: sql.js non è nella build')
  process.exit(1)
}

const { slides } = await load(root, entry)
const numbers = slides.flatMap((slide, index) =>
  slide.frontmatter.layout !== 'result' && /```sql\s*\{monaco-run\}/.test(slide.content) ? [index + 1] : [])
if (numbers.length !== 3) {
  console.error(`✗ attese 3 slide SQL in example.md, trovate ${numbers.length}`)
  process.exit(1)
}
const [selectNo, panelNo, errorNo] = numbers

// ── Browser senza rete esterna ───────────────────────────────────
const server = await serve(dist)
const browser = await chromium.launch()
const blocked = new Set()
let sqljsRequests = 0
try {
  const page = await browser.newPage({ viewport: { width: 980, height: 552 } })
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      if (url.pathname.startsWith('/sqljs/'))
        sqljsRequests++
      return route.continue()
    }
    blocked.add(url.origin)
    return route.abort()
  })

  const run = async (no) => {
    await page.goto(`${server.origin}/${no}`)
    const slide = page.locator(`[data-slidev-no="${no}"]`)
    await slide.locator('.slidev-icon-btn').click({ timeout: 30_000 })
    return slide
  }
  const rowsOf = table => table.locator('tr').evaluateAll(rows =>
    rows.map(row => [...row.children].map(cell => cell.textContent.trim())))

  // 1. SELECT
  {
    const slide = await run(selectNo)
    const output = slide.locator('.at-output.at-sql')
    await output.waitFor({ timeout: 30_000 })
    const rows = await rowsOf(output.locator('table'))
    const failed = await output.getAttribute('data-error')
    check(same(rows, SELECT) && failed === null,
      `slide ${selectNo}: SELECT → ${rows.slice(1).map(row => row.join(' | ')).join(', ')}`,
      `slide ${selectNo}: righe attese ${JSON.stringify(SELECT)}, ricevute ${JSON.stringify(rows)}${failed === null ? '' : ' (con data-error)'}`)
  }

  // 2. Pannello «Database», nella slide del risultato
  {
    await run(panelNo)
    const moved = await page.waitForURL(url => new URL(url).pathname.endsWith(`/${panelNo + 1}`), { timeout: 5_000 }).then(() => true, () => false)
    check(moved, `slide ${panelNo}: «Esegui» porta alla slide del risultato`, `slide ${panelNo}: «Esegui» non porta alla slide ${panelNo + 1}`)
    const result = page.locator(`[data-slidev-no="${panelNo + 1}"]`)
    const output = result.locator('.at-output.at-sql')
    await output.waitFor({ timeout: 30_000 })
    const note = (await output.locator('.at-sql__note').first().textContent())?.trim()
    check(note === NOTE, `slide ${panelNo + 1}: «${note}»`, `slide ${panelNo + 1}: nota attesa «${NOTE}», ricevuta «${note}»`)

    const marked = await output.locator('.at-db__table tr[class*="at-db__row--"]').evaluateAll(rows => rows.map(row => ({
      sign: row.querySelector('.at-db__mark [aria-hidden]')?.textContent ?? '',
      values: [...row.querySelectorAll('td:not(.at-db__mark)')].map(cell => cell.textContent.trim()),
      changed: [...row.querySelectorAll('td.at-db__changed')].map(cell => cell.textContent.trim()),
    })))
    check(same(marked, PANEL),
      `slide ${panelNo + 1}: righe segnate ${marked.map(row => `${row.sign} ${row.values[1]}`).join(', ')}`,
      `slide ${panelNo + 1}: righe segnate attese ${JSON.stringify(PANEL)}, ricevute ${JSON.stringify(marked)}`)

    const legend = (await output.locator('.at-db__legend').textContent())?.trim()
    check(legend === LEGEND, `slide ${panelNo + 1}: legenda «${legend}»`, `slide ${panelNo + 1}: legenda attesa «${LEGEND}», ricevuta «${legend}»`)
    const hidden = await output.evaluate(element => element.scrollHeight - element.clientHeight)
    check(hidden <= 2, `slide ${panelNo + 1}: il pannello sta nella slide`, `slide ${panelNo + 1}: il pannello scorre (mancano ${hidden} px)`)
  }

  // 3. Errore di vincolo
  {
    const slide = await run(errorNo)
    const output = slide.locator('.at-output.at-sql')
    await output.waitFor({ timeout: 30_000 })
    const message = (await output.locator('.at-output__err').textContent())?.trim()
    const failed = await output.getAttribute('data-error')
    check(message === ERROR && failed !== null,
      `slide ${errorNo}: «${message}»`,
      `slide ${errorNo}: errore atteso «${ERROR}» con data-error, ricevuto «${message}»${failed === null ? ' senza data-error' : ''}`)
  }
}
finally {
  await browser.close()
  server.close()
}

check(sqljsRequests > 0, `sql.js caricato da localhost (${sqljsRequests} richieste a /sqljs/)`, 'nessuna richiesta a /sqljs/: sql.js non è stato caricato dal deck')
if (blocked.size > 0)
  console.log(`· richieste esterne bloccate: ${[...blocked].join(', ')}`)
else
  console.log('· nessuna richiesta esterna tentata')
process.exit(failures > 0 ? 1 : 0)
