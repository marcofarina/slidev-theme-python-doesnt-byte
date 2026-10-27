#!/usr/bin/env node
// Verifica di un deck in un browser senza finestra (fase 12).
// Uso: `npx pdb-verify <deck.md…>`, dalla cartella del progetto del deck.
//
// Compila il deck in una cartella temporanea, lo serve su 127.0.0.1 bloccando ogni richiesta
// che non sia locale, apre ogni slide con tutti i clic fatti e a 980 × 552 (la tela, scala 1)
// e segnala, uno per riga come pdb-check (`✗ <deck>: slide N: <motivo>`, uscita 1):
//   - contenuto che scende oltre il footer (o oltre la tela, nelle slide senza footer);
//   - codice più largo del suo riquadro;
//   - testo, tabelle e codice in linea che escono di lato dal callout, dalla colonna o dalla slide;
//   - figure (anche dentro uno shadow root, come i diagrammi di Pele) che escono dal loro riquadro;
//   - blocchi eseguibili: li esegue, e segnala chi va in errore, chi non finisce e l'output
//     che non sta nel riquadro e scorre;
//   - richieste di rete (bloccate) fatte dalla slide.
// Una slide dichiara `verify: error` (il blocco deve andare in errore) o `verify: skip` (non si
// esegue) nel frontmatter; SlideFrame lo espone come `data-verify` e qui si legge dal DOM.
// Con `output: next` il blocco non si esegue nella slide del codice: si controlla che «Esegui»
// porti alla slide del risultato, e il blocco si esegue e si misura lì.
// Si misura solo in light: le misure non cambiano col tema.

import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { injectPreparserExtensionLoader, load } from '@slidev/parser/fs'
import { addResultSlides } from '../setup/result-slides.mjs'
import { die, launchChromium, loadPlaywright, prepareRuntimes, projectRoot, runSlidev, serve } from './deck-tools.mjs'

// Le slide del risultato si contano come le conta Slidev con il preparser del tema.
injectPreparserExtensionLoader(async () => [{ name: 'python-doesnt-byte:result', transformRawLines: addResultSlides }])

const CANVAS = { width: 980, height: 552 }
const RUN_TIMEOUT = 20_000
const EDITOR_TIMEOUT = 30_000

/**
 * Le misure geometriche di una slide, nel browser. Restituisce [{ kind, detail }]; le misure
 * sono in pixel della tela (divise per la scala di Slidev).
 */
function measureSlide(number) {
  const slide = document.querySelector(`[data-slidev-no="${number}"]`)
  const layout = slide?.querySelector('.slidev-layout')
  if (!layout)
    return { missing: true, problems: [] }

  const canvas = layout.getBoundingClientRect()
  const scale = canvas.width / 980 || 1
  const px = value => Math.round(value / scale)
  const problems = []
  const body = layout.querySelector('.at-frame__body') ?? layout
  const footer = layout.querySelector('.at-footer')
  const limit = footer ? footer.getBoundingClientRect().top : canvas.bottom

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 1 || rect.height <= 1)
      return false
    const style = getComputedStyle(element)
    return style.visibility !== 'hidden' && style.display !== 'none'
  }
  // Parti interne di componenti che non sono contenuto della slide: il riquadro del tooltip del
  // glossario (appare solo al passaggio del mouse), l'interno dell'editor Monaco, quello di un SVG.
  const isInternal = element => !!element.parentElement?.closest('.at-tooltip__box, .monaco-editor, svg')
    || !!element.closest('.at-tooltip__box')
  const shadowSvgs = (root) => {
    const found = []
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) {
        for (const svg of element.shadowRoot.querySelectorAll('svg'))
          found.push({ svg, host: element })
        found.push(...shadowSvgs(element.shadowRoot))
      }
    }
    return found
  }

  // 1. Contenuto oltre il footer. Un elemento tagliato da un antenato con overflow che finisce
  //    sopra il limite (l'output di un runner che scorre) non conta.
  const isClipped = (element) => {
    for (let ancestor = element.parentElement; ancestor && ancestor !== body; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).overflowY !== 'visible' && ancestor.getBoundingClientRect().bottom <= limit + 1)
        return true
    }
    return false
  }
  const shadows = shadowSvgs(body)
  let lowest = 0
  for (const element of [...body.querySelectorAll('*'), ...shadows.map(entry => entry.svg)]) {
    if (isInternal(element) || !isVisible(element) || isClipped(element))
      continue
    lowest = Math.max(lowest, element.getBoundingClientRect().bottom - limit)
  }
  if (lowest > 1)
    problems.push({ kind: 'bottom', detail: `straborda in basso di ${px(lowest)} px` })

  // 2. Codice più largo del riquadro.
  let widest = 0
  for (const pre of layout.querySelectorAll('pre')) {
    if (isVisible(pre) && pre.scrollWidth > pre.clientWidth + 2)
      widest = Math.max(widest, pre.scrollWidth - pre.clientWidth)
  }
  if (widest > 0)
    problems.push({ kind: 'wide-code', detail: `codice più largo del riquadro (di ${px(widest)} px)` })

  // 3. Testo, tabelle e codice in linea oltre il bordo destro del loro contenitore.
  const containers = '.at-callout, .at-cols__left, .at-cols__right, .at-frame__body'
  const names = { 'at-callout': 'del suo callout', 'at-cols__left': 'della sua colonna', 'at-cols__right': 'della sua colonna', 'at-frame__body': 'della slide' }
  const contentRight = (element) => {
    const style = getComputedStyle(element)
    return element.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth)
  }
  let side
  const candidates = 'p, li, td, th, code, h1, h2, h3, h4, table, blockquote, figcaption, .at-callout'
  for (const element of body.querySelectorAll(candidates)) {
    // Un paragrafo che avvolge solo un SVG o un'immagine non ha testo: ci pensa il controllo 4.
    if (isInternal(element) || element.closest('pre') || !isVisible(element) || (element.textContent.trim() === '' && !element.querySelector('table')))
      continue
    const container = element.parentElement?.closest(containers) ?? body
    const edge = Math.min(contentRight(container), canvas.right)
    let right = Math.max(...[...element.getClientRects()].map(rect => rect.right))
    if (getComputedStyle(element).display !== 'inline')
      right = Math.max(right, element.getBoundingClientRect().left + element.scrollWidth)
    if (right > edge + 2 && (!side || right - edge > side.over)) {
      const kind = Object.keys(names).find(name => container.classList.contains(name)) ?? 'at-frame__body'
      side = { over: right - edge, tag: element.tagName.toLowerCase(), text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), where: names[kind] }
    }
  }
  if (side)
    problems.push({ kind: 'side', detail: `esce di lato: <${side.tag}> «${side.text}» oltre il bordo destro ${side.where} di ${px(side.over)} px` })

  // 4. Figure: l'SVG deve stare nel suo riquadro, e nel suo contenitore (il riquadro della figura,
  //    la colonna, il callout, la slide).
  const figureBoxes = '.at-figure__frame, .at-cols__left, .at-cols__right, .at-callout, .at-frame__body'
  const figures = [
    ...[...body.querySelectorAll('svg')].filter(svg => !svg.closest('.at-footer, .at-qr, [data-qr]') && !svg.parentElement?.closest('svg')).map(svg => ({ svg, host: undefined })),
    ...shadows,
  ]
  let cut = 0
  for (const { svg, host } of figures) {
    const rect = svg.getBoundingClientRect()
    if (rect.width < 48 || !isVisible(svg))
      continue
    const reference = host ?? svg
    const boxes = [(reference.parentElement?.closest(figureBoxes) ?? body).getBoundingClientRect()]
    if (host)
      boxes.push(host.getBoundingClientRect())
    for (const box of boxes) {
      cut = Math.max(cut, box.left - rect.left, rect.right - box.right, box.top - rect.top, rect.bottom - box.bottom)
    }
  }
  if (cut > 2)
    problems.push({ kind: 'figure', detail: `figura tagliata: l’SVG esce dal suo riquadro di ${px(cut)} px` })

  return { missing: false, problems }
}

async function verifyDeck(deck, browser) {
  const root = projectRoot(deck)
  const entry = resolve(deck)
  const shown = relative(process.cwd(), entry) || deck
  const parsed = await load(root, entry)
  prepareRuntimes(root, parsed.slides)

  const output = mkdtempSync(join(tmpdir(), 'pdb-verify-'))
  const problems = []
  try {
    runSlidev(root, ['build', entry, '--out', output], shown)
    const server = await serve(output)
    const context = await browser.newContext({ viewport: CANVAS })
    const page = await context.newPage()
    let current = 0
    const blocked = new Set()
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
        return route.continue()
      if (!blocked.has(`${current}|${url.origin}`)) {
        blocked.add(`${current}|${url.origin}`)
        problems.push({ slide: current, message: `chiede la rete a ${url.origin} (bloccata): in classe potrebbe non esserci` })
      }
      return route.abort()
    })

    try {
      await page.goto(`${server.origin}/1`)
      // Slidev monta le slide man mano: si aspetta quelle del sorgente, poi che il numero non
      // cambi più (il preparser del tema può aggiungerne altre).
      const mounted = () => page.evaluate(() => document.querySelectorAll('[data-slidev-no]').length)
      await page.waitForFunction(count => document.querySelectorAll('[data-slidev-no]').length >= count, parsed.slides.length, { timeout: 30_000 })
        .catch(() => problems.push({ slide: 0, message: `nel DOM ci sono meno slide di quelle del sorgente (${parsed.slides.length})` }))
      let total = await mounted()
      for (let stable = 0; stable < 3;) {
        await page.waitForTimeout(300)
        const now = await mounted()
        stable = now === total ? stable + 1 : 0
        total = now
      }

      for (let number = 1; number <= total; number++) {
        current = number
        await page.goto(`${server.origin}/${number}?clicks=99`)
        const slide = page.locator(`[data-slidev-no="${number}"]`)
        await slide.locator('.slidev-layout').waitFor({ timeout: 30_000 })
        await page.evaluate(() => document.fonts.ready)

        // I diagrammi si disegnano dopo il montaggio: si aspetta il loro SVG.
        await page.waitForFunction(
          (n) => {
            const hosts = document.querySelectorAll(`[data-slidev-no="${n}"] .mermaid`)
            return [...hosts].every(host => host.shadowRoot?.querySelector('svg') ?? host.querySelector('svg'))
          },
          number,
          { timeout: 15_000 },
        ).catch(() => problems.push({ slide: number, message: 'un diagramma non si disegna in 15 secondi' }))

        await runBlocks(page, slide, number, problems)
        await page.waitForTimeout(250)

        const result = await page.evaluate(measureSlide, number)
        if (result.missing)
          problems.push({ slide: number, message: 'la slide non è nel DOM' })
        for (const problem of result.problems)
          problems.push({ slide: number, message: problem.detail })

        if (await slide.locator('.slidev-layout').getAttribute('data-output') === 'next')
          await checkResultLink(page, slide, number, problems)
      }
      return { shown, total, problems }
    }
    finally {
      await context.close()
      server.close()
    }
  }
  finally {
    rmSync(output, { recursive: true, force: true })
  }
}

/** Esegue ogni runner della slide, come in classe, e segnala errori, blocchi e output che scorre. */
async function runBlocks(page, slide, number, problems) {
  const layout = slide.locator('.slidev-layout')
  const mode = await layout.getAttribute('data-verify')
  // `output: next`: qui il blocco non si esegue (lo fa checkResultLink). Nella slide del
  // risultato l'editor è nascosto e il blocco parte da solo.
  if (await layout.getAttribute('data-output') === 'next')
    return
  const isResult = await layout.evaluate(element => element.classList.contains('result'))
  const containers = slide.locator('.slidev-monaco-container')
  const count = await containers.count()
  let index = 0
  for (let i = 0; i < count; i++) {
    const container = containers.nth(i)
    if (!isResult) {
      // L'editor si carica a richiesta: senza, il pulsante non funziona.
      const editor = await container.locator('.monaco-editor').first().waitFor({ timeout: EDITOR_TIMEOUT }).then(() => true, () => false)
      const button = container.locator('.slidev-icon-btn')
      if (!editor || (await button.count()) === 0) {
        if (!editor)
          problems.push({ slide: number, message: `blocco ${i + 1}: l’editor non si carica in ${EDITOR_TIMEOUT / 1000} secondi` })
        continue
      }
    }
    index++
    if (mode === 'skip')
      continue
    const name = `blocco ${index}`
    if (!isResult)
      await container.locator('.slidev-icon-btn').first().click()
    const output = container.locator('.at-output')
    const finished = await output.waitFor({ timeout: RUN_TIMEOUT }).then(() => true, () => false)
    if (!finished) {
      problems.push({ slide: number, message: `${name}: non finisce in ${RUN_TIMEOUT / 1000} secondi (se è voluto, \`verify: skip\`)` })
      continue
    }
    const failed = (await output.getAttribute('data-error')) !== null
    if (failed && mode !== 'error') {
      const last = (await output.innerText()).trim().split('\n').at(-1).slice(0, 160)
      problems.push({ slide: number, message: `${name}: va in errore (${last}); se è voluto, \`verify: error\`` })
    }
    else if (!failed && mode === 'error') {
      problems.push({ slide: number, message: `${name}: doveva andare in errore (\`verify: error\`) e non ci va` })
    }
    const hidden = await output.evaluate(element => element.scrollHeight - element.clientHeight)
    if (hidden > 2 && isResult)
      problems.push({ slide: number, message: `${name}: l’output non sta nemmeno nella slide del risultato e scorre (mancano ${hidden} px): accorcialo, con meno righe o righe più corte` })
    else if (hidden > 2)
      problems.push({ slide: number, message: `${name}: l’output non sta nel riquadro e scorre (mancano ${hidden} px): metti \`output: next\` nel frontmatter della slide, e il risultato avrà una slide sua` })
  }
}

/** Con `output: next`, «Esegui» deve portare alla slide successiva, e quella dev'essere la slide del risultato. */
async function checkResultLink(page, slide, number, problems) {
  const button = slide.locator('.slidev-monaco-container .slidev-icon-btn').first()
  const ready = await button.waitFor({ timeout: EDITOR_TIMEOUT }).then(() => true, () => false)
  if (!ready) {
    problems.push({ slide: number, message: `\`output: next\`: il pulsante «Esegui» non compare in ${EDITOR_TIMEOUT / 1000} secondi` })
    return
  }
  await button.click()
  const moved = await page.waitForURL(url => new URL(url).pathname.endsWith(`/${number + 1}`), { timeout: 5_000 }).then(() => true, () => false)
  const next = page.locator(`[data-slidev-no="${number + 1}"] .slidev-layout.result`)
  if (!moved)
    problems.push({ slide: number, message: '`output: next`: «Esegui» non porta alla slide successiva' })
  else if (!await next.waitFor({ state: 'attached', timeout: 5_000 }).then(() => true, () => false))
    problems.push({ slide: number, message: '`output: next`: la slide successiva non è quella del risultato' })
}

async function main(decks) {
  if (decks.length === 0)
    die('Uso: pdb-verify <deck.md…>', 2)
  const playwright = await loadPlaywright('pdb-verify')
  const browser = await launchChromium(playwright, 'pdb-verify')
  let failed = false
  try {
    for (const deck of decks) {
      if (!existsSync(deck)) {
        console.error(`✗ ${deck}: il file non esiste`)
        failed = true
        continue
      }
      const { shown, total, problems } = await verifyDeck(deck, browser)
      problems.sort((a, b) => a.slide - b.slide)
      for (const { slide, message } of problems)
        console.error(`✗ ${shown}: ${slide > 0 ? `slide ${slide}: ` : ''}${message}`)
      if (problems.length === 0)
        console.log(`✓ ${shown} (${total} slide verificate)`)
      else
        failed = true
    }
  }
  finally {
    await browser.close()
  }
  process.exit(failed ? 1 : 0)
}

await main(process.argv.slice(2))
