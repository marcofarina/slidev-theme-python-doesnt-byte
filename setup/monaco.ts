// Editor Monaco dei blocchi `{monaco}` e `{monaco-run}` (fase 5). Slidev lo apre a 11,5 px
// con tab da 2: sulla tela da 980 px serve il tipo `code` dei token (20/30), e Python vuole
// tab da 4. Niente suggerimenti, riquadri e righe evidenziate: la classe guarda il codice.
// I colori arrivano dai temi Shiki di setup/shiki.ts, che Slidev passa anche a Monaco.

import { defineMonacoSetup } from '@slidev/types'
import tokens from '../tokens/tokens.json'

const code = tokens.type.groups
  .flatMap(group => group.styles)
  .find(style => style.name === 'code')

if (!code)
  throw new Error('[python-doesnt-byte] tokens.json non ha lo stile di testo `code`')

function space(name: string): number {
  const token = tokens.spacing.tokens.find(t => t.name === name)
  if (!token)
    throw new Error(`[python-doesnt-byte] token di spaziatura sconosciuto: ${name}`)
  return Number.parseFloat(token.value)
}

export default defineMonacoSetup((monaco) => {
  // Opzioni del modello, non dell'editor. Slidev crea il modello prima dell'editor, e
  // creando l'editor (`tabSize: 2`) Monaco riscrive le opzioni di tutti i modelli: le
  // rimetto a ogni cambio. Python vuole tab da 4; niente parentesi colorate per livello.
  monaco.editor.onDidCreateModel((model) => {
    const enforce = () => {
      const options = model.getOptions()
      const python = model.getLanguageId() === 'python'
      if (options.bracketPairColorizationOptions.enabled || (python && (options.tabSize !== 4 || !options.insertSpaces))) {
        model.updateOptions({
          bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
          ...(python ? { tabSize: 4, indentSize: 4, insertSpaces: true } : {}),
        })
      }
    }
    enforce()
    model.onDidChangeOptions(enforce)
  })

  return {
    editorOptions: {
      // Una variabile di :root, non di .slidev-layout: Monaco misura il carattere fuori
      // dalla slide.
      fontFamily: 'var(--font-mono)',
      fontSize: Number.parseFloat(code.fontSize),
      lineHeight: Number.parseFloat(code.lineHeight),
      // Legature spente, texture healing di Monaspace (calt) acceso, come nei blocchi statici.
      fontLigatures: '\'liga\' 0, \'calt\' 1',
      // Lo stesso margine interno dei blocchi statici (code.css): sopra e sotto con
      // `padding`, a sinistra con la colonna delle decorazioni, a destra nel CSS.
      padding: { top: space('space-4'), bottom: space('space-4') },
      lineDecorationsWidth: space('space-5'),
      renderLineHighlight: 'none',
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      guides: { indentation: false },
      folding: false,
      glyphMargin: false,
      stickyScroll: { enabled: false },
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off',
      parameterHints: { enabled: false },
      hover: { enabled: false },
      scrollbar: { alwaysConsumeMouseWheel: false, useShadows: false },
    },
  }
})
