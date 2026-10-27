// Le slide del risultato (fase 13): dopo ogni slide con `output: next` il tema ne genera una
// con l'output a tutta altezza. La trasformazione sta in result-slides.mjs.

import { definePreparserSetup } from '@slidev/types'
import { addResultSlides } from './result-slides.mjs'

export default definePreparserSetup(() => [
  {
    name: 'python-doesnt-byte:result',
    transformRawLines(lines) {
      addResultSlides(lines)
    },
  },
])
