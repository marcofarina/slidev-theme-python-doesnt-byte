// Diagrammi Mermaid con Pele (fase 6). Slidev trasforma ogni blocco ```` ```mermaid ```` nel
// suo componente `Mermaid`, che chiede l'SVG a questo renderer e lo mette in uno shadow root.
// Un `components/Mermaid.vue` del tema non lo sostituisce in modo affidabile: quale dei due
// vince dipende dall'ordine alfabetico dei percorsi, e in un deck vince quello di Slidev.
//
// Pele colora il diagramma con variabili `--pele-*`, che attraversano lo shadow root per
// ereditarietà: le imposta styles/diagrams.css dai token, e il cambio light/dark non
// ri-renderizza (l'SVG è lo stesso nei due temi, quindi Slidev non tocca il DOM).

import { defineMermaidRendererSetup } from '@slidev/types'
import { renderAsync } from 'pele/lazy'
import type { RenderOptions } from 'pele/lazy'
import tokens from '../tokens/tokens.json'

function px(group: { name: string, value: string }[], name: string): number {
  const token = group.find(t => t.name === name)
  if (!token)
    throw new Error(`[python-doesnt-byte] token sconosciuto: ${name}`)
  return Number.parseFloat(token.value)
}

function textStyle(name: string) {
  const style = tokens.type.groups.flatMap(group => group.styles).find(s => s.name === name)
  if (!style)
    throw new Error(`[python-doesnt-byte] tokens.json non ha lo stile di testo \`${name}\``)
  return style
}

// Testo in `font-mono` e `ink` (card LayoutFigure). La base è il tipo `code`; il testo più
// piccolo del sistema è la didascalia, e nessuna parte del diagramma scende sotto.
const family = tokens.type.families.mono
const baseSize = Number.parseFloat(textStyle('code').fontSize)
const minSize = Number.parseFloat(textStyle('caption').fontSize)

// Larghezza utile della cornice di `figure`: la tela meno i margini laterali e il padding
// della cornice. Pele ridispone il diagramma per starci invece di rimpicciolirlo; nelle
// colonne si passa una larghezza più stretta con ```` ```mermaid {maxWidth: 480} ````.
// Sotto i 640 px Pele può girare un `LR` in verticale: `{autoDirection: false}` lo tiene.
const defaultMaxWidth = px(tokens.slide.tokens, 'slide-width')
  - 2 * px(tokens.spacing.tokens, 'space-14')
  - 2 * px(tokens.spacing.tokens, 'space-4')

// Le opzioni di Pele che un blocco può passare tra graffe. Le altre (`theme` di Slidev
// compreso) non riguardano Pele.
const passthrough = ['maxWidth', 'autoDirection', 'directionBreakpoint', 'padding', 'config'] as const

// Pele misura le etichette su un canvas: senza il font caricato misura il ripiego e i
// riquadri escono della misura sbagliata.
let fontsReady: Promise<unknown> | undefined
function loadFonts() {
  fontsReady ??= Promise.all([
    document.fonts.load(`${baseSize}px ${family}`),
    document.fonts.load(`bold ${baseSize}px ${family}`),
  ])
  return fontsReady
}

function smallestText(svg: string): number {
  const sizes = [...svg.matchAll(/font-size(?:="|:\s*)([\d.]+)/g)].map(m => Number(m[1]))
  return Math.min(...sizes)
}

// Pele dichiara le sue variabili interne (`--_fg`, `--_s`, …) nello `style` della radice.
// Con ```` ```mermaid {scale: 1.2} ```` Slidev toglie quello `style` per ridimensionare
// l'SVG, e i colori sparirebbero: le dichiarazioni passano a un `<g>` che avvolge il
// disegno, sulla radice restano solo le misure. `part` lascia stilare l'SVG da fuori.
function prepare(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const declarations = (root.getAttribute('style') ?? '').split(';').filter(Boolean)
  const isSize = (d: string) => /^\s*(?:max-width|height)\s*:/.test(d)

  const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  group.setAttribute('style', declarations.filter(d => !isSize(d)).join(';'))
  const fill = root.getAttribute('fill')
  if (fill) {
    group.setAttribute('fill', fill)
    root.removeAttribute('fill')
  }
  group.append(...root.childNodes)
  root.append(group)
  root.setAttribute('style', declarations.filter(isSize).join(';'))
  root.setAttribute('part', 'diagram')
  return new XMLSerializer().serializeToString(root)
}

export default defineMermaidRendererSetup(() => async (code, options) => {
  await loadFonts()
  const pele: RenderOptions = {
    fontFamily: family,
    fontFamilyMono: family,
    monospace: ['members', 'attributes', 'files', 'messages'],
    maxWidth: defaultMaxWidth,
  }
  for (const key of passthrough) {
    if (options[key] !== undefined)
      Object.assign(pele, { [key]: options[key] })
  }

  // Alcune parti scendono sotto la base (membri e etichette a 0,9, le chiavi degli ER a
  // 0,75): se una va sotto la didascalia, si ingrandisce tutto quanto basta.
  let result = await renderAsync(code, { ...pele, fontSize: baseSize })
  const smallest = smallestText(result.svg)
  if (smallest < minSize)
    result = await renderAsync(code, { ...pele, fontSize: baseSize * minSize / smallest })
  return prepare(result.svg)
})
