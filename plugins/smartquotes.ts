// Virgolette curve: "testo" → “testo”, l'oggetto → l’oggetto, ... → …
//
// Usa la regola `smartquotes` di markdown-it (typographer), che lavora solo sui token di
// testo: codice inline, blocchi di codice, HTML (attributi compresi) e componenti Vue restano
// com'erano. Le altre sostituzioni del typographer ((c), (tm), --, +-) restano spente.
// Due eccezioni al comportamento predefinito:
//   - i puntini `...` diventano `…` con una regola nostra (`replacements` è spenta);
//   - dentro `{{ … }}` il testo non cambia, perché è codice Vue e le virgolette curve lo rompono.

import type { MarkdownExit } from 'markdown-exit'

const interpolation = /\{\{[\s\S]*?\}\}/g

interface TextToken {
  type: string
  content: string
  meta?: { raw?: string } | null
}

function eachText(state: { tokens: { type: string, children: TextToken[] | null }[] }, fn: (token: TextToken) => void) {
  for (const block of state.tokens) {
    if (block.type !== 'inline')
      continue
    for (const child of block.children ?? []) {
      if (child.type === 'text')
        fn(child)
    }
  }
}

export function smartquotes(md: MarkdownExit): void {
  md.set({ typographer: true, quotes: '“”‘’' })
  md.disable('replacements')

  md.core.ruler.before('smartquotes', 'pdb_ellipsis', (state) => {
    eachText(state, (token) => {
      token.content = token.content
        .split(/(\{\{[\s\S]*?\}\})/)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(/\.{3,}/g, '…')))
        .join('')
    })
  })

  // `smartquotes` sostituisce un carattere con un altro: le lunghezze non cambiano,
  // quindi basta ricopiare i tratti `{{ … }}` dal testo originale.
  md.core.ruler.before('smartquotes', 'pdb_keep_interpolation', (state) => {
    eachText(state, (token) => {
      if (token.content.includes('{{'))
        token.meta = { ...token.meta, raw: token.content }
    })
  })

  md.core.ruler.after('smartquotes', 'pdb_restore_interpolation', (state) => {
    eachText(state, (token) => {
      const raw = token.meta?.raw
      if (raw === undefined || raw.length !== token.content.length)
        return
      const chars = token.content.split('')
      for (const match of raw.matchAll(interpolation)) {
        for (let i = match.index; i < match.index + match[0].length; i++)
          chars[i] = raw[i]
      }
      token.content = chars.join('')
    })
  })
}
