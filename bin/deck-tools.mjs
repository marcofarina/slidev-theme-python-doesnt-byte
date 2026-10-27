// Strumenti comuni a pdb-verify e pdb-contact-sheet (fase 12): trovare la radice del deck,
// compilarlo o esportarlo con Slidev, servirlo su 127.0.0.1 e caricare Playwright.
// Non è un comando: la usano i tre script di bin/.

import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const COPY_PYODIDE = fileURLToPath(new URL('./copy-pyodide.mjs', import.meta.url))

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

/** Esce con un messaggio e il codice dato. */
export function die(message, code = 1) {
  console.error(message)
  process.exit(code)
}

/** La radice del progetto di un deck: la cartella con il `package.json` più vicina, come per Slidev. */
export function projectRoot(entry) {
  let dir = dirname(resolve(entry))
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir)
      return dirname(resolve(entry))
    dir = parent
  }
  return dir
}

/** Playwright è una peerDependency facoltativa: se manca, dice come installarla. */
export async function loadPlaywright(command) {
  try {
    return await import('playwright-chromium')
  }
  catch {
    return die(`✗ ${command} usa un browser senza finestra e playwright-chromium non è installato.\n  Nel progetto del deck: npm i -D playwright-chromium`)
  }
}

export async function launchChromium(playwright, command) {
  try {
    return await playwright.chromium.launch()
  }
  catch (error) {
    return die(`✗ ${command}: Chromium non parte (${String(error.message).split('\n')[0]}).\n  Prova: npx playwright install chromium`)
  }
}

/** Esegue `slidev <args>` dalla radice del progetto; esce se fallisce. */
export function runSlidev(root, args, label) {
  const run = spawnSync('npx', ['slidev', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (run.status !== 0) {
    process.stderr.write(`${run.stdout}${run.stderr}`)
    die(`✗ ${label}: slidev ${args[0]} non è andato a buon fine`)
  }
}

/** Se il deck ha blocchi eseguibili, Pyodide deve stare in public/pyodide/ prima di compilare. */
export function preparePyodide(root, slides) {
  if (!slides.some(slide => /monaco-run/.test(slide.content ?? '')))
    return
  const run = spawnSync(process.execPath, [COPY_PYODIDE, root], { encoding: 'utf8' })
  if (run.status !== 0) {
    process.stderr.write(run.stderr)
    die('✗ Pyodide non si è copiato in public/pyodide/')
  }
}

/** Serve `dir` su 127.0.0.1; le rotte del deck (/12) ricadono su index.html. */
export async function serve(dir) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    let file = normalize(join(dir, path))
    if (file !== dir && !file.startsWith(dir + sep)) {
      response.writeHead(403).end()
      return
    }
    if (!existsSync(file) || statSync(file).isDirectory())
      file = join(dir, 'index.html')
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}
