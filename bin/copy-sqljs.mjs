#!/usr/bin/env node
// Copia sql.js (dipendenza del tema) in `public/sqljs/` del deck, da dove il runner SQL
// (setup/sql-runner.ts) lo carica senza rete. È separato da pdb-copy-pyodide: un deck senza
// blocchi SQL non porta il WASM di SQLite.
// Uso, dalla cartella del deck: `npx pdb-copy-sqljs [cartella-del-deck]`; di solito sta
// negli script `predev` e `prebuild` del deck.
//
// Idempotente: se `public/sqljs/` contiene già la stessa versione con gli stessi file, non
// copia niente. Una versione diversa viene sostituita per intero, ma solo se la cartella è
// davvero una copia di sql.js (ha il suo package.json).

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'

// Il browser usa solo la colla JS e il WASM; package.json identifica la copia, LICENSE
// accompagna il codice ridistribuito (MIT).
const FILES = {
  'sql-wasm.js': 'dist/sql-wasm.js',
  'sql-wasm.wasm': 'dist/sql-wasm.wasm',
  'package.json': 'package.json',
  'LICENSE': 'LICENSE',
}

const require = createRequire(import.meta.url)
const source = packageRoot(require.resolve('sql.js'))
const deck = resolve(process.argv[2] ?? process.cwd())
const target = join(deck, 'public', 'sqljs')

const version = readJson(join(source, 'package.json')).version

// sql.js non esporta `sql.js/package.json`: la radice del pacchetto si trova risalendo
// dal file principale.
function packageRoot(file) {
  let dir = dirname(file)
  while (!existsSync(join(dir, 'package.json')) || readJson(join(dir, 'package.json')).name !== 'sql.js') {
    const parent = dirname(dir)
    if (parent === dir)
      throw new Error('[pdb-copy-sqljs] non trovo la cartella del pacchetto sql.js')
    dir = parent
  }
  return dir
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function megabytes(bytes) {
  return (bytes / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })
}

function isSameCopy() {
  return Object.entries(FILES).every(([name, from]) => {
    const copy = join(target, name)
    return existsSync(copy) && statSync(copy).size === statSync(join(source, from)).size
  }) && readJson(join(target, 'package.json')).version === version
}

const shown = relative(process.cwd(), target) || target

if (existsSync(target)) {
  const manifest = join(target, 'package.json')
  if (!existsSync(manifest) || readJson(manifest).name !== 'sql.js') {
    console.error(`[pdb-copy-sqljs] ${shown} esiste ma non è una copia di sql.js: la lascio com’è.`)
    process.exit(1)
  }
  if (isSameCopy()) {
    console.log(`[pdb-copy-sqljs] sql.js ${version} è già in ${shown}.`)
    process.exit(0)
  }
  rmSync(target, { recursive: true, force: true })
}

mkdirSync(target, { recursive: true })
let bytes = 0
for (const [name, from] of Object.entries(FILES)) {
  copyFileSync(join(source, from), join(target, name))
  bytes += statSync(join(target, name)).size
}
console.log(`[pdb-copy-sqljs] sql.js ${version} copiato in ${shown} (${Object.keys(FILES).length} file, ${megabytes(bytes)} MB).`)
