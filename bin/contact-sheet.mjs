#!/usr/bin/env node
// Provino di un deck: tutte le slide in un'unica immagine, tre per riga, numerate (fase 12).
// Uso: `npx pdb-contact-sheet <deck.md> [--out <file.png>]`, dalla cartella del progetto del deck.
//
// Esporta il deck in PNG a scala 1 (980 × 552) con `slidev export`. Senza `--with-clicks`
// l'export fotografa ogni slide con tutti i clic fatti (verificato nella fase 12), come la
// vedrebbe chi ha finito di raccontarla. Salva in `contact-sheet/<nome-del-deck>.png` accanto
// al deck, salvo `--out`.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { load } from '@slidev/parser/fs'
import { die, launchChromium, loadPlaywright, prepareRuntimes, projectRoot, runSlidev } from './deck-tools.mjs'

const COLUMNS = 3
// Larghezza di una slide nel provino: con 600 px l'immagine intera è larga 1832 px, che si
// guarda senza scorrere di lato; le slide sono esportate a 980 px e ridotte dal browser.
const SLIDE_WIDTH = 600
const GAP = 8

function parseArguments(args) {
  const decks = []
  let out
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out')
      out = args[++i]
    else
      decks.push(args[i])
  }
  if (decks.length !== 1 || (args.includes('--out') && !out))
    die('Uso: pdb-contact-sheet <deck.md> [--out <file.png>]', 2)
  return { deck: decks[0], out }
}

// La pagina del provino è uno strumento, non una slide: i colori sono suoi, non del tema.
function sheetHtml(images) {
  const cells = images.map(({ name, number }) =>
    `<figure><img src="${pathToFileURL(name).href}" alt=""><b>${number}</b></figure>`).join('')
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:${GAP}px;background:#3f3f46;display:grid;grid-template-columns:repeat(${COLUMNS},${SLIDE_WIDTH}px);gap:${GAP}px}
figure{position:relative;margin:0}
img{display:block;width:${SLIDE_WIDTH}px}
b{position:absolute;top:6px;left:6px;padding:1px 8px;border-radius:4px;background:#09090b;color:#fff;font:600 16px/1.4 system-ui,sans-serif}
</style><body>${cells}</body>`
}

async function main() {
  const { deck, out } = parseArguments(process.argv.slice(2))
  if (!existsSync(deck))
    die(`✗ ${deck}: il file non esiste`)
  const playwright = await loadPlaywright('pdb-contact-sheet')
  const browser = await launchChromium(playwright, 'pdb-contact-sheet')

  const entry = resolve(deck)
  const root = projectRoot(entry)
  const parsed = await load(root, entry)
  prepareRuntimes(root, parsed.slides)

  const work = mkdtempSync(join(tmpdir(), 'pdb-contact-sheet-'))
  try {
    runSlidev(root, ['export', entry, '--format', 'png', '--scale', '1', '--output', join(work, 'slide')], deck)
    const images = readdirSync(join(work, 'slide'))
      .filter(name => name.endsWith('.png'))
      .map(name => ({ name: join(work, 'slide', name), number: Number.parseInt(name, 10) }))
      .sort((a, b) => a.number - b.number)
    if (images.length === 0)
      die(`✗ ${deck}: slidev export non ha prodotto immagini`)

    const page = await browser.newPage({ viewport: { width: COLUMNS * (SLIDE_WIDTH + GAP) + GAP, height: 600 } })
    const html = join(work, 'provino.html')
    writeFileSync(html, sheetHtml(images))
    await page.goto(pathToFileURL(html).href)
    await page.waitForLoadState('load')

    const target = resolve(out ?? join(dirname(entry), 'contact-sheet', `${basename(entry, extname(entry))}.png`))
    mkdirSync(dirname(target), { recursive: true })
    const temporary = join(work, 'provino.png')
    await page.screenshot({ path: temporary, fullPage: true })
    copyFileSync(temporary, target)
    console.log(`✓ ${relative(process.cwd(), target) || target} (${images.length} slide)`)
  }
  finally {
    await browser.close()
    rmSync(work, { recursive: true, force: true })
  }
}

await main()
