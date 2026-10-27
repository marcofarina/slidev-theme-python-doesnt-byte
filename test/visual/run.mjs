// Test visivi (fase 7): esporta in PNG example.md e i quattro deck dei volumi nei due temi e
// confronta ogni immagine con il riferimento committato in test/visual/baseline/.
//
// Uso:
//   npm run test:visual                       confronta; esce con 1 se una slide supera la soglia
//   npm run test:visual:update                riscrive il riferimento
//   node test/visual/run.mjs --only artefice  solo un deck (example, programmatore, artefice, …)
//
// Le immagini nuove stanno in test/visual/output/<tema>/<deck>/ e quelle di differenza
// (rosso = pixel cambiati) in test/visual/output/diff/<tema>/<deck>/. `output/` è ignorata da git.
//
// Il tema scuro non si ottiene con `slidev export --dark`, che emula solo
// `prefers-color-scheme` e Slidev ignora con `colorSchema: light` (il predefinito del tema,
// vedi scripts/snap.mjs). Lo script esporta una copia accanto al file con
// `colorSchema: dark` nell'headmatter: sta accanto, perché `theme:` e `src:` sono relativi.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const visual = join(root, 'test', 'visual')
const outputDir = join(visual, 'output')
const baselineDir = join(visual, 'baseline')

// Sensibilità del confronto per singolo pixel (0 = esatto, 1 = tutto uguale) e quota di pixel
// diversi oltre la quale una slide è una regressione. Sulla stessa macchina due esportazioni
// consecutive sono identiche (0 pixel diversi su 110 immagini); 0,05 % sono circa 270 pixel:
// uno scarto di 1 px nel padding del footer ne cambia 670, un token cambiato 460 000. Su un'altra
// macchina il rendering dei font può differire: si rigenera il riferimento lì.
const PIXEL_THRESHOLD = 0.1
const MAX_DIFF_RATIO = 0.0005

const THEMES = ['light', 'dark']
const DECKS = [
  { name: 'example', file: 'example.md' },
  ...['programmatore', 'artefice', 'archivista', 'apprendista']
    .map(name => ({ name, file: `test/visual/volumes/${name}.md` })),
]

const args = process.argv.slice(2)
const update = args.includes('--update')
const onlyIndex = args.indexOf('--only')
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : undefined
const decks = only ? DECKS.filter(deck => deck.name === only) : DECKS
if (decks.length === 0) {
  console.error(`✗ deck «${only}» sconosciuto. Validi: ${DECKS.map(deck => deck.name).join(', ')}`)
  process.exit(2)
}

function exportPng(file, output) {
  const run = spawnSync('npx', [
    'slidev',
    'export',
    file,
    '--format',
    'png',
    '--with-clicks',
    '--scale',
    '1',
    '--output',
    output,
  ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (run.status !== 0) {
    process.stderr.write(`${run.stdout}${run.stderr}`)
    console.error(`✗ slidev export ${file} non è andato a buon fine`)
    process.exit(1)
  }
}

function exportDeck(deck, theme) {
  const output = join('test', 'visual', 'output', theme, deck.name)
  if (theme === 'light') {
    exportPng(deck.file, output)
    return
  }
  const source = readFileSync(join(root, deck.file), 'utf8')
  if (!/^---\n/.test(source))
    throw new Error(`${deck.file} deve aprirsi con l'headmatter`)
  const copy = deck.file.replace(/\.md$/, '.visual-dark.md')
  writeFileSync(join(root, copy), source.replace(/^---\n/, '---\ncolorSchema: dark\n'))
  try {
    exportPng(copy, output)
  }
  finally {
    rmSync(join(root, copy), { force: true })
  }
}

function pngs(dir) {
  return existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.png')).sort() : []
}

function compare(theme, deck) {
  const label = `${theme}/${deck.name}`
  const current = join(outputDir, theme, deck.name)
  const reference = join(baselineDir, theme, deck.name)
  const failures = []
  const names = [...new Set([...pngs(current), ...pngs(reference)])].sort()
  for (const name of names) {
    if (!existsSync(join(reference, name))) {
      failures.push(`${label}/${name}: slide nuova senza riferimento`)
      continue
    }
    if (!existsSync(join(current, name))) {
      failures.push(`${label}/${name}: nel riferimento, ma non più esportata`)
      continue
    }
    const a = PNG.sync.read(readFileSync(join(reference, name)))
    const b = PNG.sync.read(readFileSync(join(current, name)))
    if (a.width !== b.width || a.height !== b.height) {
      failures.push(`${label}/${name}: dimensioni diverse (${a.width}×${a.height} contro ${b.width}×${b.height})`)
      continue
    }
    const diff = new PNG({ width: a.width, height: a.height })
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: PIXEL_THRESHOLD })
    const ratio = changed / (a.width * a.height)
    if (ratio > MAX_DIFF_RATIO) {
      const diffDir = join(outputDir, 'diff', theme, deck.name)
      mkdirSync(diffDir, { recursive: true })
      writeFileSync(join(diffDir, name), PNG.sync.write(diff))
      failures.push(`${label}/${name}: ${changed} pixel diversi (${(ratio * 100).toFixed(2)} %, soglia ${(MAX_DIFF_RATIO * 100).toFixed(2)} %)`)
    }
  }
  return { label, count: names.length, failures }
}

if (!only)
  rmSync(outputDir, { recursive: true, force: true })
for (const deck of decks) {
  for (const theme of THEMES) {
    rmSync(join(outputDir, theme, deck.name), { recursive: true, force: true })
    rmSync(join(outputDir, 'diff', theme, deck.name), { recursive: true, force: true })
    exportDeck(deck, theme)
  }
}

if (update) {
  for (const deck of decks) {
    for (const theme of THEMES) {
      const reference = join(baselineDir, theme, deck.name)
      rmSync(reference, { recursive: true, force: true })
      mkdirSync(reference, { recursive: true })
      cpSync(join(outputDir, theme, deck.name), reference, { recursive: true })
      console.log(`✓ riferimento riscritto: ${theme}/${deck.name} (${pngs(reference).length} immagini)`)
    }
  }
  process.exit(0)
}

let failed = 0
for (const deck of decks) {
  for (const theme of THEMES) {
    const result = compare(theme, deck)
    if (result.failures.length === 0) {
      console.log(`✓ ${result.label}: ${result.count} immagini uguali al riferimento`)
      continue
    }
    failed += result.failures.length
    console.error(`✗ ${result.label}: ${result.failures.length} su ${result.count} immagini`)
    for (const failure of result.failures)
      console.error(`    ${failure}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} immagini fuori soglia. Le differenze sono in ${join('test', 'visual', 'output', 'diff')}/.`)
  console.error(`Se il cambiamento è voluto: npm run test:visual:update (e guarda ${basename(baselineDir)}/ prima del commit).`)
  process.exit(1)
}
