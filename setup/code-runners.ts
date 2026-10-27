// Runner Python per i blocchi ```python {monaco-run}``` (fase 5).
//
// Pyodide non sta nel bundle del tema né su una CDN: `pdb-copy-pyodide`
// (bin/copy-pyodide.mjs) lo copia in `public/pyodide/` del deck e qui si carica da
// `<base>pyodide/pyodide.mjs` al primo Run. La build statica funziona così senza rete, e il
// JS e il WASM di Pyodide hanno sempre la stessa versione.
//
// Ogni Run è un programma nuovo, come `python file.py`: globali vuoti, stdout e stderr
// nell'output nell'ordine in cui arrivano. Un'eccezione dà l'ultima riga del traceback,
// marcata come errore. Il codice gira nel thread della pagina: un ciclo infinito blocca la
// presentazione finché non si ricarica.

import type { CodeRunnerOutputs } from '@slidev/types'
import type { PyodideAPI } from 'pyodide'
import { defineCodeRunnersSetup } from '@slidev/types'

interface Chunk {
  text: string
  error: boolean
}

// Stato del caricamento, per l'etichetta del runner (styles/interactive.css).
const STATE_ATTRIBUTE = 'data-pdb-python'

let instance: Promise<PyodideAPI> | undefined
let queue: Promise<unknown> = Promise.resolve()

function pyodideURL(): string {
  return new URL(`${import.meta.env.BASE_URL}pyodide/`, document.baseURI).href
}

class PyodideMissing extends Error {}

async function importPyodide(url: string): Promise<typeof import('pyodide')> {
  try {
    return await import(/* @vite-ignore */ `${url}pyodide.mjs`)
  }
  catch (error) {
    // Un file assente può tornare 200 con la pagina del deck (ripiego delle rotte di Vite e
    // di molti server statici): conta come assente.
    const found = await fetch(`${url}pyodide.mjs`, { method: 'HEAD' }).then(
      r => r.ok && !r.headers.get('content-type')?.includes('text/html'),
      () => false,
    )
    throw found ? error : new PyodideMissing()
  }
}

function loadPyodideOnce(): Promise<PyodideAPI> {
  if (!instance) {
    const url = pyodideURL()
    // PYTHON_COLORS: con stdout e stderr da terminale Python 3.14 colorerebbe i traceback.
    instance = importPyodide(url).then(({ loadPyodide }) =>
      loadPyodide({ indexURL: url, env: { PYTHON_COLORS: '0' } }))
    instance.catch(() => instance = undefined)
  }
  return instance
}

// Un flusso di Python verso l'elenco dei pezzi di output. `isatty` rende stdout bufferizzato
// per riga, così una riga su stderr non scavalca le righe di print precedenti.
function writer(chunks: Chunk[], error: boolean) {
  const decoder = new TextDecoder()
  return {
    isatty: true,
    write(buffer: Uint8Array) {
      const text = decoder.decode(buffer, { stream: true })
      const last = chunks.at(-1)
      if (last?.error === error)
        last.text += text
      else if (text)
        chunks.push({ text, error })
      return buffer.length
    },
  }
}

function lastTracebackLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.trimEnd().split('\n').at(-1) ?? message
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// L'output è un <pre class="at-output"> nostro, come in bundle.css di Atmospheric: Slidev
// lo mostra così com'è, senza i suoi stili per riga.
// `data-error` dice a pdb-verify che il programma è finito con un'eccezione (e non solo con
// qualcosa su stderr).
function render(chunks: Chunk[], failed = false): CodeRunnerOutputs {
  const parts = chunks.map((chunk, index) => {
    const text = index === chunks.length - 1 ? chunk.text.replace(/\n$/, '') : chunk.text
    return chunk.error
      ? `<span class="at-output__err">${escapeHtml(text)}</span>`
      : escapeHtml(text)
  })
  if (!parts.join(''))
    return { html: '<pre class="at-output at-output--empty">Nessun output</pre>' }
  return { html: `<pre class="at-output"${failed ? ' data-error' : ''}>${parts.join('')}</pre>` }
}

function failure(message: string): CodeRunnerOutputs {
  return render([{ text: message, error: true }], true)
}

async function execute(code: string): Promise<CodeRunnerOutputs> {
  // Se Pyodide è già carico, `loading` e `ready` cambiano nello stesso task: nessun lampo.
  const root = document.documentElement
  root.setAttribute(STATE_ATTRIBUTE, 'loading')
  let pyodide: PyodideAPI
  try {
    pyodide = await loadPyodideOnce()
    root.setAttribute(STATE_ATTRIBUTE, 'ready')
  }
  catch (error) {
    root.setAttribute(STATE_ATTRIBUTE, 'failed')
    console.error('[python-doesnt-byte] Pyodide non si carica:', error)
    if (error instanceof PyodideMissing)
      return failure(`Pyodide non è nel deck (${pyodideURL()}). Esegui «npx pdb-copy-pyodide» nella cartella del deck, poi ricarica la pagina.`)
    return failure(`Pyodide non si avvia: ${lastTracebackLine(error)}`)
  }

  const chunks: Chunk[] = []
  const globals = pyodide.toPy({ __name__: '__main__' })
  pyodide.setStdout(writer(chunks, false))
  pyodide.setStderr(writer(chunks, true))
  let raised: unknown
  try {
    await pyodide.runPythonAsync(code, { globals, filename: '<exec>' })
  }
  catch (error) {
    raised = error
    // Un errore che non viene da Python (PythonError ha `type`) può lasciare Pyodide in uno
    // stato inservibile: al prossimo Run si ricarica.
    if (!(error instanceof Error && 'type' in error))
      instance = undefined
  }
  finally {
    try {
      pyodide.runPython('import sys\nsys.stdout.flush()\nsys.stderr.flush()')
    }
    catch {}
    pyodide.setStdout()
    pyodide.setStderr()
    globals.destroy()
  }

  if (raised !== undefined) {
    const last = chunks.at(-1)
    if (last && !last.text.endsWith('\n'))
      last.text += '\n'
    chunks.push({ text: lastTracebackLine(raised), error: true })
  }
  return render(chunks, raised !== undefined)
}

export default defineCodeRunnersSetup(() => ({
  // Un Run alla volta: Pyodide è uno solo e stdout è globale.
  python(code) {
    const run = queue.then(() => execute(code))
    queue = run.catch(() => {})
    return run
  },
}))
