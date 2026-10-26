// Esporta in PNG le slide di example.md nei due temi: snapshots/light/ e snapshots/dark/.
// Uso: npm run snap.
//
// `slidev export --dark` emula solo `prefers-color-scheme: dark`, e Slidev lo ignora quando
// il deck fissa `colorSchema: light` (il predefinito del tema). Per il tema scuro lo script
// esporta quindi una copia temporanea di example.md con `colorSchema: dark` nell'headmatter.
// La copia sta accanto a example.md, perché `theme: ./` e i `src:` sono percorsi relativi.

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const entry = 'example.md'
const darkEntry = 'example.dark.md'

function exportPng(file, output) {
  const run = spawnSync('npx', ['slidev', 'export', file, '--format', 'png', '--output', output], {
    cwd: root,
    stdio: 'inherit',
  })
  if (run.status !== 0)
    process.exit(run.status ?? 1)
}

const source = readFileSync(new URL(`../${entry}`, import.meta.url), 'utf8')
if (!/^---\n/.test(source))
  throw new Error(`${entry} deve aprirsi con l'headmatter`)
const dark = source.replace(/^---\n/, '---\ncolorSchema: dark\n')

rmSync(new URL('../snapshots', import.meta.url), { recursive: true, force: true })
exportPng(entry, 'snapshots/light')
writeFileSync(new URL(`../${darkEntry}`, import.meta.url), dark)
try {
  exportPng(darkEntry, 'snapshots/dark')
}
finally {
  rmSync(new URL(`../${darkEntry}`, import.meta.url), { force: true })
}
