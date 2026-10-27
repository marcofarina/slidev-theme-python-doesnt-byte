#!/usr/bin/env node
// Copia la distribuzione di Pyodide (dipendenza del tema) in `public/pyodide/` del deck,
// da dove il runner Python (setup/code-runners.ts) la carica senza rete.
// Uso, dalla cartella del deck: `npx pdb-copy-pyodide [cartella-del-deck]`; di solito sta
// negli script `predev` e `prebuild` del deck.
//
// Idempotente: se `public/pyodide/` contiene già la stessa versione con gli stessi file,
// non copia niente. Una versione diversa viene sostituita per intero, ma solo se la
// cartella è davvero una copia di Pyodide (ha il suo package.json).

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'

// File del pacchetto npm che il browser non usa: mappe, tipi, pagine di prova.
const SKIP = /\.(?:map|d\.ts|html)$|^README\.md$/

const require = createRequire(import.meta.url)
const source = dirname(require.resolve('pyodide/package.json'))
const deck = resolve(process.argv[2] ?? process.cwd())
const target = join(deck, 'public', 'pyodide')

const version = readJson(join(source, 'package.json')).version
const files = readdirSync(source).filter(name => !SKIP.test(name) && statSync(join(source, name)).isFile())

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function megabytes(bytes) {
  return (bytes / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })
}

function isSameCopy() {
  return files.every((name) => {
    const copy = join(target, name)
    return existsSync(copy) && statSync(copy).size === statSync(join(source, name)).size
  }) && readJson(join(target, 'package.json')).version === version
}

const shown = relative(process.cwd(), target) || target

if (existsSync(target)) {
  const manifest = join(target, 'package.json')
  if (!existsSync(manifest) || readJson(manifest).name !== 'pyodide') {
    console.error(`[pdb-copy-pyodide] ${shown} esiste ma non è una copia di Pyodide: la lascio com’è.`)
    process.exit(1)
  }
  if (isSameCopy()) {
    console.log(`[pdb-copy-pyodide] Pyodide ${version} è già in ${shown}.`)
    process.exit(0)
  }
  rmSync(target, { recursive: true, force: true })
}

mkdirSync(target, { recursive: true })
let bytes = 0
for (const name of files) {
  copyFileSync(join(source, name), join(target, name))
  bytes += statSync(join(target, name)).size
}
console.log(`[pdb-copy-pyodide] Pyodide ${version} copiato in ${shown} (${files.length} file, ${megabytes(bytes)} MB).`)
