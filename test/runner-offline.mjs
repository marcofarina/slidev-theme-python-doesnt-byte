// Il runner Python funziona senza rete (fase 5). Uso: npm run test:runner.
//
// Compila example.md (prebuild copia Pyodide in public/pyodide/), serve dist/ con un
// server statico su localhost e apre il deck in Chromium bloccando ogni richiesta che non
// vada a localhost. Sulle slide `exercise` preme Esegui e controlla l'output: la prima
// stampa tre righe, la seconda stampa una riga e poi solleva ZeroDivisionError.

import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { load } from '@slidev/parser/fs'
import { chromium } from 'playwright-chromium'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const entry = join(root, 'example.md')

const EXPECTED = [
  { stdout: 'Harry 20\nHermione 50\nRon 10', error: null },
  { stdout: 'Ogni studente riceverà:', error: 'ZeroDivisionError: division by zero' },
]

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

// ── Build ────────────────────────────────────────────────────────
const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
if (build.status !== 0) {
  console.error('✗ npm run build non è andato a buon fine')
  process.exit(1)
}
if (!existsSync(join(dist, 'pyodide', 'pyodide.asm.wasm'))) {
  console.error('✗ dist/pyodide/pyodide.asm.wasm non c’è: Pyodide non è nella build')
  process.exit(1)
}

// ── Server statico: le rotte del deck (/32) ricadono su index.html ──
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  let file = normalize(join(dist, path))
  if (!file.startsWith(dist + sep) && file !== dist) {
    response.writeHead(403).end()
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory())
    file = join(dist, 'index.html')
  response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(response)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://localhost:${server.address().port}`

// ── Browser senza rete esterna ───────────────────────────────────
const browser = await chromium.launch()
const blocked = new Set()
let pyodideRequests = 0
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      if (url.pathname.startsWith('/pyodide/'))
        pyodideRequests++
      return route.continue()
    }
    blocked.add(url.origin)
    return route.abort()
  })

  // Numeri delle slide `exercise`: il parser di Slidev risolve anche i `src:` di example.md.
  // Con `output: next` il blocco si esegue nella slide del risultato (fase 13): qui si salta.
  const { slides } = await load(root, entry)
  const exercises = slides.flatMap((slide, index) => slide.frontmatter.layout === 'exercise' && slide.frontmatter.output !== 'next' ? [index + 1] : [])

  if (exercises.length !== EXPECTED.length)
    fail(`attese ${EXPECTED.length} slide exercise in example.md, trovate ${exercises.length}`)

  for (const [index, no] of exercises.slice(0, EXPECTED.length).entries()) {
    const expected = EXPECTED[index]
    await page.goto(`${base}/${no}`)
    const slide = page.locator(`[data-slidev-no="${no}"]`)
    await slide.locator('.slidev-icon-btn').click({ timeout: 30_000 })
    const output = slide.locator('.at-output')
    await output.waitFor({ timeout: 60_000 })

    const text = (await output.innerText()).trim()
    const error = await output.locator('.at-output__err').allInnerTexts()
    const stdout = expected.error ? text.slice(0, text.lastIndexOf(expected.error)).trim() : text

    if (stdout !== expected.stdout)
      fail(`slide ${no}: output atteso ${JSON.stringify(expected.stdout)}, ricevuto ${JSON.stringify(text)}`)
    else if (expected.error === null && error.length > 0)
      fail(`slide ${no}: nessun errore atteso, ricevuto ${JSON.stringify(error)}`)
    else if (expected.error !== null && error.at(-1)?.trim() !== expected.error)
      fail(`slide ${no}: riga di errore attesa ${JSON.stringify(expected.error)}, ricevuta ${JSON.stringify(error)}`)
    else
      console.log(`✓ slide ${no}: ${JSON.stringify(text)}`)
  }
}
finally {
  await browser.close()
  server.close()
}

if (pyodideRequests === 0)
  fail('nessuna richiesta a /pyodide/: Pyodide non è stato caricato dal deck')
else
  console.log(`✓ Pyodide caricato da localhost (${pyodideRequests} richieste a /pyodide/)`)
if (blocked.size > 0)
  console.log(`· richieste esterne bloccate: ${[...blocked].join(', ')}`)
else
  console.log('· nessuna richiesta esterna tentata')
