// Callout nel Markdown: `:::tipo Titolo` … `:::` diventa `<Callout type title>`.
// Accetta anche `::: tipo Titolo`. Il titolo è facoltativo: senza, `Callout.vue` usa il
// titolo di default del tipo. Un tipo sconosciuto interrompe la build con un errore leggibile.

import type { MarkdownExit } from 'markdown-exit'
import container from 'markdown-it-container'
import { calloutTypes, isCalloutName } from './callout-types.ts'

const validTypes = Object.keys(calloutTypes).join(', ')

// Il titolo è testo semplice: passa dal parser inline solo perché le virgolette
// diventino curve; il Markdown che contiene (`*`, backtick) non viene interpretato.
function plainTitle(md: MarkdownExit, title: string): string {
  const [inline] = md.parseInline(title, {})
  return (inline.children ?? [])
    .map(token => (token.type === 'text' || token.type === 'code_inline' ? token.content : token.type === 'softbreak' ? ' ' : ''))
    .join('')
    .trim()
}

export function callout(md: MarkdownExit): void {
  md.use(container, 'callout', {
    // Ogni `:::parola` è un callout: così un tipo sbagliato arriva al render, che lo segnala.
    validate: (params: string) => /^\s*\S/.test(params),
    render(tokens: { info: string, nesting: number, map: [number, number] | null }[], idx: number) {
      const token = tokens[idx]
      if (token.nesting !== 1)
        return '</Callout>\n'

      const [, type, rawTitle = ''] = /^(\S+)\s*(.*)$/.exec(token.info.trim()) ?? []
      if (!isCalloutName(type)) {
        const line = token.map ? ` (riga ${token.map[0] + 1} della slide)` : ''
        throw new Error(`[python-doesnt-byte] callout sconosciuto «${type}»${line}. Tipi validi: ${validTypes}.`)
      }
      const title = plainTitle(md, rawTitle)
      const attr = title ? ` title="${md.utils.escapeHtml(title)}"` : ''
      return `<Callout type="${type}"${attr}>\n`
    },
  })
}
